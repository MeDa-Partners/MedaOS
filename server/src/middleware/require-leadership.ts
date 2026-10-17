import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { isLeader, loadAuthority } from '../utils/access';

/**
 * Allows Global Admins, Department Heads and Team Heads.
 * Fine-grained checks (which department / team / person) happen in the services.
 */
export async function requireLeadership(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    const auth = await loadAuthority(req.user);
    if (!isLeader(auth)) {
      throw new ForbiddenError('Only administrators, department heads and team heads can manage people.');
    }
    next();
  } catch (error) {
    next(error);
  }
}
