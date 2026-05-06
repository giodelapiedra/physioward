import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { Role } from '../shared/roles';
import { Errors } from '../shared/errors';

/**
 * Gate a route on one or more allowed roles. Must be mounted AFTER authMiddleware
 * (so req.scope is populated).
 *
 *   router.post('/users', authMiddleware, requireRole('ADMIN'), handler)
 */
export function requireRole(...allowed: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.scope) return next(Errors.unauthorized());
    if (!allowed.includes(req.scope.role)) {
      return next(Errors.forbidden(`Requires role: ${allowed.join(' or ')}`));
    }
    next();
  };
}
