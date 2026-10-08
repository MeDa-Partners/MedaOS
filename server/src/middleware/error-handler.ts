import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { env } from '../config/env';

/**
 * Centralized error handler middleware.
 * Formats all errors consistently and prevents sensitive internal details from leaking.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    sendError(res, 400, 'Validation failed', formattedErrors);
    return;
  }

  // 2. Custom Application Errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.details);
    return;
  }

  // 3. PostgreSQL / Database Errors
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const dbErr = err as { code: string; message?: string; detail?: string };

    // Unique violation (e.g., unique email, unique slug, unique user-venture)
    if (dbErr.code === '23505') {
      sendError(res, 409, 'A resource with these details already exists.');
      return;
    }

    // Foreign key violation
    if (dbErr.code === '23503') {
      sendError(
        res,
        400,
        'Referenced related resource does not exist or cannot be modified.'
      );
      return;
    }
  }

  // 4. Unhandled Unexpected Errors
  console.error('[UNHANDLED ERROR]', err);

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err instanceof Error
      ? err.message
      : 'Internal server error';

  sendError(res, 500, message);
}
