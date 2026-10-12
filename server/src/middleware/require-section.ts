import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { sections, departments, ventures, userMemberships, userSections } from '../db/schema';
import { ForbiddenError, UnauthorizedError, NotFoundError } from '../utils/errors';

/**
 * Generic, venture-scoped authorization middleware for sections.
 *
 * Checks:
 * 1. Does the section exist and is it active?
 * 2. If venture is specified, does the section belong to a department of this venture?
 * 3. Does the user have access (Global Admin, Department Head of owning department, or assigned in userSections)?
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

      if (targetVentureIdentifier) {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            targetVentureIdentifier
          );

        if (isUuid) {
          targetVentureId = targetVentureIdentifier;
        } else {
          const [v] = await db
            .select({ id: ventures.id })
            .from(ventures)
            .where(eq(ventures.slug, targetVentureIdentifier))
            .limit(1);
          if (v) {
            targetVentureId = v.id;
          }
        }
      }

      // Find section joined with department and venture
      const sectionQuery = db
        .select({
          sectionId: sections.id,
          sectionName: sections.name,
          sectionSlug: sections.slug,
          sectionStatus: sections.status,
          departmentId: departments.id,
          deptHeadUserId: departments.headUserId,
          ventureId: departments.ventureId,
          ventureName: ventures.name,
        })
        .from(sections)
        .innerJoin(departments, eq(sections.departmentId, departments.id))
        .innerJoin(ventures, eq(departments.ventureId, ventures.id))
        .where(
          and(
            eq(sections.slug, sectionSlug),
            targetVentureId ? eq(departments.ventureId, targetVentureId) : undefined
          )
        )
        .limit(1);

      const [sectionRecord] = await sectionQuery;

      if (!sectionRecord) {
        throw new NotFoundError(`Section "${sectionSlug}" not found or not available in the specified venture.`);
      }

      if (sectionRecord.sectionStatus !== 'active') {
        throw new ForbiddenError(`The "${sectionSlug}" section is currently disabled.`);
      }

      // Global Administrators have full operational access to active sections
      if (req.user.isAdmin) {
        req.ventureId = sectionRecord.ventureId;
        return next();
      }

      // Verify the user is a member of the owning venture and department
      const [membership] = await db
        .select({ id: userMemberships.id })
        .from(userMemberships)
        .where(
          and(
            eq(userMemberships.userId, req.user.id),
            eq(userMemberships.ventureId, sectionRecord.ventureId),
            eq(userMemberships.departmentId, sectionRecord.departmentId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new ForbiddenError(
          `Access denied: you do not belong to the department that owns the "${sectionSlug}" section.`
        );
      }

      // Department Heads inherit access to all active sections in their department
      if (sectionRecord.deptHeadUserId === req.user.id) {
        req.ventureId = sectionRecord.ventureId;
        return next();
      }

      // Check if this section is assigned to the user
      const [assigned] = await db
        .select({ id: userSections.id })
        .from(userSections)
        .where(
          and(
            eq(userSections.userId, req.user.id),
            eq(userSections.sectionId, sectionRecord.sectionId)
          )
        )
        .limit(1);

      if (!assigned) {
        throw new ForbiddenError(
          `Access denied: you do not have permission to access the "${sectionSlug}" section in ${sectionRecord.ventureName}.`
        );
      }

      req.ventureId = sectionRecord.ventureId;
      next();
    } catch (error) {
      next(error);
    }
  };
}
