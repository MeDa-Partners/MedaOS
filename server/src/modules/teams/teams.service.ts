import { and, asc, eq, inArray, ne, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { teams, departments, ventures, users, userMemberships } from '../../db/schema';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { Actor, Authority, canManageDepartment, loadAuthority } from '../../utils/access';
import { CreateTeamInput, UpdateTeamInput } from './teams.validation';
import { TeamDetail } from './teams.types';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const teamColumns = {
  id: teams.id,
  departmentId: teams.departmentId,
  departmentName: departments.name,
  departmentSlug: departments.slug,
  ventureId: departments.ventureId,
  ventureName: ventures.name,
  ventureSlug: ventures.slug,
  name: teams.name,
  slug: teams.slug,
  headUserId: teams.headUserId,
  headUserName: users.name,
  headUserEmail: users.email,
  status: teams.status,
  createdAt: teams.createdAt,
  updatedAt: teams.updatedAt,
};

export class TeamsService {
  /** Departments whose teams the actor may see: ones they belong to or lead. */
  private async visibleDepartmentIds(auth: Authority): Promise<string[]> {
    const rows = await db
      .select({ departmentId: userMemberships.departmentId })
      .from(userMemberships)
      .where(eq(userMemberships.userId, auth.userId));
    return Array.from(new Set([...rows.map((r) => r.departmentId), ...auth.departmentsLed]));
  }

  private async query(where: SQL | undefined, auth: Authority): Promise<TeamDetail[]> {
    const rows = await db
      .select(teamColumns)
      .from(teams)
      .innerJoin(departments, eq(teams.departmentId, departments.id))
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .leftJoin(users, eq(teams.headUserId, users.id))
      .where(where)
      .orderBy(asc(departments.name), asc(teams.name));

    const ids = rows.map((r) => r.id);
    const counts = ids.length
      ? await db
          .select({ teamId: userMemberships.teamId, count: sql<number>`count(*)::int` })
          .from(userMemberships)
          .where(inArray(userMemberships.teamId, ids))
          .groupBy(userMemberships.teamId)
      : [];
    const countMap = new Map(counts.map((c) => [c.teamId, c.count]));

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
      headUserId: r.headUserId,
      headUser:
        r.headUserId && r.headUserName
          ? { id: r.headUserId, name: r.headUserName, email: r.headUserEmail || '' }
          : null,
      status: r.status,
      memberCount: countMap.get(r.id) || 0,
      canManage: canManageDepartment(auth, r.departmentId),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async listTeams(options: { departmentId?: string; ventureId?: string }, actor: Actor): Promise<TeamDetail[]> {
    const auth = await loadAuthority(actor);
    const conditions: SQL[] = [];
    if (options.departmentId) conditions.push(eq(teams.departmentId, options.departmentId));
    if (options.ventureId) conditions.push(eq(departments.ventureId, options.ventureId));
    if (!auth.isAdmin) {
      const visible = await this.visibleDepartmentIds(auth);
      if (visible.length === 0) return [];
      conditions.push(inArray(teams.departmentId, visible));
    }
    return this.query(and(...conditions), auth);
  }

  async getTeam(id: string, actor: Actor): Promise<TeamDetail> {
    const auth = await loadAuthority(actor);
    const [team] = await this.query(eq(teams.id, id), auth);
    if (!team) throw new NotFoundError('Team not found');

    if (!auth.isAdmin) {
      const visible = await this.visibleDepartmentIds(auth);
      if (!visible.includes(team.departmentId)) throw new NotFoundError('Team not found');
    }

    const members = await db
      .select({ id: users.id, name: users.name, email: users.email, status: users.status })
      .from(userMemberships)
      .innerJoin(users, eq(userMemberships.userId, users.id))
      .where(eq(userMemberships.teamId, id))
      .orderBy(asc(users.name));

    return {
      ...team,
      members: members.map((m) => ({ ...m, isTeamHead: m.id === team.headUserId })),
    };
  }

  private async getManageableTeam(id: string, auth: Authority) {
    const [team] = await db
      .select({ id: teams.id, departmentId: teams.departmentId, slug: teams.slug })
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);
    if (!team) throw new NotFoundError('Team not found');
    if (!canManageDepartment(auth, team.departmentId)) {
      throw new ForbiddenError('Only an administrator or the head of this department can manage its teams.');
    }
    return team;
  }

  private async assertSlugFree(departmentId: string, slug: string, exceptId?: string) {
    const [clash] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(eq(teams.departmentId, departmentId), eq(teams.slug, slug), exceptId ? ne(teams.id, exceptId) : undefined)
      )
      .limit(1);
    if (clash) throw new ConflictError(`A team called "${slug}" already exists in this department.`);
  }

  async createTeam(input: CreateTeamInput, actor: Actor): Promise<TeamDetail> {
    const auth = await loadAuthority(actor);
    if (!canManageDepartment(auth, input.departmentId)) {
      throw new ForbiddenError('Only an administrator or the head of this department can create teams in it.');
    }

    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);
    if (!dept) throw new NotFoundError('Department not found');

    const slug = input.slug || slugify(input.name);
    if (!slug) throw new BadRequestError('Team name must contain letters or numbers.');
    await this.assertSlugFree(input.departmentId, slug);

    const [created] = await db
      .insert(teams)
      .values({ departmentId: input.departmentId, name: input.name, slug, status: 'active' })
      .returning({ id: teams.id });

    return this.getTeam(created.id, actor);
  }

  async updateTeam(id: string, input: UpdateTeamInput, actor: Actor): Promise<TeamDetail> {
    const auth = await loadAuthority(actor);
    const team = await this.getManageableTeam(id, auth);

    const slug = input.slug ?? (input.name ? slugify(input.name) : undefined);
    if (slug && slug !== team.slug) await this.assertSlugFree(team.departmentId, slug, id);

    await db
      .update(teams)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(slug !== undefined && { slug }),
        ...(input.status !== undefined && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id));

    return this.getTeam(id, actor);
  }

  /** Appoint (or clear) the team head. The person must already be in this team. */
  async assignHead(id: string, headUserId: string | null, actor: Actor): Promise<TeamDetail> {
    const auth = await loadAuthority(actor);
    const team = await this.getManageableTeam(id, auth);

    if (headUserId) {
      const [member] = await db
        .select({ status: users.status })
        .from(userMemberships)
        .innerJoin(users, eq(userMemberships.userId, users.id))
        .where(and(eq(userMemberships.userId, headUserId), eq(userMemberships.teamId, team.id)))
        .limit(1);
      if (!member) throw new BadRequestError('Add this person to the team before making them its head.');
      if (member.status !== 'active') throw new BadRequestError('An inactive person cannot be a team head.');
    }

    await db.update(teams).set({ headUserId, updatedAt: new Date() }).where(eq(teams.id, id));
    return this.getTeam(id, actor);
  }

  /** Deletes the team. Its members stay in the department without a team. */
  async deleteTeam(id: string, actor: Actor): Promise<void> {
    const auth = await loadAuthority(actor);
    await this.getManageableTeam(id, auth);
    await db.transaction(async (tx) => {
      await tx
        .update(userMemberships)
        .set({ teamId: null, updatedAt: new Date() })
        .where(eq(userMemberships.teamId, id));
      await tx.delete(teams).where(eq(teams.id, id));
    });
  }
}

export const teamsService = new TeamsService();
