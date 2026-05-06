import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { env } from '../config/env';

/**
 * Centralised error handler. All error responses share the envelope:
 *   { error: { code: string, message: string, details?: unknown } }
 *
 * - AppError → use its code/status/details
 * - ZodError → 400 VALIDATION with field-level issues
 * - anything else → 500 INTERNAL (message hidden in production)
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code:    'VALIDATION',
        message: 'Invalid request',
        details: err.issues.map((i) => ({
          path:    i.path.join('.'),
          message: i.message,
        })),
      },
    });
  }

  console.error('[error]', err);
  const message = env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err instanceof Error ? err.message : String(err));

  return res.status(500).json({
    error: { code: 'INTERNAL', message },
  });
}
