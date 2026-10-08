import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { userVentures, ventures } from '../db/schema';
import { ForbiddenError, UnauthorizedError, BadRequestError } from '../utils/errors';

/**
 * Generic authorization middleware for venture-specific resources.
 * Checks whether the authenticated user has explicit access to the venture in `user_ventures`.
 *
 * Administrators (isAdmin = true) have unrestricted broad access across all ventures.
 *
 * @param paramKey The key in req.params, req.body, or req.query containing the venture ID or slug (default: 'ventureId')
 */
export function requireVentureAccess(paramKey: string = 'ventureId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Extract venture identifier from route parameters, request body, query string, or header
      const ventureIdentifier =
        req.params[paramKey] ||
        req.body?.[paramKey] ||
        req.query?.[paramKey] ||
        req.ventureId;

      if (!ventureIdentifier || typeof ventureIdentifier !== 'string') {
        throw new BadRequestError(`Missing required venture identifier: ${paramKey}`);
      }

      // Administrators have broad OS access across all ventures
      if (req.user.isAdmin) {
        return next();
      }

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          ventureIdentifier
        );

      const whereClause = isUuid
        ? and(
            eq(userVentures.userId, req.user.id),
            eq(ventures.id, ventureIdentifier),
            eq(ventures.status, 'active')
          )
        : and(
            eq(userVentures.userId, req.user.id),
            eq(ventures.slug, ventureIdentifier),
            eq(ventures.status, 'active')
          );

      const accessRecord = await db
        .select({
          userVentureId: userVentures.id,
          ventureId: ventures.id,
          ventureName: ventures.name,
        })
        .from(userVentures)
        .innerJoin(ventures, eq(userVentures.ventureId, ventures.id))
        .where(whereClause)
        .limit(1);

      if (accessRecord.length === 0) {
        throw new ForbiddenError(
          `Access denied: you do not have permission to access data for this venture.`
        );
      }

      req.ventureId = accessRecord[0].ventureId;
      next();
    } catch (error) {
      next(error);
    }
  };
}
