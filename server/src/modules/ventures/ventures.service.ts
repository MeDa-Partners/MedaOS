import { eq, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { ventures, departments, teams, sections, userMemberships, users } from '../../db/schema';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { CreateVentureInput, UpdateVentureInput } from './ventures.validation';
import { VentureResponse } from './ventures.types';

export class VenturesService {
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Lists ventures. Global Admin sees all; others see active ventures they belong to.
   */
  async listVentures(requester?: { id: string; isAdmin: boolean }): Promise<VentureResponse[]> {
    let ventureRows;

    if (!requester || requester.isAdmin) {
      ventureRows = await db
        .select()
        .from(ventures)
        .orderBy(asc(ventures.createdAt), asc(ventures.name));
    } else {
      // Find venture IDs caller belongs to or leads
      const [memberships, deptLeads] = await Promise.all([
        db
          .select({ ventureId: userMemberships.ventureId })
          .from(userMemberships)
          .where(eq(userMemberships.userId, requester.id)),
        db
          .select({ ventureId: departments.ventureId })
          .from(departments)
          .where(eq(departments.headUserId, requester.id)),
      ]);

      const allowedIds = Array.from(
        new Set([...memberships.map((m) => m.ventureId), ...deptLeads.map((d) => d.ventureId)])
      );

      if (allowedIds.length === 0) {
        return [];
      }

      ventureRows = await db
        .select()
        .from(ventures)
        .where(inArray(ventures.id, allowedIds))
        .orderBy(asc(ventures.createdAt), asc(ventures.name));
    }

    const ventureIds = ventureRows.map((v) => v.id);
    let deptCounts = new Map<string, number>();
    let memberCounts = new Map<string, number>();

    if (ventureIds.length > 0) {
      const [dCounts, mCounts] = await Promise.all([
        db
          .select({
            ventureId: departments.ventureId,
            count: sql<number>`count(*)::int`,
          })
          .from(departments)
          .groupBy(departments.ventureId),
        db
          .select({
            ventureId: userMemberships.ventureId,
            count: sql<number>`count(*)::int`,
          })
          .from(userMemberships)
          .groupBy(userMemberships.ventureId),
      ]);

      dCounts.forEach((c) => deptCounts.set(c.ventureId, c.count));
      mCounts.forEach((c) => memberCounts.set(c.ventureId, c.count));
    }

    return ventureRows.map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      status: v.status,
      departmentCount: deptCounts.get(v.id) || 0,
      employeeCount: memberCounts.get(v.id) || 0,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves single venture by ID with departments, teams, sections.
   */
  async getVentureById(id: string): Promise<VentureResponse> {
    const [v] = await db
      .select()
      .from(ventures)
      .where(eq(ventures.id, id))
      .limit(1);

    if (!v) {
      throw new NotFoundError(`Venture with id "${id}" not found`);
    }

    // Load departments
    const deptRows = await db
      .select({
        id: departments.id,
        name: departments.name,
        slug: departments.slug,
        headUserId: departments.headUserId,
        headUserName: users.name,
        status: departments.status,
      })
      .from(departments)
      .leftJoin(users, eq(departments.headUserId, users.id))
      .where(eq(departments.ventureId, id));

    const deptIds = deptRows.map((d) => d.id);
    let allTeams: { id: string; departmentId: string; name: string; slug: string; headUserId: string | null; status: string }[] = [];
    let allSections: { id: string; departmentId: string; name: string; slug: string; status: string }[] = [];

    if (deptIds.length > 0) {
      [allTeams, allSections] = await Promise.all([
        db
          .select({
            id: teams.id,
            departmentId: teams.departmentId,
            name: teams.name,
            slug: teams.slug,
            headUserId: teams.headUserId,
            status: teams.status,
          })
          .from(teams)
          .where(inArray(teams.departmentId, deptIds)),
        db
          .select({
            id: sections.id,
            departmentId: sections.departmentId,
            name: sections.name,
            slug: sections.slug,
            status: sections.status,
          })
          .from(sections)
          .where(inArray(sections.departmentId, deptIds)),
      ]);
    }

    const deptDetails = deptRows.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      headUserId: d.headUserId,
      headUserName: d.headUserName,
      status: d.status,
      teams: allTeams.filter((t) => t.departmentId === d.id),
      sections: allSections.filter((s) => s.departmentId === d.id),
    }));

    return {
      id: v.id,
      name: v.name,
      slug: v.slug,
      status: v.status,
      departmentCount: deptRows.length,
      departments: deptDetails,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }

  async createVenture(input: CreateVentureInput): Promise<VentureResponse> {
    const slug = input.slug || this.slugify(input.name);

    const existing = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`Venture slug "${slug}" is already in use`);
    }

    const [inserted] = await db
      .insert(ventures)
      .values({
        name: input.name,
        slug,
        status: input.status || 'active',
      })
      .returning();

    return {
      id: inserted.id,
      name: inserted.name,
      slug: inserted.slug,
      status: inserted.status,
      departmentCount: 0,
      departments: [],
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    };
  }

  async updateVenture(id: string, input: UpdateVentureInput): Promise<VentureResponse> {
    const [current] = await db
      .select()
      .from(ventures)
      .where(eq(ventures.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError(`Venture with ID ${id} not found`);
    }

    if (input.slug && input.slug !== current.slug) {
      const existing = await db
        .select({ id: ventures.id })
        .from(ventures)
        .where(eq(ventures.slug, input.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError(`Venture slug "${input.slug}" is already in use`);
      }
    }

    const updateData: Partial<typeof ventures.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.status !== undefined) updateData.status = input.status;

    await db.update(ventures).set(updateData).where(eq(ventures.id, id));

    return this.getVentureById(id);
  }

  async deleteVenture(id: string): Promise<void> {
    const [current] = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError(`Venture with ID ${id} not found`);
    }

    await db.delete(ventures).where(eq(ventures.id, id));
  }
}

export const venturesService = new VenturesService();
