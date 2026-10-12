import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { getUserAuthorityContext } from '../utils/authorization';

/**
 * Middleware that allows Global Admins, Department Heads, and Team Heads.
 */
export async function requireLeadership(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.isAdmin) {
    return next();
  }

  try {
    const auth = await getUserAuthorityContext(req.user.id, false);
    if (auth.departmentsLed.length === 0 && auth.teamsLed.length === 0) {
      return next(new ForbiddenError('Leadership authority required'));
    }
    next();
  } catch (error) {
    next(error);
  }
}
