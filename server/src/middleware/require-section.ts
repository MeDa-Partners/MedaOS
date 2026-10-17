import { Request, Response, NextFunction } from 'express';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../utils/errors';
import { resolveSectionAccess } from '../utils/access';

/**
 * Guards a section module's API routes.
 *
 * Usage inside a coded section module:
 *   router.get('/:ventureId/leads', authenticate, requireSection('leads'), handler)
 *
 * The venture comes from `:ventureId` (id or slug), `?ventureId=`, or the `X-Venture-Id` header.
 * On success `req.ventureId` is set to the venture's UUID.
 */
export function requireSection(sectionSlug: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const ventureIdentifier =
        (typeof req.params?.ventureId === 'string' && req.params.ventureId) ||
        (typeof req.query?.ventureId === 'string' && req.query.ventureId) ||
        req.ventureId;

      if (!ventureIdentifier) {
        throw new BadRequestError('A venture is required to access a section.');
      }

      const result = await resolveSectionAccess(req.user, ventureIdentifier, sectionSlug);
      if (!result.allowed || !result.section) {
        throw new ForbiddenError(result.reason || 'Access denied');
      }

      req.ventureId = result.section.ventureId;
      next();
    } catch (error) {
      next(error);
    }
  };
}
