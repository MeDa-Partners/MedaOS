import { eq, inArray, sql, and, or, ilike } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  teams,
  ventures,
  userVentures,
  systemSections,
  ventureSections,
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
  AssignTeamInput,
  AssignSectionsInput,
  ResetPasswordInput,
} from './users.validation';
import { UserResponseItem } from './users.types';

export interface RequesterContext {
  id: string;
  isAdmin: boolean;
}

interface PermittedScope {
  ventureId: string;
  teamId: string;
}

export class UsersService {
  /**
   * Retrieves the venture and team scopes the requester has employee management rights over.
   */
  private async getManagerScopes(requesterId: string): Promise<PermittedScope[]> {
    const scopes = await db
      .select({
        ventureId: userVentures.ventureId,
        teamId: userVentures.teamId,
      })
      .from(userVentures)
      .innerJoin(
        userSections,
        and(
          eq(userSections.userId, userVentures.userId),
          eq(userSections.ventureId, userVentures.ventureId)
        )
      )
      .innerJoin(systemSections, eq(userSections.sectionId, systemSections.id))
      .where(
        and(
          eq(userVentures.userId, requesterId),
          eq(systemSections.slug, 'employees'),
          eq(systemSections.status, 'active')
        )
      );

    return scopes;
  }

  /**
   * Enforces security boundaries: checks whether a non-admin requester has authority
   * over the target user.
   */
  private async assertTargetAccess(
    targetUserId: string,
    requester: RequesterContext,
    targetVentureId?: string
  ): Promise<{ targetUser: typeof users.$inferSelect; targetMemberships: { ventureId: string; teamId: string }[] }> {
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!target) {
      throw new NotFoundError(`User with id "${targetUserId}" not found`);
    }

    const memberships = await db
      .select({
        ventureId: userVentures.ventureId,
        teamId: userVentures.teamId,
      })
      .from(userVentures)
      .where(eq(userVentures.userId, targetUserId));

    if (requester.isAdmin) {
      return { targetUser: target, targetMemberships: memberships };
    }

    if (target.isAdmin) {
      throw new ForbiddenError('You do not have permission to manage administrator accounts');
    }

    const managerScopes = await this.getManagerScopes(requester.id);
    if (managerScopes.length === 0) {
      throw new ForbiddenError('You do not have Employee Management permissions');
    }

    // Check if target user belongs to at least one scope the manager is authorized for
    const isWithinScope = memberships.some((m) =>
      managerScopes.some((s) => {
        const matchesScope = s.ventureId === m.ventureId && s.teamId === m.teamId;
        if (targetVentureId) {
          return matchesScope && m.ventureId === targetVentureId;
        }
        return matchesScope;
      })
    );

    if (!isWithinScope) {
      throw new ForbiddenError('Target employee is outside your allowed management scope');
    }

