import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const idStr   = z.string().regex(/^\d+$/, 'Must be a numeric id');

// Action values are dot-namespaced strings emitted by the audit() helper,
// e.g. "dropout.create", "user.password_reset". Cap length to keep filter
// inputs sane.
const actionField = z.string().min(1).max(80);

export const listAuditLogQuerySchema = z.object({
  action:        actionField.optional(),
  action_prefix: actionField.optional(),
  user_id:       idStr.optional(),
  date_from:     isoDate.optional(),
  date_to:       isoDate.optional(),
  limit:         z.coerce.number().int().min(1).max(500).optional(),
  offset:        z.coerce.number().int().min(0).optional(),
});

export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
