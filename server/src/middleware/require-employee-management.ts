import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { userSections, systemSections } from '../db/schema';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Middleware that authorizes Employee Management operations.
 * Allowed for Global Administrators (isAdmin = true) and authorized managers
 * who have the 'employees' section assigned in a venture.
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

    // Check if user has 'employees' section in any active venture
    const records = await db
      .select({ id: userSections.id })
      .from(userSections)
      .innerJoin(systemSections, eq(userSections.sectionId, systemSections.id))
      .where(
        and(
          eq(userSections.userId, req.user.id),
          eq(systemSections.slug, 'employees'),
          eq(systemSections.status, 'active')
        )
      )
      .limit(1);

    if (records.length === 0) {
      throw new ForbiddenError(
        'Access denied: Employee Management authorization required.'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
