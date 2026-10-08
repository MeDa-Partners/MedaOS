import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { userSections, systemSections, ventureSections, ventures } from '../db/schema';
import { ForbiddenError, UnauthorizedError, NotFoundError } from '../utils/errors';

/**
 * Generic, venture-scoped authorization middleware for system sections.
 *
 * Checks:
 * 1. Does the section exist and is it assigned to the target venture? (404 if not in venture)
 * 2. Does the user have assigned permission to this section? (403 if not authorized)
 * Administrators (isAdmin = true) bypass user permission checks for sections enabled in the venture.
 */
export function requireSection(sectionSlug: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Determine venture context from header, params, query, or body
      const targetVentureIdentifier =
        req.ventureId ||
        req.params?.ventureId ||
        (req.query?.ventureId as string | undefined) ||
        req.body?.ventureId;

      let targetVentureId: string | undefined;
      let targetVentureName = 'this venture';

      if (targetVentureIdentifier) {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            targetVentureIdentifier
          );

        if (isUuid) {
          targetVentureId = targetVentureIdentifier;
          const [v] = await db
            .select({ id: ventures.id, name: ventures.name })
            .from(ventures)
            .where(eq(ventures.id, targetVentureIdentifier))
            .limit(1);
          if (v) targetVentureName = v.name;
        } else {
          // Resolve slug to ID
          const [v] = await db
            .select({ id: ventures.id, name: ventures.name })
            .from(ventures)
            .where(eq(ventures.slug, targetVentureIdentifier))
            .limit(1);
          if (v) {
            targetVentureId = v.id;
            targetVentureName = v.name;
          }
        }
      }

      // If target venture is specified, check if the section is assigned to this venture
      if (targetVentureId) {
        const [ventureHasSection] = await db
          .select({ id: ventureSections.id })
          .from(ventureSections)
          .innerJoin(systemSections, eq(ventureSections.sectionId, systemSections.id))
          .where(
            and(
              eq(ventureSections.ventureId, targetVentureId),
              eq(systemSections.slug, sectionSlug),
              eq(systemSections.status, 'active')
            )
          )
          .limit(1);

        if (!ventureHasSection) {
          throw new NotFoundError(
            `No such section in this venture: the "${sectionSlug}" section is not assigned to the ${targetVentureName} venture.`
          );
        }
      }

      // System Administrators have access to all sections assigned to the venture
      if (req.user.isAdmin) {
        return next();
      }

      // Query database for user-to-section permission within venture
      const query = db
        .select({
          userSectionId: userSections.id,
          ventureId: userSections.ventureId,
        })
        .from(userSections)
        .innerJoin(systemSections, eq(userSections.sectionId, systemSections.id))
        .innerJoin(
          ventureSections,
          and(
            eq(ventureSections.ventureId, userSections.ventureId),
            eq(ventureSections.sectionId, systemSections.id)
          )
        )
        .where(
          and(
            eq(userSections.userId, req.user.id),
            eq(systemSections.slug, sectionSlug),
            eq(systemSections.status, 'active'),
            targetVentureId ? eq(userSections.ventureId, targetVentureId) : undefined
          )
        )
        .limit(1);

      const accessRecords = await query;

      if (accessRecords.length === 0) {
        throw new ForbiddenError(
          `Access denied: you do not have permission to access the "${sectionSlug}" section${
            targetVentureId ? ` in ${targetVentureName}` : ''
          }.`
        );
      }

      // Attach resolved venture ID if not already set
      if (!req.ventureId) {
        req.ventureId = accessRecords[0].ventureId;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
