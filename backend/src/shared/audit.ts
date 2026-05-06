import { query } from '../db/pool';

/**
 * Append an entry to the audit_log table. Best-effort — failures are logged
 * but never propagate to the caller (audit logging must not break business flow).
 */
export async function audit(
  userEmail: string | null,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_email, action, metadata) VALUES ($1, $2, $3)`,
      [userEmail, action, metadata ?? null]
    );
  } catch (err) {
    console.error('[audit] failed to write log entry:', err);
  }
}
