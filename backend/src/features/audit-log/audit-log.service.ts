import {
  auditLogRepository, AuditLogDTO, ListFilters,
  PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX,
} from './audit-log.repository';

export interface PagedAuditLog {
  data: AuditLogDTO[];
  pagination: {
    limit:   number;
    offset:  number;
    total:   number;
    hasMore: boolean;
  };
}

export const auditLogService = {
  async list(filters: ListFilters): Promise<PagedAuditLog> {
    const limit  = Math.min(Math.max(filters.limit ?? PAGE_LIMIT_DEFAULT, 1), PAGE_LIMIT_MAX);
    const offset = Math.max(filters.offset ?? 0, 0);
    const effective: ListFilters = { ...filters, limit, offset };

    const [data, total] = await Promise.all([
      auditLogRepository.list(effective),
      auditLogRepository.count(effective),
    ]);

    return {
      data,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + data.length < total,
      },
    };
  },

  async distinctActions(): Promise<string[]> {
    return auditLogRepository.distinctActions();
  },
};
