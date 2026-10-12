import { eq, and, sql, asc } from 'drizzle-orm';
import { db } from '../../db';
import { teams, departments, ventures, users, userMemberships } from '../../db/schema';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { CreateTeamInput, UpdateTeamInput } from './teams.validation';
import { TeamDetail } from './teams.types';
import { assertCanManageDepartment, assertCanManageTeam } from '../../utils/authorization';

export class TeamsService {
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async listTeams(
    options: { departmentId?: string; ventureId?: string } = {},
    requester: { id: string; isAdmin: boolean }
  ): Promise<TeamDetail[]> {
    const whereConditions = [];

    if (options.departmentId) {
      whereConditions.push(eq(teams.departmentId, options.departmentId));
    }
    if (options.ventureId) {
      whereConditions.push(eq(departments.ventureId, options.ventureId));
    }

    if (!requester.isAdmin) {
      whereConditions.push(eq(teams.status, 'active'));
    }

    const rows = await db
      .select({
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
      })
      .from(teams)
      .innerJoin(departments, eq(teams.departmentId, departments.id))
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .leftJoin(users, eq(teams.headUserId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(asc(teams.createdAt), asc(teams.name));

    // Calculate member counts
    const teamIds = rows.map((r) => r.id);
    let memberCounts = new Map<string, number>();

    if (teamIds.length > 0) {
      const counts = await db
        .select({
          teamId: userMemberships.teamId,
          count: sql<number>`count(*)::int`,
        })
        .from(userMemberships)
        .groupBy(userMemberships.teamId);

      counts.forEach((c) => memberCounts.set(c.teamId, c.count));
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
      memberCount: memberCounts.get(r.id) || 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getTeamById(id: string, _requester: { id: string; isAdmin: boolean }): Promise<TeamDetail> {
    const [row] = await db
      .select({
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
      })
      .from(teams)
      .innerJoin(departments, eq(teams.departmentId, departments.id))
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .leftJoin(users, eq(teams.headUserId, users.id))
      .where(eq(teams.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundError(`Team with id "${id}" not found`);
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

  async createTeam(
    input: CreateTeamInput,
    requester: { id: string; isAdmin: boolean }
  ): Promise<TeamDetail> {
    // Assert caller can manage the target department (Admin OR Department Head)
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
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.departmentId, input.departmentId), eq(teams.slug, slug)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`Team slug "${slug}" already exists in this department`);
    }

    if (input.headUserId) {
      throw new BadRequestError(
        'Team must be created and employee membership assigned before appointing a Team Head'
      );
    }

    const [inserted] = await db
      .insert(teams)
      .values({
        departmentId: input.departmentId,
        name: input.name,
        slug,
        headUserId: null,
        status: input.status || 'active',
      })
      .returning({ id: teams.id });

    return this.getTeamById(inserted.id, requester);
  }

  async updateTeam(
    id: string,
    input: UpdateTeamInput,
    requester: { id: string; isAdmin: boolean }
  ): Promise<TeamDetail> {
    // Assert caller can manage this team
    await assertCanManageTeam(requester.id, requester.isAdmin, id);

    const [current] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundError('Team not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const existing = await db
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(
            eq(teams.departmentId, current.departmentId),
            eq(teams.slug, input.slug),
            sql`${teams.id} != ${id}`
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError(`Team slug "${input.slug}" already exists in this department`);
      }
    }

    if (input.headUserId) {
      const [headUser] = await db
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.id, input.headUserId))
        .limit(1);

      if (!headUser) {
        throw new BadRequestError('Specified Team Head user does not exist');
      }

      if (headUser.status !== 'active') {
        throw new BadRequestError('Cannot appoint an inactive user as Team Head');
      }

      const [membership] = await db
        .select({ id: userMemberships.id })
        .from(userMemberships)
        .where(
          and(
            eq(userMemberships.userId, input.headUserId),
            eq(userMemberships.departmentId, current.departmentId),
            eq(userMemberships.teamId, id)
          )
        )
        .limit(1);

      if (!membership) {
        throw new BadRequestError(
          'User must belong to this team and department before being appointed Team Head'
        );
      }
    }

    const updateData: Partial<typeof teams.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.headUserId !== undefined) updateData.headUserId = input.headUserId;
    if (input.status !== undefined) updateData.status = input.status;

    await db.update(teams).set(updateData).where(eq(teams.id, id));

    return this.getTeamById(id, requester);
  }

  async assignHead(
    id: string,
    headUserId: string | null,
    requester: { id: string; isAdmin: boolean }
  ): Promise<TeamDetail> {
    // Both Global Admin and the Department Head can appoint or replace Team Heads
    const [team] = await db
      .select({ id: teams.id, departmentId: teams.departmentId })
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!team) {
      throw new NotFoundError('Team not found');
    }

    await assertCanManageDepartment(requester.id, requester.isAdmin, team.departmentId);

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
        throw new BadRequestError('Cannot appoint an inactive user as Team Head');
      }

      // Verify user has an active membership in this team and department
      const [membership] = await db
        .select({ id: userMemberships.id })
        .from(userMemberships)
        .where(
          and(
            eq(userMemberships.userId, headUserId),
            eq(userMemberships.departmentId, team.departmentId),
            eq(userMemberships.teamId, id)
          )
        )
        .limit(1);

      if (!membership) {
        throw new BadRequestError(
          'User must belong to this team and department before being appointed Team Head'
        );
      }
    }

    await db
      .update(teams)
      .set({ headUserId, updatedAt: new Date() })
      .where(eq(teams.id, id));

    return this.getTeamById(id, requester);
  }

  async deleteTeam(id: string, requester: { id: string; isAdmin: boolean }): Promise<void> {
    const [team] = await db
      .select({ id: teams.id, departmentId: teams.departmentId })
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!team) {
      throw new NotFoundError('Team not found');
    }

    await assertCanManageDepartment(requester.id, requester.isAdmin, team.departmentId);

    await db.transaction(async (tx) => {
      await tx.delete(teams).where(eq(teams.id, id));
    });
  }
}

export const teamsService = new TeamsService();
