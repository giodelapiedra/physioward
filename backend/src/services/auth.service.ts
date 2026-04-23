import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { userRepository, UserRow } from '../repositories/user.repository';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TokenPayload {
  sub:   string;   // user id
  email: string;
  role:  string;
}

export interface LoginResult {
  accessToken:  string;
  refreshToken: string;
  user:         { id: string; email: string; role: string };
}

export const authService = {
  /** Validate credentials against the DB. Returns the user row on success. */
  async authenticate(email: string, password: string): Promise<UserRow | null> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Timing-equalize against the "user exists" branch to avoid user enumeration.
      await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      return null;
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    return ok ? user : null;
  },

  /** Create both tokens and persist the refresh token (hashed) in the DB. */
  async issueTokens(user: UserRow): Promise<LoginResult> {
    const accessToken  = signAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await refreshTokenRepository.insert(user.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
      user: { id: String(user.id), email: user.email, role: user.role },
    };
  },

  /** Rotate the refresh token: validate, revoke, issue a new pair. */
  async rotateRefresh(presented: string): Promise<LoginResult | null> {
    const row = await refreshTokenRepository.findValid(presented);
    if (!row) return null;

    const user = await userRepository.findById(row.user_id);
    if (!user) return null;

    await refreshTokenRepository.revoke(presented);
    return this.issueTokens(user);
  },

  async revokeRefresh(token: string): Promise<void> {
    await refreshTokenRepository.revoke(token);
  },

  verifyAccessToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  },

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  },
};

function signAccessToken(user: UserRow): string {
  const payload: TokenPayload = {
    sub:   String(user.id),
    email: user.email,
    role:  user.role,
  };
  const opts: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}
