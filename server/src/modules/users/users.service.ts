import { eq, inArray, sql, and, or, ilike, asc } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  teams,
  departments,
  ventures,
  sections,
  userMemberships,
  userSections,
  sessions,
} from '../../db/schema';
import { hashPassword } from '../../utils/crypto';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors';
import {
  CreateUserInput,
  UpdateUserInput,
  UpdateStatusInput,
  AssignMembershipInput,
  AssignSectionsInput,
} from './users.validation';
import { UserResponseItem } from './users.types';
import { getUserAuthorityContext, assertCanManageUser } from '../../utils/authorization';

export interface RequesterContext {
  id: string;
  isAdmin: boolean;
}

export class UsersService {
  /**
   * Hydrates full user response objects with venture, department, team memberships, and sections.
   */
  private async hydrateUsers(userIds: string[]): Promise<UserResponseItem[]> {
    if (userIds.length === 0) return [];

    // Fetch user records, memberships, and assigned sections in parallel
    const [userRecords, membershipRows, userSectionRows] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          isAdmin: users.isAdmin,
          status: users.status,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(inArray(users.id, userIds)),

      db
        .select({
          userId: userMemberships.userId,
          ventureId: ventures.id,
          ventureName: ventures.name,
          ventureSlug: ventures.slug,
          departmentId: departments.id,
          departmentName: departments.name,
          departmentSlug: departments.slug,
          deptHeadUserId: departments.headUserId,
          teamId: teams.id,
          teamName: teams.name,
          teamSlug: teams.slug,
          teamHeadUserId: teams.headUserId,
        })
        .from(userMemberships)
        .innerJoin(ventures, eq(userMemberships.ventureId, ventures.id))
        .innerJoin(departments, eq(userMemberships.departmentId, departments.id))
        .innerJoin(teams, eq(userMemberships.teamId, teams.id))
        .where(inArray(userMemberships.userId, userIds)),

      db
        .select({
          userId: userSections.userId,
          sectionId: sections.id,
          sectionName: sections.name,
          sectionSlug: sections.slug,
          departmentId: sections.departmentId,
          ventureSlug: ventures.slug,
        })
        .from(userSections)
        .innerJoin(sections, eq(userSections.sectionId, sections.id))
        .innerJoin(departments, eq(sections.departmentId, departments.id))
        .innerJoin(ventures, eq(departments.ventureId, ventures.id))
        .where(inArray(userSections.userId, userIds)),
    ]);

    // Map memberships & sections to each user
    const userMap = new Map<string, UserResponseItem>();
    for (const u of userRecords) {
      userMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        isAdmin: u.isAdmin,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        ventures: [],
      });
    }

    for (const m of membershipRows) {
      const userItem = userMap.get(m.userId);
      if (!userItem) continue;

      const userSecs = userSectionRows
        .filter((s) => s.userId === m.userId && s.departmentId === m.departmentId)
        .map((s) => ({
          id: s.sectionId,
          name: s.sectionName,
          slug: s.sectionSlug,
          route: `/${s.ventureSlug}/${s.sectionSlug}`,
        }));

      userItem.ventures.push({
        ventureId: m.ventureId,
        ventureName: m.ventureName,
        ventureSlug: m.ventureSlug,
        departmentId: m.departmentId,
        departmentName: m.departmentName,
        departmentSlug: m.departmentSlug,
        isDepartmentHead: m.deptHeadUserId === m.userId,
        teamId: m.teamId,
        teamName: m.teamName,
        teamSlug: m.teamSlug,
        isTeamHead: m.teamHeadUserId === m.userId,
        sections: userSecs,
      });
    }

    // Preserve order of incoming userIds
    return userIds.map((id) => userMap.get(id)!).filter(Boolean);
  }

  /**
   * Lists employees. Scoped strictly to permitted venture+department+team scopes for non-admins.
   */
  async listUsers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      ventureId?: string;
      departmentId?: string;
      teamId?: string;
    } = {},
    requester?: RequesterContext
  ): Promise<{ users: UserResponseItem[]; total: number; page: number; limit: number }> {
    const reqContext = requester || { id: 'system', isAdmin: true };
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    const offset = (page - 1) * limit;

    let allowedScopeConditions: ReturnType<typeof sql>[] = [];

    if (!reqContext.isAdmin) {
      const auth = await getUserAuthorityContext(reqContext.id, false);
      if (auth.departmentsLed.length === 0 && auth.teamsLed.length === 0) {
        return { users: [], total: 0, page, limit };
      }

      if (auth.departmentsLed.length > 0) {
        allowedScopeConditions.push(
          inArray(userMemberships.departmentId, auth.departmentsLed)
        );
      }
      if (auth.teamsLed.length > 0) {
        allowedScopeConditions.push(
          inArray(userMemberships.teamId, auth.teamsLed)
        );
      }
    } else {
      if (options.teamId) {
        allowedScopeConditions.push(eq(userMemberships.teamId, options.teamId));
      } else if (options.departmentId) {
        allowedScopeConditions.push(eq(userMemberships.departmentId, options.departmentId));
      } else if (options.ventureId) {
        allowedScopeConditions.push(eq(userMemberships.ventureId, options.ventureId));
      }
    }

    const whereConditions = [];

    if (!reqContext.isAdmin) {
      whereConditions.push(eq(users.isAdmin, false));
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      whereConditions.push(or(ilike(users.name, term), ilike(users.email, term)));
    }

    let targetUserIdsQuery;
    let countQuery;

    if (allowedScopeConditions.length > 0) {
      const scopeClause = sql.join(allowedScopeConditions, sql` OR `);

      targetUserIdsQuery = db
        .selectDistinct({ id: users.id, createdAt: users.createdAt })
        .from(users)
        .innerJoin(userMemberships, eq(users.id, userMemberships.userId))
        .where(
          and(
            scopeClause,
            whereConditions.length > 0 ? and(...whereConditions) : undefined
          )
        )
        .orderBy(asc(users.createdAt), asc(users.id));

      countQuery = db
        .select({ count: sql<number>`count(distinct ${users.id})::int` })
        .from(users)
        .innerJoin(userMemberships, eq(users.id, userMemberships.userId))
        .where(
          and(
            scopeClause,
            whereConditions.length > 0 ? and(...whereConditions) : undefined
          )
        );
    } else {
      targetUserIdsQuery = db
        .select({ id: users.id, createdAt: users.createdAt })
        .from(users)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(asc(users.createdAt), asc(users.id));

      countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    }

    const [totalResult, userRows] = await Promise.all([
      countQuery,
      targetUserIdsQuery.limit(limit).offset(offset),
    ]);

    const total = totalResult[0]?.count || 0;
    const userIds = userRows.map((r) => r.id);
    const hydratedUsers = await this.hydrateUsers(userIds);

    return {
      users: hydratedUsers,
      total,
      page,
      limit,
    };
  }

  async getUserById(id: string, requester: RequesterContext): Promise<UserResponseItem> {
    await assertCanManageUser(requester.id, requester.isAdmin, id);
    const [user] = await this.hydrateUsers([id]);
    if (!user) {
      throw new NotFoundError(`User with id "${id}" not found`);
    }
    return user;
  }

  async createUser(input: CreateUserInput, requester: RequesterContext): Promise<UserResponseItem> {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`User with email "${input.email}" already exists`);
    }

    let targetVentureId = input.ventureId;
    let targetDeptId = input.departmentId;
    let targetTeamId = input.teamId;

    if (!requester.isAdmin) {
      // Non-admin creator must be a Department Head
      const auth = await getUserAuthorityContext(requester.id, false);
      if (auth.departmentsLed.length === 0) {
        throw new ForbiddenError('Only Global Administrators and Department Heads can create employee accounts');
      }

      if (!targetDeptId) {
        targetDeptId = auth.departmentsLed[0];
      } else if (!auth.departmentsLed.includes(targetDeptId)) {
        throw new ForbiddenError('You can only create employees in your own department');
      }

      // Resolve department venture
      const [dept] = await db
        .select({ id: departments.id, ventureId: departments.ventureId })
        .from(departments)
        .where(eq(departments.id, targetDeptId))
        .limit(1);

      if (!dept) {
        throw new BadRequestError('Specified department does not exist');
      }
      targetVentureId = dept.ventureId;
    }

    // Verify relationship: department belongs to venture, team belongs to department
    if (targetDeptId && targetVentureId) {
      const [dept] = await db
        .select({ id: departments.id, ventureId: departments.ventureId })
        .from(departments)
        .where(and(eq(departments.id, targetDeptId), eq(departments.ventureId, targetVentureId)))
        .limit(1);

      if (!dept) {
        throw new BadRequestError('Specified department does not belong to the selected venture');
      }
    }

    if (targetTeamId && targetDeptId) {
      const [team] = await db
        .select({ id: teams.id, departmentId: teams.departmentId })
        .from(teams)
        .where(and(eq(teams.id, targetTeamId), eq(teams.departmentId, targetDeptId)))
        .limit(1);

      if (!team) {
        throw new BadRequestError('Specified team does not belong to the selected department');
      }
    }

    // Verify sections belong to target department
    if (input.sectionIds && input.sectionIds.length > 0 && targetDeptId) {
      const validSections = await db
        .select({ id: sections.id })
        .from(sections)
        .where(and(eq(sections.departmentId, targetDeptId), inArray(sections.id, input.sectionIds)));

      if (validSections.length !== input.sectionIds.length) {
        throw new BadRequestError('One or more selected sections do not belong to the assigned department');
      }
    }

    const passwordHash = await hashPassword(input.password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        isAdmin: false,
        status: input.status || 'active',
      })
      .returning({ id: users.id });

    // Assign membership if venture, department, and team are provided
    if (targetVentureId && targetDeptId && targetTeamId) {
      await db.insert(userMemberships).values({
        userId: newUser.id,
        ventureId: targetVentureId,
        departmentId: targetDeptId,
        teamId: targetTeamId,
      });

      if (input.sectionIds && input.sectionIds.length > 0) {
        await db.insert(userSections).values(
          input.sectionIds.map((secId) => ({
            userId: newUser.id,
            sectionId: secId,
          }))
        );
      }
    }

    const [hydrated] = await this.hydrateUsers([newUser.id]);
    return hydrated;
  }

  async updateUser(id: string, input: UpdateUserInput, requester: RequesterContext): Promise<UserResponseItem> {
    await assertCanManageUser(requester.id, requester.isAdmin, id);

    if (input.email) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, input.email), sql`${users.id} != ${id}`))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError(`Email "${input.email}" is already in use`);
      }
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name) updateData.name = input.name;
    if (input.email) updateData.email = input.email;

    await db.update(users).set(updateData).where(eq(users.id, id));

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  async updateStatus(id: string, input: UpdateStatusInput, requester: RequesterContext): Promise<UserResponseItem> {
    await assertCanManageUser(requester.id, requester.isAdmin, id);

    if (id === requester.id && input.status === 'inactive') {
      throw new BadRequestError('You cannot deactivate your own account');
    }

    if (!requester.isAdmin) {
      if (id === requester.id) {
        throw new ForbiddenError('You cannot change your own account status');
      }
      const auth = await getUserAuthorityContext(requester.id, false);
      if (auth.departmentsLed.length === 0) {
        throw new ForbiddenError('Only Global Administrators and Department Heads can change user status');
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(users.id, id));

      if (input.status === 'inactive') {
        await tx.delete(sessions).where(eq(sessions.userId, id));
        // Revoke any leadership assignments for deactivated user
        await tx.update(departments).set({ headUserId: null }).where(eq(departments.headUserId, id));
        await tx.update(teams).set({ headUserId: null }).where(eq(teams.headUserId, id));
      }
    });

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  async assignMembership(
    id: string,
    input: AssignMembershipInput,
    requester: RequesterContext
  ): Promise<UserResponseItem> {
    await assertCanManageUser(requester.id, requester.isAdmin, id);

    if (!requester.isAdmin) {
      if (id === requester.id) {
        throw new ForbiddenError('You cannot modify your own organizational membership');
      }
      const auth = await getUserAuthorityContext(requester.id, false);
      if (!auth.departmentsLed.includes(input.departmentId)) {
        throw new ForbiddenError('You can only assign memberships within your own department');
      }
    }

    // Verify department belongs to venture
    const [dept] = await db
      .select({ id: departments.id, ventureId: departments.ventureId })
      .from(departments)
      .where(and(eq(departments.id, input.departmentId), eq(departments.ventureId, input.ventureId)))
      .limit(1);

    if (!dept) {
      throw new BadRequestError('Specified department does not belong to the selected venture');
    }

    // Verify team belongs to department
    const [team] = await db
      .select({ id: teams.id, departmentId: teams.departmentId })
      .from(teams)
      .where(and(eq(teams.id, input.teamId), eq(teams.departmentId, input.departmentId)))
      .limit(1);

    if (!team) {
      throw new BadRequestError('Specified team does not belong to the selected department');
    }

    await db.transaction(async (tx) => {
      // Check if membership already exists for this venture
      const [existing] = await tx
        .select({ id: userMemberships.id, departmentId: userMemberships.departmentId, teamId: userMemberships.teamId })
        .from(userMemberships)
        .where(and(eq(userMemberships.userId, id), eq(userMemberships.ventureId, input.ventureId)))
        .limit(1);

      if (existing) {
        // If moving out of department, revoke Department Head of old department and clean up sections
        if (existing.departmentId !== input.departmentId) {
          await tx
            .update(departments)
            .set({ headUserId: null })
            .where(and(eq(departments.id, existing.departmentId), eq(departments.headUserId, id)));

          const oldDeptSections = await tx
            .select({ id: sections.id })
            .from(sections)
            .where(eq(sections.departmentId, existing.departmentId));

          const oldSecIds = oldDeptSections.map((s) => s.id);
          if (oldSecIds.length > 0) {
            await tx
              .delete(userSections)
              .where(
                and(
                  eq(userSections.userId, id),
                  inArray(userSections.sectionId, oldSecIds)
                )
              );
          }
        }

        // If moving out of team, revoke Team Head of old team
        if (existing.teamId !== input.teamId) {
          await tx
            .update(teams)
            .set({ headUserId: null })
            .where(and(eq(teams.id, existing.teamId), eq(teams.headUserId, id)));
        }

        await tx
          .update(userMemberships)
          .set({
            departmentId: input.departmentId,
            teamId: input.teamId,
            updatedAt: new Date(),
          })
          .where(eq(userMemberships.id, existing.id));
      } else {
        await tx.insert(userMemberships).values({
          userId: id,
          ventureId: input.ventureId,
          departmentId: input.departmentId,
          teamId: input.teamId,
        });
      }
    });

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  async removeMembership(
    id: string,
    ventureId: string,
    requester: RequesterContext
  ): Promise<UserResponseItem> {
    await assertCanManageUser(requester.id, requester.isAdmin, id);

    if (!requester.isAdmin) {
      if (id === requester.id) {
        throw new ForbiddenError('You cannot remove your own organizational membership');
      }
      const auth = await getUserAuthorityContext(requester.id, false);
      if (auth.departmentsLed.length === 0) {
        throw new ForbiddenError('Only Global Administrators and Department Heads can remove memberships');
      }
    }

    await db.transaction(async (tx) => {
      // Revoke any Department Head or Team Head assignments in this venture
      await tx
        .update(departments)
        .set({ headUserId: null })
        .where(and(eq(departments.ventureId, ventureId), eq(departments.headUserId, id)));

      const ventureDepts = await tx
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.ventureId, ventureId));

      const deptIds = ventureDepts.map((d) => d.id);
      if (deptIds.length > 0) {
        await tx
          .update(teams)
          .set({ headUserId: null })
          .where(and(inArray(teams.departmentId, deptIds), eq(teams.headUserId, id)));

        const deptSections = await tx
          .select({ id: sections.id })
          .from(sections)
          .where(inArray(sections.departmentId, deptIds));

        const secIds = deptSections.map((s) => s.id);
        if (secIds.length > 0) {
          await tx
            .delete(userSections)
            .where(and(eq(userSections.userId, id), inArray(userSections.sectionId, secIds)));
        }
      }

      await tx
        .delete(userMemberships)
        .where(and(eq(userMemberships.userId, id), eq(userMemberships.ventureId, ventureId)));
    });

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  async assignSections(
    id: string,
    input: AssignSectionsInput,
    requester: RequesterContext
  ): Promise<UserResponseItem> {
    await assertCanManageUser(requester.id, requester.isAdmin, id);

    if (!requester.isAdmin) {
      if (id === requester.id) {
        throw new ForbiddenError('You cannot assign sections to yourself');
      }
      const auth = await getUserAuthorityContext(requester.id, false);
      if (auth.departmentsLed.length === 0) {
        throw new ForbiddenError('Only Global Administrators and Department Heads can assign sections');
      }
    }

    // Verify sections belong to departments where the user has active membership
    const userDepts = await db
      .select({ departmentId: userMemberships.departmentId })
      .from(userMemberships)
      .where(eq(userMemberships.userId, id));

    const allowedDeptIds = userDepts.map((m) => m.departmentId);

    if (input.sectionIds.length > 0) {
      const validSections = await db
        .select({ id: sections.id, departmentId: sections.departmentId })
        .from(sections)
        .where(
          and(
            inArray(sections.departmentId, allowedDeptIds),
            inArray(sections.id, input.sectionIds)
          )
        );

      if (validSections.length !== input.sectionIds.length) {
        throw new BadRequestError('One or more sections are outside the user assigned departments');
      }

      // Department Heads can only assign sections from departments they lead
      if (!requester.isAdmin) {
        const auth = await getUserAuthorityContext(requester.id, false);
        const outsideSections = validSections.filter(
          (s) => !auth.departmentsLed.includes(s.departmentId)
        );
        if (outsideSections.length > 0) {
          throw new ForbiddenError('You can only grant sections that belong to your own department');
        }
      }
    }

    // Replace user sections for this venture/departments in a transaction
    await db.transaction(async (tx) => {
      if (input.ventureId) {
        const vDepts = await tx
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.ventureId, input.ventureId));

        const vDeptIds = vDepts.map((d) => d.id);
        if (vDeptIds.length > 0) {
          const vSections = await tx
            .select({ id: sections.id })
            .from(sections)
            .where(inArray(sections.departmentId, vDeptIds));

          const vSecIds = vSections.map((s) => s.id);
          if (vSecIds.length > 0) {
            await tx
              .delete(userSections)
              .where(and(eq(userSections.userId, id), inArray(userSections.sectionId, vSecIds)));
          }
        }
      } else {
        await tx.delete(userSections).where(eq(userSections.userId, id));
      }

      if (input.sectionIds.length > 0) {
        await tx.insert(userSections).values(
          input.sectionIds.map((secId) => ({
            userId: id,
            sectionId: secId,
          }))
        );
      }
    });

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  async resetPassword(id: string, newPassword: string, requester: RequesterContext): Promise<void> {
    await assertCanManageUser(requester.id, requester.isAdmin, id);

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));

    // Clear existing sessions
    await db.delete(sessions).where(eq(sessions.userId, id));
  }
}

export const usersService = new UsersService();
