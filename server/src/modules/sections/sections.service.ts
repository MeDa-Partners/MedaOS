import { eq, and, or, sql, asc } from 'drizzle-orm';
import { db } from '../../db';
import { sections, departments, ventures, userMemberships, userSections } from '../../db/schema';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { CreateSectionInput, UpdateSectionInput } from './sections.validation';
import { SectionDetail } from './sections.types';
import { assertCanManageDepartment } from '../../utils/authorization';

export class SectionsService {
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async listSections(
    options: { departmentId?: string; ventureId?: string; onlyActive?: boolean } = {},
    requester: { id: string; isAdmin: boolean }
  ): Promise<SectionDetail[]> {
    const whereConditions = [];

    if (options.departmentId) {
      whereConditions.push(eq(sections.departmentId, options.departmentId));
    }
    if (options.ventureId) {
      whereConditions.push(eq(departments.ventureId, options.ventureId));
    }
    if (options.onlyActive || !requester.isAdmin) {
      whereConditions.push(eq(sections.status, 'active'));
    }

    const rows = await db
      .select({
        id: sections.id,
        departmentId: sections.departmentId,
        departmentName: departments.name,
        departmentSlug: departments.slug,
        ventureId: departments.ventureId,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        name: sections.name,
        slug: sections.slug,
        status: sections.status,
        createdAt: sections.createdAt,
        updatedAt: sections.updatedAt,
      })
      .from(sections)
      .innerJoin(departments, eq(sections.departmentId, departments.id))
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(asc(sections.createdAt), asc(sections.name));

    // Calculate user access counts
    const sectionIds = rows.map((r) => r.id);
    let userCounts = new Map<string, number>();

    if (sectionIds.length > 0) {
      const counts = await db
        .select({
          sectionId: userSections.sectionId,
          count: sql<number>`count(*)::int`,
        })
        .from(userSections)
        .groupBy(userSections.sectionId);

      counts.forEach((c) => userCounts.set(c.sectionId, c.count));
    }

    return rows.map((r) => ({
      id: r.id,
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      departmentSlug: r.departmentSlug,
      ventureId: r.ventureId,
      ventureName: r.ventureName,
      ventureSlug: r.ventureSlug,
      name: r.name,
      slug: r.slug,
      route: `/${r.ventureSlug}/${r.slug}`,
      status: r.status as 'active' | 'inactive',
      userCount: userCounts.get(r.id) || 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getSectionById(id: string, _requester: { id: string; isAdmin: boolean }): Promise<SectionDetail> {
    const [row] = await db
      .select({
        id: sections.id,
        departmentId: sections.departmentId,
        departmentName: departments.name,
        departmentSlug: departments.slug,
        ventureId: departments.ventureId,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        name: sections.name,
        slug: sections.slug,
        status: sections.status,
        createdAt: sections.createdAt,
        updatedAt: sections.updatedAt,
      })
      .from(sections)
      .innerJoin(departments, eq(sections.departmentId, departments.id))
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .where(eq(sections.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundError(`Section with id "${id}" not found`);
    }

    return {
      id: row.id,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      departmentSlug: row.departmentSlug,
      ventureId: row.ventureId,
      ventureName: row.ventureName,
      ventureSlug: row.ventureSlug,
      name: row.name,
      slug: row.slug,
      route: `/${row.ventureSlug}/${row.slug}`,
      status: row.status as 'active' | 'inactive',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createSection(
    input: CreateSectionInput,
    requester: { id: string; isAdmin: boolean }
  ): Promise<SectionDetail> {
    // Assert caller can manage the target department
    await assertCanManageDepartment(requester.id, requester.isAdmin, input.departmentId);

    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);

    if (!dept) {
      throw new NotFoundError(`Department with id "${input.departmentId}" not found`);
    }

    const slug = input.slug || this.slugify(input.name);

    const existing = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.departmentId, input.departmentId), eq(sections.slug, slug)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`Section slug "${slug}" already exists in this department`);
    }

    const [inserted] = await db
      .insert(sections)
      .values({
        departmentId: input.departmentId,
        name: input.name,
        slug,
        status: input.status || 'active',
      })
      .returning({ id: sections.id });

    return this.getSectionById(inserted.id, requester);
  }

  async updateSection(
    id: string,
    input: UpdateSectionInput,
    requester: { id: string; isAdmin: boolean }
  ): Promise<SectionDetail> {
    const [current] = await db
      .select({ id: sections.id, departmentId: sections.departmentId, slug: sections.slug })
      .from(sections)
      .where(eq(sections.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Section not found');
    }

    await assertCanManageDepartment(requester.id, requester.isAdmin, current.departmentId);

    if (input.slug && input.slug !== current.slug) {
      const existing = await db
        .select({ id: sections.id })
        .from(sections)
        .where(
          and(
            eq(sections.departmentId, current.departmentId),
            eq(sections.slug, input.slug),
            sql`${sections.id} != ${id}`
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError(`Section slug "${input.slug}" already exists in this department`);
      }
    }

    const updateData: Partial<typeof sections.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.status !== undefined) updateData.status = input.status;

    await db.update(sections).set(updateData).where(eq(sections.id, id));

    return this.getSectionById(id, requester);
  }

  async updateSectionStatus(
    id: string,
    status: 'active' | 'inactive',
    requester: { id: string; isAdmin: boolean }
  ): Promise<SectionDetail> {
    const [current] = await db
      .select({ id: sections.id, departmentId: sections.departmentId })
      .from(sections)
      .where(eq(sections.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Section not found');
    }

    await assertCanManageDepartment(requester.id, requester.isAdmin, current.departmentId);

    await db
      .update(sections)
      .set({ status, updatedAt: new Date() })
      .where(eq(sections.id, id));

    return this.getSectionById(id, requester);
  }

  async deleteSection(id: string, requester: { id: string; isAdmin: boolean }): Promise<void> {
    const [current] = await db
      .select({ id: sections.id, departmentId: sections.departmentId })
      .from(sections)
      .where(eq(sections.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Section not found');
    }

    await assertCanManageDepartment(requester.id, requester.isAdmin, current.departmentId);

    await db.delete(sections).where(eq(sections.id, id));
  }

  /**
   * Evaluates if a caller has access to the section in the given venture.
   */
  async checkAccess(
    ventureParam: string,
    sectionSlug: string,
    userId: string,
    isAdmin: boolean
  ): Promise<{ hasAccess: boolean; section?: SectionDetail; reason?: string }> {
    // 1. Resolve venture and section
    const conditions = [eq(sections.slug, sectionSlug)];
    if (ventureParam) {
      conditions.push(or(eq(ventures.slug, ventureParam), eq(ventures.id, ventureParam))!);
    }

    const matchingSections = await db
      .select({
        id: sections.id,
        departmentId: sections.departmentId,
        departmentName: departments.name,
        departmentSlug: departments.slug,
        deptHeadUserId: departments.headUserId,
        ventureId: departments.ventureId,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        name: sections.name,
        slug: sections.slug,
        status: sections.status,
        createdAt: sections.createdAt,
        updatedAt: sections.updatedAt,
      })
      .from(sections)
      .innerJoin(departments, eq(sections.departmentId, departments.id))
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .where(and(...conditions));

    if (matchingSections.length === 0) {
      return { hasAccess: false, reason: 'Section not found for this venture' };
    }

    let sectionRow = matchingSections[0];
    if (matchingSections.length > 1 && !isAdmin) {
      const userVentureMemberships = await db
        .select({ ventureId: userMemberships.ventureId, departmentId: userMemberships.departmentId })
        .from(userMemberships)
        .where(eq(userMemberships.userId, userId));

      const found = matchingSections.find((s) =>
        userVentureMemberships.some((m) => m.departmentId === s.departmentId)
      );
      if (found) {
        sectionRow = found;
      }
    }

    const detail: SectionDetail = {
      id: sectionRow.id,
      departmentId: sectionRow.departmentId,
      departmentName: sectionRow.departmentName,
      departmentSlug: sectionRow.departmentSlug,
      ventureId: sectionRow.ventureId,
      ventureName: sectionRow.ventureName,
      ventureSlug: sectionRow.ventureSlug,
      name: sectionRow.name,
      slug: sectionRow.slug,
      route: `/${sectionRow.ventureSlug}/${sectionRow.slug}`,
      status: sectionRow.status as 'active' | 'inactive',
      createdAt: sectionRow.createdAt.toISOString(),
      updatedAt: sectionRow.updatedAt.toISOString(),
    };

    // Operational access to disabled sections is blocked for all roles
    if (sectionRow.status !== 'active') {
      return { hasAccess: false, section: detail, reason: 'This section is currently disabled' };
    }

    if (isAdmin) {
      return { hasAccess: true, section: detail };
    }

    // Check if caller has membership in this venture and department
    const [membership] = await db
      .select({ id: userMemberships.id })
      .from(userMemberships)
      .where(
        and(
          eq(userMemberships.userId, userId),
          eq(userMemberships.ventureId, sectionRow.ventureId),
          eq(userMemberships.departmentId, sectionRow.departmentId)
        )
      )
      .limit(1);

    if (!membership) {
      return { hasAccess: false, section: detail, reason: 'You do not belong to the department that owns this section' };
    }

    // If caller is the designated Department Head, they inherit section access
    if (sectionRow.deptHeadUserId === userId) {
      return { hasAccess: true, section: detail };
    }

    // Check if user has explicit section assignment
    const [assignment] = await db
      .select({ id: userSections.id })
      .from(userSections)
      .where(and(eq(userSections.userId, userId), eq(userSections.sectionId, sectionRow.id)))
      .limit(1);

    if (!assignment) {
      return { hasAccess: false, section: detail, reason: 'Access to this section has not been granted to your account' };
    }

    return { hasAccess: true, section: detail };
  }
}

export const sectionsService = new SectionsService();
