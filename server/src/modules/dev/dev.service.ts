import { eq, and, sql, asc } from 'drizzle-orm';
import { db } from '../../db';
import {
  ventures,
  departments,
  teams,
  sections,
  userMemberships,
  userSections,
} from '../../db/schema';
import {
  SUPPORTED_SECTIONS,
  SUPPORTED_VENTURES,
  isSectionImplemented,
  isVentureSupported,
  getFeatureRegistryOverview,
} from '../../config/feature-registry';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../utils/errors';
import {
  DevCreateVentureInput,
  DevUpdateVentureInput,
  DevCreateDepartmentInput,
  DevUpdateDepartmentInput,
  DevCreateSectionInput,
  DevUpdateSectionInput,
} from './dev.validation';

export class DevService {
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  getFeatureRegistry() {
    return getFeatureRegistryOverview();
  }

  /**
   * Returns a comprehensive overview of the application catalog cross-referenced
   * with the code-level Feature Registry and employee assignment counts.
   */
  async getCatalogOverview() {
    const [allVentures, allDepts, allTeams, allSecs, membershipCounts, sectionUserCounts] =
      await Promise.all([
        db
          .select()
          .from(ventures)
          .orderBy(asc(ventures.name)),
        db
          .select()
          .from(departments)
          .orderBy(asc(departments.name)),
        db
          .select()
          .from(teams)
          .orderBy(asc(teams.name)),
        db
          .select()
          .from(sections)
          .orderBy(asc(sections.name)),
        db
          .select({
            ventureId: userMemberships.ventureId,
            departmentId: userMemberships.departmentId,
            teamId: userMemberships.teamId,
            count: sql<number>`count(*)::int`,
          })
          .from(userMemberships)
          .groupBy(
            userMemberships.ventureId,
            userMemberships.departmentId,
            userMemberships.teamId
          ),
        db
          .select({
            sectionId: userSections.sectionId,
            count: sql<number>`count(*)::int`,
          })
          .from(userSections)
          .groupBy(userSections.sectionId),
      ]);

    const ventureMemberMap = new Map<string, number>();
    const deptMemberMap = new Map<string, number>();
    const teamMemberMap = new Map<string, number>();
    for (const m of membershipCounts) {
      ventureMemberMap.set(m.ventureId, (ventureMemberMap.get(m.ventureId) || 0) + m.count);
      deptMemberMap.set(m.departmentId, (deptMemberMap.get(m.departmentId) || 0) + m.count);
      teamMemberMap.set(m.teamId, (teamMemberMap.get(m.teamId) || 0) + m.count);
    }

    const sectionUserMap = new Map<string, number>();
    for (const su of sectionUserCounts) {
      sectionUserMap.set(su.sectionId, su.count);
    }

    const ventureTree = allVentures.map((v) => {
      const vDepts = allDepts.filter((d) => d.ventureId === v.id);
      const isImplemented = isVentureSupported(v.slug);

      return {
        id: v.id,
        name: v.name,
        slug: v.slug,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        isSupportedInCode: isImplemented,
        codeRegistryDetails: SUPPORTED_VENTURES[v.slug.toLowerCase()] || null,
        employeeCount: ventureMemberMap.get(v.id) || 0,
        departmentCount: vDepts.length,
        departments: vDepts.map((d) => {
          const dTeams = allTeams.filter((t) => t.departmentId === d.id);
          const dSecs = allSecs.filter((s) => s.departmentId === d.id);

          return {
            id: d.id,
            ventureId: d.ventureId,
            name: d.name,
            slug: d.slug,
            headUserId: d.headUserId,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
            employeeCount: deptMemberMap.get(d.id) || 0,
            teamCount: dTeams.length,
            sectionCount: dSecs.length,
            teams: dTeams.map((t) => ({
              id: t.id,
              departmentId: t.departmentId,
              name: t.name,
              slug: t.slug,
              headUserId: t.headUserId,
              status: t.status,
              employeeCount: teamMemberMap.get(t.id) || 0,
            })),
            sections: dSecs.map((s) => {
              const secImplemented = isSectionImplemented(s.slug);
              return {
                id: s.id,
                departmentId: s.departmentId,
                name: s.name,
                slug: s.slug,
                status: s.status,
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString(),
                isImplementedInCode: secImplemented,
                codeRegistryDetails: SUPPORTED_SECTIONS[s.slug.toLowerCase()] || null,
                route: `/${v.slug}/${s.slug}`,
                assignedUserCount: sectionUserMap.get(s.id) || 0,
              };
            }),
          };
        }),
      };
    });

    return {
      registry: getFeatureRegistryOverview(),
      ventures: ventureTree,
      summary: {
        totalVentures: allVentures.length,
        totalDepartments: allDepts.length,
        totalTeams: allTeams.length,
        totalSections: allSecs.length,
      },
    };
  }

