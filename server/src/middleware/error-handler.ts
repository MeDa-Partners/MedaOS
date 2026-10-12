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

  // 3. PostgreSQL / Database / Drizzle Query Errors
  const extractedDbErr = (() => {
    if (typeof err !== 'object' || err === null) return null;
    if ('cause' in err && typeof (err as any).cause === 'object' && (err as any).cause !== null) {
      return (err as any).cause as { code?: string; message?: string; detail?: string };
    }
    if ('code' in err) {
      return err as { code?: string; message?: string; detail?: string };
    }
    return null;
  })();

  if (extractedDbErr && extractedDbErr.code) {
    const code = extractedDbErr.code;

    // Unique violation (e.g., unique email, unique slug, unique user-venture)
    if (code === '23505') {
      sendError(res, 409, 'A resource with these details already exists.');
      return;
    }

    // Foreign key violation
    if (code === '23503') {
      sendError(
        res,
        400,
        'Referenced related resource does not exist or cannot be modified.'
      );
      return;
    }

    // Query canceled due to statement timeout (57014)
    if (code === '57014') {
      console.warn('[Database Timeout] Query statement canceled due to timeout:', extractedDbErr.message || 'Timeout');
      sendError(
        res,
        503,
        'Database query timed out. Please try your request again.'
      );
      return;
    }

    // Connection termination or administrator shutdown (57P01, 08006, 08001, etc.)
    if (code === '57P01' || code === '08006' || code === '08001' || code === '08004') {
      console.warn('[Database Connection Error]:', code, extractedDbErr.message);
      sendError(
        res,
        503,
        'Database connection is temporarily unavailable. Please retry.'
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
