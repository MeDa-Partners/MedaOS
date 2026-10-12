import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { getUserAuthorityContext } from '../utils/authorization';

/**
 * Middleware that authorizes Employee Management operations.
 * Allowed for Global Administrators, Department Heads, and Team Heads.
 */
export async function requireEmployeeManagement(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (req.user.isAdmin) {
      return next();
    }

    const auth = await getUserAuthorityContext(req.user.id, false);
    if (auth.departmentsLed.length === 0 && auth.teamsLed.length === 0) {
      throw new ForbiddenError(
        'Access denied: Employee Management authorization required.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
