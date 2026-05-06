import api from './client';
import { Role } from '../types';

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

export interface ListAuditLogFilters {
  action?:        string;
  action_prefix?: string;
  user_id?:       string;
  date_from?:     string;
  date_to?:       string;
  limit?:         number;
  offset?:        number;
}

export interface PagedAuditLog {
  data: AuditLogDTO[];
  pagination: {
    limit:   number;
    offset:  number;
    total:   number;
    hasMore: boolean;
  };
}

export const auditLogApi = {
  list: (filters: ListAuditLogFilters = {}): Promise<PagedAuditLog> =>
    api.get('/api/audit-log', { params: filters }).then(r => r.data),

  actions: (): Promise<string[]> =>
    api.get('/api/audit-log/actions').then(r => r.data),
};
