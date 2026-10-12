import { eq, and, inArray, sql, asc } from 'drizzle-orm';
import { db } from '../../db';
import { departments, ventures, users, teams, sections, userMemberships, userSections } from '../../db/schema';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { CreateDepartmentInput, UpdateDepartmentInput } from './departments.validation';
import { DepartmentItem } from './departments.types';
import { assertCanManageDepartment } from '../../utils/authorization';

export class DepartmentsService {
  /**
   * Helper to slugify a name if not provided.
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async listDepartments(
    options: { ventureId?: string } = {},
    requester: { id: string; isAdmin: boolean }
  ): Promise<DepartmentItem[]> {
    const whereConditions = [];

    if (options.ventureId) {
      whereConditions.push(eq(departments.ventureId, options.ventureId));
    }

    if (!requester.isAdmin) {
      // Non-admin can only view active departments in their allowed scope
      whereConditions.push(eq(departments.status, 'active'));
    }

    const rows = await db
      .select({
        id: departments.id,
        ventureId: departments.ventureId,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        name: departments.name,
        slug: departments.slug,
        headUserId: departments.headUserId,
        headUserName: users.name,
        headUserEmail: users.email,
        status: departments.status,
        createdAt: departments.createdAt,
        updatedAt: departments.updatedAt,
      })
      .from(departments)
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .leftJoin(users, eq(departments.headUserId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(asc(departments.createdAt), asc(departments.name));

    // Get team counts and section counts
    const deptIds = rows.map((r) => r.id);
    let teamCounts = new Map<string, number>();
    let sectionCounts = new Map<string, number>();

    if (deptIds.length > 0) {
      const [tCounts, sCounts] = await Promise.all([
        db
          .select({
            departmentId: teams.departmentId,
            count: sql<number>`count(*)::int`,
          })
          .from(teams)
          .groupBy(teams.departmentId),
        db
          .select({
            departmentId: sections.departmentId,
            count: sql<number>`count(*)::int`,
          })
          .from(sections)
          .groupBy(sections.departmentId),
      ]);

      tCounts.forEach((tc) => teamCounts.set(tc.departmentId, tc.count));
      sCounts.forEach((sc) => sectionCounts.set(sc.departmentId, sc.count));
    }

    return rows.map((r) => ({
      id: r.id,
      ventureId: r.ventureId,
      ventureName: r.ventureName,
      ventureSlug: r.ventureSlug,
      name: r.name,
      slug: r.slug,
      headUserId: r.headUserId,
      headUserName: r.headUserName,
      headUserEmail: r.headUserEmail,
      headUser:
        r.headUserId && r.headUserName
          ? {
              id: r.headUserId,
              name: r.headUserName,
              email: r.headUserEmail || '',
            }
          : null,
      status: r.status,
      teamCount: teamCounts.get(r.id) || 0,
      sectionCount: sectionCounts.get(r.id) || 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getDepartmentById(id: string, requester: { id: string; isAdmin: boolean }): Promise<DepartmentItem> {
    await assertCanManageDepartment(requester.id, requester.isAdmin, id);
    const [row] = await db
      .select({
        id: departments.id,
        ventureId: departments.ventureId,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        name: departments.name,
        slug: departments.slug,
        headUserId: departments.headUserId,
        headUserName: users.name,
        headUserEmail: users.email,
        status: departments.status,
        createdAt: departments.createdAt,
        updatedAt: departments.updatedAt,
      })
      .from(departments)
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .leftJoin(users, eq(departments.headUserId, users.id))
      .where(eq(departments.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundError(`Department with id "${id}" not found`);
    }

    return {
      id: row.id,
      ventureId: row.ventureId,
      ventureName: row.ventureName,
      ventureSlug: row.ventureSlug,
      name: row.name,
      slug: row.slug,
      headUserId: row.headUserId,
      headUserName: row.headUserName,
      headUserEmail: row.headUserEmail,
      headUser:
        row.headUserId && row.headUserName
          ? {
              id: row.headUserId,
              name: row.headUserName,
              email: row.headUserEmail || '',
            }
          : null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createDepartment(
    input: CreateDepartmentInput,
    requester: { id: string; isAdmin: boolean }
  ): Promise<DepartmentItem> {
    if (!requester.isAdmin) {
      throw new ForbiddenError('Only Global Administrators can create departments');
    }

    // Verify venture exists
    const [targetVenture] = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.id, input.ventureId))
      .limit(1);

    if (!targetVenture) {
      throw new BadRequestError('Specified venture does not exist');
    }

    // Slug generation and uniqueness check within venture
    const slug = input.slug || this.slugify(input.name);
    const existing = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.ventureId, input.ventureId), eq(departments.slug, slug)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`Department slug "${slug}" is already in use for this venture`);
    }

    // Verify head user if provided
    if (input.headUserId) {
      throw new BadRequestError(
        'Department must be created and employee membership assigned before appointing a Department Head'
      );
    }

    const [inserted] = await db
      .insert(departments)
      .values({
        ventureId: input.ventureId,
        name: input.name,
        slug,
        headUserId: null,
        status: input.status || 'active',
      })
      .returning({ id: departments.id });

    return this.getDepartmentById(inserted.id, requester);
  }

  async updateDepartment(
    id: string,
    input: UpdateDepartmentInput,
    requester: { id: string; isAdmin: boolean }
  ): Promise<DepartmentItem> {
    await assertCanManageDepartment(requester.id, requester.isAdmin, id);

    const [current] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Department not found');
    }

    // Only Global Admin can change headUserId or status
    if ((input.headUserId !== undefined || input.status !== undefined) && !requester.isAdmin) {
      throw new ForbiddenError('Only Global Administrators can reassign department heads or change status');
    }

    if (input.slug && input.slug !== current.slug) {
      const existing = await db
        .select({ id: departments.id })
        .from(departments)
        .where(
          and(
            eq(departments.ventureId, current.ventureId),
            eq(departments.slug, input.slug),
            sql`${departments.id} != ${id}`
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError(`Department slug "${input.slug}" is already in use for this venture`);
      }
    }

    if (input.headUserId) {
      const [headUser] = await db
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.id, input.headUserId))
        .limit(1);

      if (!headUser) {
        throw new BadRequestError('Specified Department Head user does not exist');
      }

      if (headUser.status !== 'active') {
        throw new BadRequestError('Cannot appoint an inactive user as Department Head');
      }

      const [membership] = await db
        .select({ id: userMemberships.id })
        .from(userMemberships)
        .where(
          and(
            eq(userMemberships.userId, input.headUserId),
            eq(userMemberships.ventureId, current.ventureId),
            eq(userMemberships.departmentId, id)
          )
        )
        .limit(1);

      if (!membership) {
        throw new BadRequestError(
          'User must have an active membership in this venture and department before being appointed Department Head'
        );
      }
    }

    const updateData: Partial<typeof departments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.headUserId !== undefined) updateData.headUserId = input.headUserId;
    if (input.status !== undefined) updateData.status = input.status;

    await db.update(departments).set(updateData).where(eq(departments.id, id));

    return this.getDepartmentById(id, requester);
  }

  async assignHead(
    id: string,
    headUserId: string | null,
    requester: { id: string; isAdmin: boolean }
  ): Promise<DepartmentItem> {
    if (!requester.isAdmin) {
      throw new ForbiddenError('Only Global Administrators can appoint or replace Department Heads');
    }

    const [current] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Department not found');
    }

    if (headUserId) {
      const [headUser] = await db
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.id, headUserId))
        .limit(1);

      if (!headUser) {
        throw new BadRequestError('Specified user does not exist');
      }

      if (headUser.status !== 'active') {
        throw new BadRequestError('Cannot appoint an inactive user as Department Head');
      }

      // Verify user has an active membership in this venture and department
      const [membership] = await db
        .select({ id: userMemberships.id })
        .from(userMemberships)
        .where(
          and(
            eq(userMemberships.userId, headUserId),
            eq(userMemberships.ventureId, current.ventureId),
            eq(userMemberships.departmentId, id)
          )
        )
        .limit(1);

      if (!membership) {
        throw new BadRequestError(
          'User must have an active membership in this venture and department before being appointed Department Head'
        );
      }
    }

    await db
      .update(departments)
      .set({ headUserId, updatedAt: new Date() })
      .where(eq(departments.id, id));

    return this.getDepartmentById(id, requester);
  }

  async deleteDepartment(id: string, requester: { id: string; isAdmin: boolean }): Promise<void> {
    if (!requester.isAdmin) {
      throw new ForbiddenError('Only Global Administrators can delete departments');
    }

    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!dept) {
      throw new NotFoundError('Department not found');
    }

    await db.transaction(async (tx) => {
      // Clean up user_sections for sections in this department
      const deptSecs = await tx
        .select({ id: sections.id })
        .from(sections)
        .where(eq(sections.departmentId, id));

      const secIds = deptSecs.map((s) => s.id);
      if (secIds.length > 0) {
        await tx.delete(userSections).where(inArray(userSections.sectionId, secIds));
      }

      await tx.delete(departments).where(eq(departments.id, id));
    });
  }
}

export const departmentsService = new DepartmentsService();
