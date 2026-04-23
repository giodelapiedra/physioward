import crypto from 'crypto';
import { query } from '../db/pool';

// We store only SHA-256 hashes of refresh tokens — never the raw value.
// This way, a DB leak does not expose usable session tokens.
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

interface RefreshTokenRow {
  id:         string;
  token_hash: string;
  user_id:    string;
  expires_at: Date;
  revoked_at: Date | null;
}

export const refreshTokenRepository = {
  hashToken,

  async insert(userId: string | number, token: string, expiresAt: Date): Promise<void> {
    await query(
      `INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [hashToken(token), userId, expiresAt]
    );
  },

  /** Returns the matching row if the token is valid, non-revoked, and unexpired. */
  async findValid(token: string): Promise<RefreshTokenRow | null> {
    const { rows } = await query<RefreshTokenRow>(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [hashToken(token)]
    );
    return rows[0] ?? null;
  },

  async revoke(token: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(token)]
    );
  },

  async revokeAllForUser(userId: string | number): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  },

  /** Housekeeping: delete expired/revoked tokens older than 30 days. */
  async purgeStale(): Promise<number> {
    const { rowCount } = await query(
      `DELETE FROM refresh_tokens
       WHERE (expires_at < NOW() OR revoked_at IS NOT NULL)
         AND created_at < NOW() - INTERVAL '30 days'`
    );
    return rowCount ?? 0;
  },
};
