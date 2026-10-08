import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Middleware that restricts route access to Global System Administrators (isAdmin === true).
 * Must be executed AFTER the `authenticate` middleware.
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.isAdmin) {
    return next(new ForbiddenError('Administrator authority required'));
  }

  next();
}
