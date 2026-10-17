import { and, asc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { departments, ventures, users, teams, sections, userMemberships } from '../../db/schema';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { Actor, Authority, canManageDepartment, loadAuthority } from '../../utils/access';
import { DepartmentItem } from './departments.types';

/**
 * Departments are catalog records created in /dev. Here they are read, and the
 * Global Admin appoints their heads.
 */
export class DepartmentsService {
  /** Departments the actor belongs to or leads (admins: all). */
  private async visibleIds(auth: Authority): Promise<string[] | null> {
    if (auth.isAdmin) return null;
    const rows = await db
      .select({ departmentId: userMemberships.departmentId })
      .from(userMemberships)
      .where(eq(userMemberships.userId, auth.userId));
    return Array.from(new Set([...rows.map((r) => r.departmentId), ...auth.departmentsLed]));
  }

  private async query(where: SQL | undefined, auth: Authority): Promise<DepartmentItem[]> {
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
      .where(where)
      .orderBy(asc(ventures.name), asc(departments.name));

    const ids = rows.map((r) => r.id);
    const [teamCounts, sectionCounts, memberCounts] = ids.length
      ? await Promise.all([
          db
            .select({ id: teams.departmentId, count: sql<number>`count(*)::int` })
            .from(teams)
            .where(inArray(teams.departmentId, ids))
            .groupBy(teams.departmentId),
          db
            .select({ id: sections.departmentId, count: sql<number>`count(*)::int` })
            .from(sections)
            .where(inArray(sections.departmentId, ids))
            .groupBy(sections.departmentId),
          db
            .select({ id: userMemberships.departmentId, count: sql<number>`count(*)::int` })
            .from(userMemberships)
            .where(inArray(userMemberships.departmentId, ids))
            .groupBy(userMemberships.departmentId),
        ])
      : [[], [], []];

    const toMap = (list: { id: string; count: number }[]) => new Map(list.map((c) => [c.id, c.count]));
    const teamMap = toMap(teamCounts);
    const sectionMap = toMap(sectionCounts);
    const memberMap = toMap(memberCounts);

    return rows.map((r) => ({
      id: r.id,
      ventureId: r.ventureId,
      ventureName: r.ventureName,
      ventureSlug: r.ventureSlug,
      name: r.name,
      slug: r.slug,
      headUserId: r.headUserId,
      headUser:
        r.headUserId && r.headUserName
          ? { id: r.headUserId, name: r.headUserName, email: r.headUserEmail || '' }
          : null,
      status: r.status,
      teamCount: teamMap.get(r.id) || 0,
      sectionCount: sectionMap.get(r.id) || 0,
      memberCount: memberMap.get(r.id) || 0,
      canManage: canManageDepartment(auth, r.id),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async listDepartments(options: { ventureId?: string }, actor: Actor): Promise<DepartmentItem[]> {
    const auth = await loadAuthority(actor);
    const visible = await this.visibleIds(auth);
    if (visible && visible.length === 0) return [];

    return this.query(
      and(
        options.ventureId ? eq(departments.ventureId, options.ventureId) : undefined,
        visible ? inArray(departments.id, visible) : undefined
      ),
      auth
    );
  }

  async getDepartment(id: string, actor: Actor): Promise<DepartmentItem> {
    const auth = await loadAuthority(actor);
    const visible = await this.visibleIds(auth);
    if (visible && !visible.includes(id)) throw new NotFoundError('Department not found');

    const [dept] = await this.query(eq(departments.id, id), auth);
    if (!dept) throw new NotFoundError('Department not found');
    return dept;
  }

  /** Global Admin appoints (or clears) a department head. The person must be in the department. */
  async assignHead(id: string, headUserId: string | null, actor: Actor): Promise<DepartmentItem> {
    if (!actor.isAdmin) {
      throw new ForbiddenError('Only administrators can appoint department heads.');
    }

    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    if (!dept) throw new NotFoundError('Department not found');

    if (headUserId) {
      const [member] = await db
        .select({ status: users.status })
        .from(userMemberships)
        .innerJoin(users, eq(userMemberships.userId, users.id))
        .where(and(eq(userMemberships.userId, headUserId), eq(userMemberships.departmentId, id)))
        .limit(1);
      if (!member) {
        throw new BadRequestError('Add this person to the department before making them its head.');
      }
      if (member.status !== 'active') {
        throw new BadRequestError('An inactive person cannot be a department head.');
      }
    }

    await db.update(departments).set({ headUserId, updatedAt: new Date() }).where(eq(departments.id, id));
    return this.getDepartment(id, actor);
  }
}

export const departmentsService = new DepartmentsService();
