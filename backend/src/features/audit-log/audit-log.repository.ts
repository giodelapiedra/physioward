import { query } from '../../db/pool';
import { Role } from '../../shared/roles';

/**
 * audit_log was created in 001_init.sql with column `user_email`, but the
 * `audit()` helper actually writes the caller's user_id (as text) into it.
 * The naming predates the role/scoping work — keep the column name to avoid
 * a destructive rename, and join through users.id to surface the actual
 * email + display name on read.
 */
export interface AuditLogRow {
  id:         string;
  user_email: string | null;  // actually user_id::text
  action:     string;
  metadata:   Record<string, unknown> | null;
  created_at: Date;
}

export interface AuditLogJoinedRow extends AuditLogRow {
  joined_email:     string | null;
  joined_full_name: string | null;
  joined_role:      Role | null;
}

export interface AuditLogDTO {
  id:          string;
  user_id:     string | null;
  user_email:  string | null;
  user_name:   string | null;
  user_role:   Role | null;
  action:      string;
  metadata:    Record<string, unknown> | null;
  created_at:  string;
}

function toDTO(row: AuditLogJoinedRow): AuditLogDTO {
  return {
    id:         row.id,
    user_id:    row.user_email,        // legacy column = user_id
    user_email: row.joined_email,
    user_name:  row.joined_full_name,
    user_role:  row.joined_role,
    action:     row.action,
    metadata:   row.metadata,
    created_at: row.created_at.toISOString(),
  };
}

export interface ListFilters {
  /** Exact action match, e.g. "dropout.delete". */
  action?:        string;
  /** Action prefix match, e.g. "dropout." → all dropout actions. */
  action_prefix?: string;
  user_id?:       string;
  date_from?:     string; // YYYY-MM-DD inclusive (compared against created_at::date)
  date_to?:       string;
  limit?:         number;
  offset?:        number;
}

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX     = 500;

const SELECT_JOINED = `
  SELECT
    a.id, a.user_email, a.action, a.metadata, a.created_at,
    u.email     AS joined_email,
    u.full_name AS joined_full_name,
    u.role      AS joined_role
  FROM audit_log a
  LEFT JOIN users u ON u.id::text = a.user_email
`;

function buildWhere(filters: ListFilters): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const where:  string[]  = [];

  if (filters.action) {
    params.push(filters.action);
    where.push(`a.action = $${params.length}`);
  }
  if (filters.action_prefix) {
    // Escape ILIKE wildcards in user-supplied prefix.
    const escaped = filters.action_prefix.replace(/[\\%_]/g, (m) => '\\' + m);
    params.push(`${escaped}%`);
    where.push(`a.action ILIKE $${params.length}`);
  }
  if (filters.user_id) {
    params.push(filters.user_id);
    where.push(`a.user_email = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`a.created_at >= $${params.length}::timestamptz`);
  }
  if (filters.date_to) {
    // Inclusive — bump the boundary to end-of-day.
    params.push(filters.date_to);
    where.push(`a.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return { sql: where.length ? where.join(' AND ') : '1=1', params };
}

export const auditLogRepository = {
  async list(filters: ListFilters = {}): Promise<AuditLogDTO[]> {
    const { sql: whereSql, params } = buildWhere(filters);
    const limit  = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), PAGE_LIMIT_MAX);
    const offset = Math.max(filters.offset ?? 0, 0);
    params.push(limit);  const limitIdx  = params.length;
    params.push(offset); const offsetIdx = params.length;

    const sql = `
      ${SELECT_JOINED}
      WHERE ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
    const { rows } = await query<AuditLogJoinedRow>(sql, params);
    return rows.map(toDTO);
  },

  async count(filters: ListFilters = {}): Promise<number> {
    const { sql: whereSql, params } = buildWhere(filters);
    const { rows } = await query<{ total: string }>(
      `SELECT COUNT(*)::bigint AS total FROM audit_log a WHERE ${whereSql}`,
      params
    );
    return Number(rows[0]?.total ?? 0);
  },

  /** Distinct action values currently in the table — drives the filter dropdown. */
  async distinctActions(): Promise<string[]> {
    const { rows } = await query<{ action: string }>(
      `SELECT DISTINCT action FROM audit_log ORDER BY action`
    );
    return rows.map((r) => r.action);
  },
};
