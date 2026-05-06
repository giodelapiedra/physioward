import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { dropoutService } from './dropout.service';
import { audit } from '../../shared/audit';
import {
  createDropoutSchema,
  updateDropoutSchema,
  listDropoutsQuerySchema,
} from './dropout.validators';

const router = Router();
router.use(authMiddleware);

// GET /api/dropouts
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filters = listDropoutsQuerySchema.parse(req.query);
    const result  = await dropoutService.list(req.scope!, filters);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/dropouts/summary — aggregate counts over the FULL filtered set,
// independent of pagination. Used by admin dashboards.
router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filters = listDropoutsQuerySchema.parse(req.query);
    const summary = await dropoutService.summary(req.scope!, filters);
    res.json(summary);
  } catch (err) { next(err); }
});

// GET /api/dropouts/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const row = await dropoutService.get(req.scope!, req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

// POST /api/dropouts
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createDropoutSchema.parse(req.body);
    const row  = await dropoutService.create(req.scope!, body);
    await audit(req.scope!.userId, 'dropout.create', { id: row.id, clinic_id: row.clinic_id });
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// PATCH /api/dropouts/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patch = updateDropoutSchema.parse(req.body);
    const row   = await dropoutService.update(req.scope!, req.params.id, patch);
    await audit(req.scope!.userId, 'dropout.update', { id: row.id });
    res.json(row);
  } catch (err) { next(err); }
});

// DELETE /api/dropouts/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await dropoutService.delete(req.scope!, req.params.id);
    await audit(req.scope!.userId, 'dropout.delete', { id: req.params.id });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
