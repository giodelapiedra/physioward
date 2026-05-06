export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION:   400,
  UNAUTHORIZED: 401,
  FORBIDDEN:    403,
  NOT_FOUND:    404,
  CONFLICT:     409,
  INTERNAL:     500,
};

export class AppError extends Error {
  readonly code:    ErrorCode;
  readonly status:  number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name    = 'AppError';
    this.code    = code;
    this.status  = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const Errors = {
  validation:   (msg: string, details?: unknown) => new AppError('VALIDATION', msg, details),
  unauthorized: (msg = 'Unauthorized')           => new AppError('UNAUTHORIZED', msg),
  forbidden:    (msg = 'Forbidden')              => new AppError('FORBIDDEN', msg),
  notFound:     (msg = 'Not found')              => new AppError('NOT_FOUND', msg),
  conflict:     (msg: string)                    => new AppError('CONFLICT', msg),
  internal:     (msg = 'Internal server error')  => new AppError('INTERNAL', msg),
};
