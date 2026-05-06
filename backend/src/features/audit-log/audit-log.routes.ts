import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { auditLogService } from './audit-log.service';
import { listAuditLogQuerySchema } from './audit-log.validators';

const router = Router();

// Audit log is ADMIN-only. Read-only — entries are written by the audit()
// helper from inside the action's own route handler.
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// GET /api/audit-log
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filters = listAuditLogQuerySchema.parse(req.query);
    const result  = await auditLogService.list(filters);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/audit-log/actions — distinct actions for the filter dropdown.
router.get('/actions', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actions = await auditLogService.distinctActions();
    res.json(actions);
  } catch (err) { next(err); }
});

export default router;
