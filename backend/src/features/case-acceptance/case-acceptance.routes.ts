import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { caseAcceptanceService } from './case-acceptance.service';
import { audit } from '../../shared/audit';
import {
  createCaseAcceptanceSchema,
  updateCaseAcceptanceSchema,
  listCaseAcceptanceQuerySchema,
} from './case-acceptance.validators';

const router = Router();
router.use(authMiddleware);

// GET /api/case-acceptance
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filters = listCaseAcceptanceQuerySchema.parse(req.query);
    const result  = await caseAcceptanceService.list(req.scope!, filters);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/case-acceptance/summary — aggregate over the FULL filtered set,
// independent of pagination. Used by the admin dashboard.
router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filters = listCaseAcceptanceQuerySchema.parse(req.query);
    const summary = await caseAcceptanceService.summary(req.scope!, filters);
    res.json(summary);
  } catch (err) { next(err); }
});

// GET /api/case-acceptance/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const row = await caseAcceptanceService.get(req.scope!, req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

// POST /api/case-acceptance
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createCaseAcceptanceSchema.parse(req.body);
    const row  = await caseAcceptanceService.create(req.scope!, body);
    await audit(req.scope!.userId, 'case_acceptance.create', { id: row.id, clinic_id: row.clinic_id });
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// PATCH /api/case-acceptance/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patch = updateCaseAcceptanceSchema.parse(req.body);
    const row   = await caseAcceptanceService.update(req.scope!, req.params.id, patch);
    await audit(req.scope!.userId, 'case_acceptance.update', { id: row.id });
    res.json(row);
  } catch (err) { next(err); }
});

// DELETE /api/case-acceptance/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await caseAcceptanceService.delete(req.scope!, req.params.id);
    await audit(req.scope!.userId, 'case_acceptance.delete', { id: req.params.id });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
