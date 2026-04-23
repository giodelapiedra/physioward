import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';

/**
 * Nookal v3 GraphQL client — auth flow confirmed by live probing.
 *
 * Token exchange:
 *   POST {BASE}/oauth/token
 *     Authorization: Basic <BASIC_KEY verbatim>       ← NOT base64(id:secret)
 *     Content-Type:  application/x-www-form-urlencoded
 *     body: grant_type=client_credentials
 *   ->  { accessToken, accessTokenExpiresAt: ISO8601, client, user }
 *
 * Nookal's Basic Key is already the encoded credential — pass it verbatim
 * as the Basic auth value. The Client ID is informational only (displayed
 * in Nookal's admin for reference; not needed for auth).
 *
 * GraphQL:
 *   POST {BASE}/graphql
 *     Authorization: Bearer <accessToken>
 *     Content-Type:  application/json
 *
 * Access tokens are cached in-process until 60s before expiry.
 */

interface CachedToken {
  value:     string;
  expiresAt: number;
}

interface TokenResponse {
  accessToken:          string;
  accessTokenExpiresAt: string; // ISO timestamp
}

export interface GraphQLError {
  message:    string;
  path?:      (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<T> {
  data?:   T;
  errors?: GraphQLError[];
}

class UnauthorizedError extends Error {}

class NookalV3Client {
  private http:         AxiosInstance;
  private token:        CachedToken | null = null;
  private tokenInFlight: Promise<string> | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: env.NOOKAL_V3_BASE_URL,
      timeout: 30_000,
    });
  }

  /**
   * Serialize token acquisition so parallel GraphQL calls share one token.
   * Without this, each parallel query fetches its own token and Nookal
   * invalidates prior ones — triggering "Token has expired" storms.
   */
  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }
    if (this.tokenInFlight) return this.tokenInFlight;

    this.tokenInFlight = this.fetchToken().finally(() => {
      this.tokenInFlight = null;
    });
    return this.tokenInFlight;
  }

  private async fetchToken(): Promise<string> {
    try {
      const res = await this.http.post<TokenResponse>(
        '/oauth/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${env.NOOKAL_V3_CLIENT_SECRET}`,
            'Content-Type':  'application/x-www-form-urlencoded',
          },
        }
      );

      const { accessToken, accessTokenExpiresAt } = res.data;
      if (!accessToken || !accessTokenExpiresAt) {
        throw new Error(`unexpected token response: ${JSON.stringify(res.data)}`);
      }

      this.token = {
        value:     accessToken,
        expiresAt: new Date(accessTokenExpiresAt).getTime(),
      };
      return accessToken;
    } catch (err: any) {
      const detail = err.response?.data ?? err.message;
      throw new Error(`Nookal v3 OAuth failed: ${JSON.stringify(detail)}`);
    }
  }

  /** Execute a GraphQL query. Automatically refreshes token on 401. */
  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const attempt = async (): Promise<T> => {
      const token = await this.getAccessToken();
      const res = await this.http.post<GraphQLResponse<T>>(
        '/graphql',
        { query, variables },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
          validateStatus: () => true,
        }
      );

      const rawBody = JSON.stringify(res.data);
      // Nookal returns 400 with "Token has expired" — treat as auth failure
      // so we refresh-and-retry, not as a permanent error.
      const isExpired = /token has expired|please supply a current bearer/i.test(rawBody);

      if (res.status === 401 || isExpired) {
        this.token = null;
        throw new UnauthorizedError();
      }

      if (res.status >= 400 || res.data.errors?.length) {
        const msg = res.data.errors?.map((e) => e.message).join('; ')
                 ?? `HTTP ${res.status}: ${rawBody}`;
        throw new Error(`Nookal v3 GraphQL error: ${msg}`);
      }

      if (!res.data.data) {
        throw new Error('Nookal v3 returned empty data');
      }
      return res.data.data;
    };

    try {
      return await attempt();
    } catch (err) {
      if (err instanceof UnauthorizedError) return attempt();
      throw err;
    }
  }
}

export const nookalV3 = new NookalV3Client();