  // ===================== VENTURES =====================

  async listVentures() {
    return db.select().from(ventures).orderBy(asc(ventures.name));
  }

  async createVenture(input: DevCreateVentureInput) {
    const slug = input.slug ? this.slugify(input.slug) : this.slugify(input.name);

    const [existing] = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.slug, slug))
      .limit(1);

    if (existing) {
      throw new ConflictError(`Venture with slug "${slug}" already exists`);
    }

    const [created] = await db
      .insert(ventures)
      .values({
        name: input.name.trim(),
        slug,
        status: input.status,
      })
      .returning();

    return {
      ...created,
      isSupportedInCode: isVentureSupported(created.slug),
    };
  }

  async updateVenture(id: string, input: DevUpdateVentureInput) {
    const [current] = await db
      .select()
      .from(ventures)
      .where(eq(ventures.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Venture not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const slug = this.slugify(input.slug);
      const [existing] = await db
        .select({ id: ventures.id })
        .from(ventures)
        .where(and(eq(ventures.slug, slug), sql`${ventures.id} != ${id}`))
        .limit(1);

      if (existing) {
        throw new ConflictError(`Venture with slug "${slug}" already exists`);
      }
    }

    const updateData: Partial<typeof ventures.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name) updateData.name = input.name.trim();
    if (input.slug) updateData.slug = this.slugify(input.slug);
    if (input.status) updateData.status = input.status;

    const [updated] = await db
      .update(ventures)
      .set(updateData)
      .where(eq(ventures.id, id))
      .returning();

    return {
      ...updated,
      isSupportedInCode: isVentureSupported(updated.slug),
    };
  }

  async deleteVenture(id: string, force: boolean = false) {
    const [current] = await db
      .select()
      .from(ventures)
      .where(eq(ventures.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Venture not found');
    }

    // Safety check: check dependent departments and employee memberships
    const [deptCountResult, memberCountResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(departments)
        .where(eq(departments.ventureId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userMemberships)
        .where(eq(userMemberships.ventureId, id)),
    ]);

    const deptCount = deptCountResult[0]?.count || 0;
    const memberCount = memberCountResult[0]?.count || 0;

    if ((deptCount > 0 || memberCount > 0) && !force) {
      throw new BadRequestError(
        `Cannot delete venture "${current.name}": it has ${deptCount} department(s) and ${memberCount} employee assignment(s). Deactivate the venture instead, or remove its departments and employee assignments first.`
      );
    }

    await db.delete(ventures).where(eq(ventures.id, id));
  }

  // ===================== DEPARTMENTS =====================

  async listDepartments(ventureId?: string) {
    let query = db
      .select({
        id: departments.id,
        ventureId: departments.ventureId,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        name: departments.name,
        slug: departments.slug,
        headUserId: departments.headUserId,
        status: departments.status,
        createdAt: departments.createdAt,
        updatedAt: departments.updatedAt,
      })
      .from(departments)
      .innerJoin(ventures, eq(departments.ventureId, ventures.id));

    if (ventureId) {
      return query.where(eq(departments.ventureId, ventureId)).orderBy(asc(departments.name));
    }
    return query.orderBy(asc(ventures.name), asc(departments.name));
  }

  async createDepartment(input: DevCreateDepartmentInput) {
    const [v] = await db
      .select({ id: ventures.id, name: ventures.name })
      .from(ventures)
      .where(eq(ventures.id, input.ventureId))
      .limit(1);

    if (!v) {
      throw new NotFoundError('Target venture does not exist');
    }

    const slug = input.slug ? this.slugify(input.slug) : this.slugify(input.name);

    const [existing] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.ventureId, input.ventureId), eq(departments.slug, slug)))
      .limit(1);

    if (existing) {
      throw new ConflictError(
        `Department with slug "${slug}" already exists in venture "${v.name}"`
      );
    }

    const [created] = await db
      .insert(departments)
      .values({
        ventureId: input.ventureId,
        name: input.name.trim(),
        slug,
        status: input.status,
      })
      .returning();

    return created;
  }

  async updateDepartment(id: string, input: DevUpdateDepartmentInput) {
    const [current] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Department not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const slug = this.slugify(input.slug);
      const [existing] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(
          and(
            eq(departments.ventureId, current.ventureId),
            eq(departments.slug, slug),
            sql`${departments.id} != ${id}`
          )
        )
        .limit(1);

      if (existing) {
        throw new ConflictError(
          `Department with slug "${slug}" already exists in this venture`
        );
      }
    }

    const updateData: Partial<typeof departments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name) updateData.name = input.name.trim();
    if (input.slug) updateData.slug = this.slugify(input.slug);
    if (input.status) updateData.status = input.status;

    const [updated] = await db
      .update(departments)
      .set(updateData)
      .where(eq(departments.id, id))
      .returning();

    return updated;
  }

  async deleteDepartment(id: string, force: boolean = false) {
    const [current] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Department not found');
    }

    const [teamCountResult, sectionCountResult, memberCountResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(teams)
        .where(eq(teams.departmentId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sections)
        .where(eq(sections.departmentId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userMemberships)
        .where(eq(userMemberships.departmentId, id)),
    ]);

    const teamCount = teamCountResult[0]?.count || 0;
    const sectionCount = sectionCountResult[0]?.count || 0;
    const memberCount = memberCountResult[0]?.count || 0;

    if ((teamCount > 0 || sectionCount > 0 || memberCount > 0) && !force) {
      throw new BadRequestError(
        `Cannot delete department "${current.name}": it has ${teamCount} team(s), ${sectionCount} section(s), and ${memberCount} employee assignment(s). Deactivate the department instead, or remove its dependent teams and sections first.`
      );
    }

    await db.delete(departments).where(eq(departments.id, id));
  }

  // ===================== SECTIONS =====================

  async listSections(departmentId?: string, ventureId?: string) {
    let query = db
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
      .innerJoin(ventures, eq(departments.ventureId, ventures.id));

    if (departmentId) {
      return query.where(eq(sections.departmentId, departmentId)).orderBy(asc(sections.name));
    }
    if (ventureId) {
      return query.where(eq(departments.ventureId, ventureId)).orderBy(asc(sections.name));
    }

    const rows = await query.orderBy(asc(ventures.name), asc(departments.name), asc(sections.name));
    return rows.map((r) => ({
      ...r,
      isImplementedInCode: isSectionImplemented(r.slug),
      route: `/${r.ventureSlug}/${r.slug}`,
    }));
  }

  async createSection(input: DevCreateSectionInput) {
    const [dept] = await db
      .select({
        id: departments.id,
        name: departments.name,
        ventureId: departments.ventureId,
      })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);

    if (!dept) {
      throw new NotFoundError('Target department does not exist');
    }

    const slug = input.slug ? this.slugify(input.slug) : this.slugify(input.name);

    // Verify uniqueness within this department
    const [existing] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.departmentId, input.departmentId), eq(sections.slug, slug)))
      .limit(1);

    if (existing) {
      throw new ConflictError(
        `Section with slug "${slug}" already exists in department "${dept.name}". Note: The same section slug can exist in other departments, but must be unique within "${dept.name}".`
      );
    }

    const [created] = await db
      .insert(sections)
      .values({
        departmentId: input.departmentId,
        name: input.name.trim(),
        slug,
        status: input.status,
      })
      .returning();

    const isImplemented = isSectionImplemented(created.slug);

    return {
      ...created,
      isImplementedInCode: isImplemented,
      codeImplementationDetails: SUPPORTED_SECTIONS[created.slug.toLowerCase()] || null,
    };
  }

  async updateSection(id: string, input: DevUpdateSectionInput) {
    const [current] = await db
      .select()
      .from(sections)
      .where(eq(sections.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Section not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const slug = this.slugify(input.slug);
      const [existing] = await db
        .select({ id: sections.id })
        .from(sections)
        .where(
          and(
            eq(sections.departmentId, current.departmentId),
            eq(sections.slug, slug),
            sql`${sections.id} != ${id}`
          )
        )
        .limit(1);

      if (existing) {
        throw new ConflictError(
          `Section with slug "${slug}" already exists in this department`
        );
      }
    }

    const updateData: Partial<typeof sections.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name) updateData.name = input.name.trim();
    if (input.slug) updateData.slug = this.slugify(input.slug);
    if (input.status) updateData.status = input.status;

    const [updated] = await db
      .update(sections)
      .set(updateData)
      .where(eq(sections.id, id))
      .returning();

    return {
      ...updated,
      isImplementedInCode: isSectionImplemented(updated.slug),
      codeImplementationDetails: SUPPORTED_SECTIONS[updated.slug.toLowerCase()] || null,
    };
  }

  async deleteSection(id: string, force: boolean = false) {
    const [current] = await db
      .select()
      .from(sections)
      .where(eq(sections.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Section not found');
    }

    const [userCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSections)
      .where(eq(userSections.sectionId, id));

    const userCount = userCountResult?.count || 0;

    if (userCount > 0 && !force) {
      throw new BadRequestError(
        `Cannot delete section "${current.name}": it is currently assigned to ${userCount} employee(s). Deactivate the section instead to disable access without corrupting assignment records, or revoke user grants first.`
      );
    }

    await db.delete(sections).where(eq(sections.id, id));
  }
}

export const devService = new DevService();