    return { targetUser: target, targetMemberships: memberships };
  }

  /**
   * Hydrates full user response objects with venture memberships, teams, and sections.
   */
  private async hydrateUsers(userIds: string[]): Promise<UserResponseItem[]> {
    if (userIds.length === 0) return [];

    const userRecords = await db
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
      .where(inArray(users.id, userIds));

    // Fetch all venture-team memberships for these users
    const memberships = await db
      .select({
        userId: userVentures.userId,
        ventureId: ventures.id,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        teamId: teams.id,
        teamName: teams.name,
        teamSlug: teams.slug,
      })
      .from(userVentures)
      .innerJoin(ventures, eq(userVentures.ventureId, ventures.id))
      .innerJoin(teams, eq(userVentures.teamId, teams.id))
      .where(inArray(userVentures.userId, userIds));

    // Fetch all sections granted to these users across ventures
    const sectionsGranted = await db
      .select({
        userId: userSections.userId,
        ventureId: userSections.ventureId,
        sectionId: systemSections.id,
        sectionName: systemSections.name,
        sectionSlug: systemSections.slug,
        sectionRoute: systemSections.route,
      })
      .from(userSections)
      .innerJoin(systemSections, eq(userSections.sectionId, systemSections.id))
      .where(inArray(userSections.userId, userIds));

    // Map memberships & sections to each user
    const userMap = new Map<string, UserResponseItem>();
    for (const u of userRecords) {
      userMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        isAdmin: u.isAdmin,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        ventures: [],
      });
    }

    for (const m of memberships) {
      const userItem = userMap.get(m.userId);
      if (!userItem) continue;

      const userSecs = sectionsGranted
        .filter((s) => s.userId === m.userId && s.ventureId === m.ventureId)
        .map((s) => ({
          id: s.sectionId,
          name: s.sectionName,
          slug: s.sectionSlug,
          route: s.sectionRoute,
        }));

      userItem.ventures.push({
        ventureId: m.ventureId,
        ventureName: m.ventureName,
        ventureSlug: m.ventureSlug,
        teamId: m.teamId,
        teamName: m.teamName,
        teamSlug: m.teamSlug,
        sections: userSecs,
      });
    }

    // Preserve order of incoming userIds
    return userIds.map((id) => userMap.get(id)!).filter(Boolean);
  }

  /**
   * Lists employees. Scoped strictly to permitted venture+team scopes for non-admins.
   */
  async listUsers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      ventureId?: string;
      teamId?: string;
    } = {},
    requester?: RequesterContext
  ): Promise<{ users: UserResponseItem[]; total: number; page: number; limit: number }> {
    const reqContext = requester || { id: 'system', isAdmin: true };
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let allowedScopeConditions: ReturnType<typeof sql>[] = [];

    if (!reqContext.isAdmin) {
      const managerScopes = await this.getManagerScopes(reqContext.id);
      if (managerScopes.length === 0) {
        return { users: [], total: 0, page, limit };
      }

      // Filter scopes if specific ventureId or teamId requested
      let filteredScopes = managerScopes;
      if (options.ventureId) {
        filteredScopes = filteredScopes.filter((s) => s.ventureId === options.ventureId);
      }
      if (options.teamId) {
        filteredScopes = filteredScopes.filter((s) => s.teamId === options.teamId);
      }

      if (filteredScopes.length === 0) {
        return { users: [], total: 0, page, limit };
      }

      allowedScopeConditions = filteredScopes.map(
        (s) => sql`(${userVentures.ventureId} = ${s.ventureId} AND ${userVentures.teamId} = ${s.teamId})`
      );
    } else {
      if (options.ventureId && options.teamId) {
        allowedScopeConditions.push(
          sql`(${userVentures.ventureId} = ${options.ventureId} AND ${userVentures.teamId} = ${options.teamId})`
        );
      } else if (options.ventureId) {
        allowedScopeConditions.push(sql`${userVentures.ventureId} = ${options.ventureId}`);
      } else if (options.teamId) {
        allowedScopeConditions.push(sql`${userVentures.teamId} = ${options.teamId}`);
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

    // Determine target users either through userVentures join or users directly
    let targetUserIdsQuery;
    let countQuery;

    if (allowedScopeConditions.length > 0) {
      const scopeClause = sql.join(allowedScopeConditions, sql` OR `);

      targetUserIdsQuery = db
        .selectDistinct({ id: users.id })
        .from(users)
        .innerJoin(userVentures, eq(users.id, userVentures.userId))
        .where(
          and(
            scopeClause,
            whereConditions.length > 0 ? and(...whereConditions) : undefined
          )
        );

      countQuery = db
        .select({ count: sql<number>`count(distinct ${users.id})::int` })
        .from(users)
        .innerJoin(userVentures, eq(users.id, userVentures.userId))
        .where(
          and(
            scopeClause,
            whereConditions.length > 0 ? and(...whereConditions) : undefined
          )
        );
    } else {
      targetUserIdsQuery = db
        .select({ id: users.id })
        .from(users)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

      countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    }

    const queryStart = Date.now();
    const [totalResult, userRows] = await Promise.all([
      countQuery,
      targetUserIdsQuery.limit(limit).offset(offset),
    ]);
    const queryTime = Date.now() - queryStart;

    const total = totalResult[0]?.count || 0;
    const userIds = userRows.map((r) => r.id);

    const hydStart = Date.now();
    const hydratedUsers = await this.hydrateUsers(userIds);
    const hydTime = Date.now() - hydStart;

    console.log(`   └─ [Supabase Query Details] count & IDs query: ${queryTime}ms | hydration: ${hydTime}ms`);

    return {
      users: hydratedUsers,
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves single employee by ID.
   */
  async getUserById(id: string, requester: RequesterContext): Promise<UserResponseItem> {
    await this.assertTargetAccess(id, requester);
    const [user] = await this.hydrateUsers([id]);
    if (!user) {
      throw new NotFoundError(`User with id "${id}" not found`);
    }
    return user;
  }

  /**
   * Creates an employee with initial venture, team, and section assignments.
   */
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
    let targetTeamId = input.teamId;

    if (!requester.isAdmin) {
      const managerScopes = await this.getManagerScopes(requester.id);
      if (managerScopes.length === 0) {
        throw new ForbiddenError('You do not have Employee Management permissions');
      }

      if (!targetVentureId) {
        if (managerScopes.length === 1) {
          targetVentureId = managerScopes[0].ventureId;
        } else {
          throw new BadRequestError('ventureId is required to create an employee');
        }
      }

      const matchingScope = managerScopes.find((s) => s.ventureId === targetVentureId);
      if (!matchingScope) {
        throw new ForbiddenError('You cannot create employees in a venture you do not manage');
      }

      // Non-admin manager can only add employees to their own team within that venture
      if (targetTeamId && targetTeamId !== matchingScope.teamId) {
        throw new ForbiddenError('You can only create employees in your own team');
      }
      targetTeamId = matchingScope.teamId;
    }

    // Verify team belongs to venture
    if (targetVentureId && targetTeamId) {
      const [team] = await db
        .select({ id: teams.id, ventureId: teams.ventureId })
        .from(teams)
        .where(and(eq(teams.id, targetTeamId), eq(teams.ventureId, targetVentureId)))
        .limit(1);

      if (!team) {
        throw new BadRequestError('Specified team does not belong to the given venture');
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

    // Assign venture + team membership
    if (targetVentureId && targetTeamId) {
      await db.insert(userVentures).values({
        userId: newUser.id,
        ventureId: targetVentureId,
        teamId: targetTeamId,
      });

      // Assign sections if provided
      if (input.sectionIds && input.sectionIds.length > 0) {
        // Filter sections to only those enabled for this venture
        const availableSections = await db
          .select({ sectionId: ventureSections.sectionId })
          .from(ventureSections)
          .where(
            and(
              eq(ventureSections.ventureId, targetVentureId),
              inArray(ventureSections.sectionId, input.sectionIds)
            )
          );

        if (availableSections.length !== input.sectionIds.length) {
          throw new BadRequestError(
            'One or more selected sections are not enabled for the assigned venture'
          );
        }

        if (availableSections.length > 0) {
          await db.insert(userSections).values(
            availableSections.map((s) => ({
              userId: newUser.id,
              ventureId: targetVentureId!,
              sectionId: s.sectionId,
            }))
          );
        }
      }
    }

    const [hydrated] = await this.hydrateUsers([newUser.id]);
    return hydrated;
  }

  /**
   * Updates employee name and email.
   */
  async updateUser(id: string, input: UpdateUserInput, requester: RequesterContext): Promise<UserResponseItem> {
    await this.assertTargetAccess(id, requester);

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

  /**
   * Updates employee status (active / inactive).
   */
  async updateStatus(id: string, input: UpdateStatusInput, requester: RequesterContext): Promise<UserResponseItem> {
    await this.assertTargetAccess(id, requester);

    if (id === requester.id && input.status === 'inactive') {
      throw new BadRequestError('You cannot deactivate your own account');
    }

    await db
      .update(users)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(users.id, id));

    // Invalidate sessions if deactivated
    if (input.status === 'inactive') {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  /**
   * Assigns or updates an employee's team within a specific venture.
   */
  async assignTeam(id: string, input: AssignTeamInput, requester: RequesterContext): Promise<UserResponseItem> {
    await this.assertTargetAccess(id, requester, input.ventureId);

    // Verify team belongs to venture
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, input.teamId), eq(teams.ventureId, input.ventureId)))
      .limit(1);

    if (!team) {
      throw new BadRequestError('The specified team does not belong to this venture');
    }

    if (!requester.isAdmin) {
      const managerScopes = await this.getManagerScopes(requester.id);
      const isAllowedScope = managerScopes.some(
        (s) => s.ventureId === input.ventureId && s.teamId === input.teamId
      );
      if (!isAllowedScope) {
        throw new ForbiddenError('You can only assign employees to your authorized venture and team');
      }
    }

    // Upsert user_ventures
    const [existing] = await db
      .select({ id: userVentures.id })
      .from(userVentures)
      .where(and(eq(userVentures.userId, id), eq(userVentures.ventureId, input.ventureId)))
      .limit(1);

    if (existing) {
      await db
        .update(userVentures)
        .set({ teamId: input.teamId })
        .where(eq(userVentures.id, existing.id));
    } else {
      await db.insert(userVentures).values({
        userId: id,
        ventureId: input.ventureId,
        teamId: input.teamId,
      });
    }

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  /**
   * Removes an employee from a venture entirely.
   */
  async removeVentureAssignment(
    id: string,
    ventureId: string,
    requester: RequesterContext
  ): Promise<UserResponseItem> {
    await this.assertTargetAccess(id, requester, ventureId);

    if (!requester.isAdmin) {
      const managerScopes = await this.getManagerScopes(requester.id);
      const hasVentureScope = managerScopes.some((s) => s.ventureId === ventureId);
      if (!hasVentureScope) {
        throw new ForbiddenError('You cannot remove memberships from ventures you do not manage');
      }
    }

    // Remove user_ventures and user_sections for this venture
    await db
      .delete(userSections)
      .where(and(eq(userSections.userId, id), eq(userSections.ventureId, ventureId)));

    await db
      .delete(userVentures)
      .where(and(eq(userVentures.userId, id), eq(userVentures.ventureId, ventureId)));

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  /**
   * Assigns section access for an employee within a specific venture.
   */
  async assignSections(
    id: string,
    input: AssignSectionsInput,
    requester: RequesterContext
  ): Promise<UserResponseItem> {
    await this.assertTargetAccess(id, requester, input.ventureId);

    if (!requester.isAdmin) {
      const managerScopes = await this.getManagerScopes(requester.id);
      const hasVentureScope = managerScopes.some((s) => s.ventureId === input.ventureId);
      if (!hasVentureScope) {
        throw new ForbiddenError('You cannot assign sections for a venture you do not manage');
      }
    }

    // Ensure all sectionIds are actually active and enabled for this venture
    let validSectionIds: string[] = [];
    if (input.sectionIds.length > 0) {
      const available = await db
        .select({ sectionId: ventureSections.sectionId })
        .from(ventureSections)
        .innerJoin(systemSections, eq(ventureSections.sectionId, systemSections.id))
        .where(
          and(
            eq(ventureSections.ventureId, input.ventureId),
            eq(systemSections.status, 'active'),
            inArray(ventureSections.sectionId, input.sectionIds)
          )
        );

      validSectionIds = available.map((s) => s.sectionId);

      if (validSectionIds.length !== input.sectionIds.length) {
        throw new BadRequestError(
          'One or more selected sections are not enabled for this venture'
        );
      }
    }

    // Replace user sections for this venture
    await db
      .delete(userSections)
      .where(and(eq(userSections.userId, id), eq(userSections.ventureId, input.ventureId)));

    if (validSectionIds.length > 0) {
      await db.insert(userSections).values(
        validSectionIds.map((sId) => ({
          userId: id,
          ventureId: input.ventureId,
          sectionId: sId,
        }))
      );
    }

    const [user] = await this.hydrateUsers([id]);
    return user;
  }

  /**
   * Resets an employee password.
   */
  async resetPassword(
    id: string,
    input: ResetPasswordInput,
    requester: RequesterContext
  ): Promise<void> {
    await this.assertTargetAccess(id, requester);

    const passwordHash = await hashPassword(input.newPassword);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));

    // Terminate active sessions to force re-authentication with new password
    await db.delete(sessions).where(eq(sessions.userId, id));
  }
}

export const usersService = new UsersService();
