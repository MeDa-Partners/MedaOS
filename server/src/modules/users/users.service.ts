import { and, asc, eq, exists, ilike, inArray, ne, or, sql, SQL } from 'drizzle-orm';
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
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import {
  Actor,
  Authority,
  MembershipRef,
  canEditAccount,
  canGrantSection,
  canManageSections,
  grantableSections,
  canRemoveMembership,
  canViewMembership,
  isLeader,
  loadAuthority,
  membershipCapabilities,
} from '../../utils/access';
import { invalidateSessionCache } from '../../middleware/authenticate';
import {
  CreateUserInput,
  ListUsersQuery,
  SetMembershipInput,
  SetSectionsInput,
  UpdateStatusInput,
  UpdateUserInput,
} from './users.validation';
import { UserResponseItem } from './users.types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface MembershipRow extends MembershipRef {
  ventureName: string;
  ventureSlug: string;
  departmentName: string;
  departmentSlug: string;
  deptHeadUserId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  teamHeadUserId: string | null;
}

export class UsersService {
  private async loadMemberships(userIds: string[]): Promise<MembershipRow[]> {
    if (userIds.length === 0) return [];
    return db
      .select({
        userId: userMemberships.userId,
        ventureId: ventures.id,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        departmentId: departments.id,
        departmentName: departments.name,
        departmentSlug: departments.slug,
        deptHeadUserId: departments.headUserId,
        teamId: userMemberships.teamId,
        teamName: teams.name,
        teamSlug: teams.slug,
        teamHeadUserId: teams.headUserId,
      })
      .from(userMemberships)
      .innerJoin(ventures, eq(userMemberships.ventureId, ventures.id))
      .innerJoin(departments, eq(userMemberships.departmentId, departments.id))
      .leftJoin(teams, eq(userMemberships.teamId, teams.id))
      .where(inArray(userMemberships.userId, userIds))
      .orderBy(asc(ventures.name));
  }

  /** Builds API responses: memberships the requester may see, granted sections, capability flags. */
  private async hydrate(userIds: string[], auth: Authority): Promise<UserResponseItem[]> {
    if (userIds.length === 0) return [];

    const [userRows, membershipRows, grantRows] = await Promise.all([
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
      this.loadMemberships(userIds),
      db
        .select({
          userId: userSections.userId,
          id: sections.id,
          name: sections.name,
          slug: sections.slug,
          departmentId: sections.departmentId,
          ventureSlug: ventures.slug,
        })
        .from(userSections)
        .innerJoin(sections, eq(userSections.sectionId, sections.id))
        .innerJoin(departments, eq(sections.departmentId, departments.id))
        .innerJoin(ventures, eq(departments.ventureId, ventures.id))
        .where(inArray(userSections.userId, userIds))
        .orderBy(asc(sections.name)),
    ]);

    const byId = new Map(userRows.map((u) => [u.id, u]));

    return userIds
      .map((id) => byId.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map((u) => {
        const allMemberships = membershipRows.filter((m) => m.userId === u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          isAdmin: u.isAdmin,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          canEditAccount: canEditAccount(auth, u, allMemberships),
          ventures: allMemberships
            .filter((m) => canViewMembership(auth, m))
            .map((m) => ({
              ventureId: m.ventureId,
              ventureName: m.ventureName,
              ventureSlug: m.ventureSlug,
              departmentId: m.departmentId,
              departmentName: m.departmentName,
              departmentSlug: m.departmentSlug,
              isDepartmentHead: m.deptHeadUserId === u.id,
              teamId: m.teamId,
              teamName: m.teamName,
              teamSlug: m.teamSlug,
              isTeamHead: !!m.teamId && m.teamHeadUserId === u.id,
              sections: grantRows
                .filter((g) => g.userId === u.id && g.departmentId === m.departmentId)
                .map((g) => ({
                  id: g.id,
                  name: g.name,
                  slug: g.slug,
                  route: `/${g.ventureSlug}/${g.slug}`,
                })),
              capabilities: membershipCapabilities(auth, m),
            })),
        };
      });
  }

  private async getTargetOrThrow(id: string) {
    const [target] = await db
      .select({ id: users.id, isAdmin: users.isAdmin, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) throw new NotFoundError('Employee not found');
    return target;
  }

  private async findMembership(
    userId: string,
    match: (m: MembershipRow) => boolean
  ): Promise<MembershipRow | undefined> {
    return (await this.loadMemberships([userId])).find(match);
  }

  private async assertCanEditAccount(id: string, auth: Authority) {
    const target = await this.getTargetOrThrow(id);
    const memberships = await this.loadMemberships([id]);
    if (!canEditAccount(auth, target, memberships)) {
      throw new ForbiddenError(
        target.id === auth.userId
          ? 'Use "Change password" in your profile menu to manage your own account.'
          : 'Only an administrator, or the head of every department this person belongs to, can change their account.'
      );
    }
    return target;
  }

  /** Clears department/team head posts and section grants a user holds inside one department. */
  private async detachFromDepartment(tx: Tx, userId: string, departmentId: string) {
    await tx
      .update(departments)
      .set({ headUserId: null, updatedAt: new Date() })
      .where(and(eq(departments.id, departmentId), eq(departments.headUserId, userId)));
    await tx
      .update(teams)
      .set({ headUserId: null, updatedAt: new Date() })
      .where(and(eq(teams.departmentId, departmentId), eq(teams.headUserId, userId)));

    const deptSections = tx
      .select({ id: sections.id })
      .from(sections)
      .where(eq(sections.departmentId, departmentId));
    await tx
      .delete(userSections)
      .where(and(eq(userSections.userId, userId), inArray(userSections.sectionId, deptSections)));
  }

  private async assertTeamInDepartment(teamId: string, departmentId: string) {
    const [team] = await db
      .select({ id: teams.id, status: teams.status })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.departmentId, departmentId)))
      .limit(1);
    if (!team) throw new BadRequestError('The selected team does not belong to this department.');
    if (team.status !== 'active') throw new BadRequestError('The selected team is inactive.');
  }

  private async assertSectionsInDepartment(sectionIds: string[], departmentId: string) {
    if (sectionIds.length === 0) return;
    const unique = Array.from(new Set(sectionIds));
    const valid = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.departmentId, departmentId), inArray(sections.id, unique)));
    if (valid.length !== unique.length) {
      throw new BadRequestError('One or more sections do not belong to this department.');
    }
  }

  // ───────────────────────── Queries ─────────────────────────

  async listUsers(query: ListUsersQuery, actor: Actor) {
    const auth = await loadAuthority(actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;

    if (!isLeader(auth)) {
      return { users: [], total: 0, page, limit };
    }

    const conditions: (SQL | undefined)[] = [];

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(or(ilike(users.name, term), ilike(users.email, term)));
    }

    const showAllAccounts = auth.isAdmin && query.includeUnassigned;

    if (!showAllAccounts) {
      const membershipFilters: (SQL | undefined)[] = [eq(userMemberships.userId, users.id)];
      if (query.ventureId) membershipFilters.push(eq(userMemberships.ventureId, query.ventureId));
      if (query.departmentId) membershipFilters.push(eq(userMemberships.departmentId, query.departmentId));
      if (query.teamId) membershipFilters.push(eq(userMemberships.teamId, query.teamId));

      if (!auth.isAdmin) {
        const scope: SQL[] = [];
        if (auth.departmentsLed.size > 0) {
          scope.push(inArray(userMemberships.departmentId, [...auth.departmentsLed]));
        }
        if (auth.teamsLed.size > 0) {
          scope.push(inArray(userMemberships.teamId, [...auth.teamsLed.keys()]));
        }
        membershipFilters.push(or(...scope));
        conditions.push(eq(users.isAdmin, false));
      }

      conditions.push(
        exists(db.select({ one: sql`1` }).from(userMemberships).where(and(...membershipFilters)))
      );
    }

    const where = and(...conditions);
    const [countRows, idRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
      db
        .select({ id: users.id })
        .from(users)
        .where(where)
        .orderBy(asc(users.name), asc(users.id))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);

    return {
      users: await this.hydrate(
        idRows.map((r) => r.id),
        auth
      ),
      total: countRows[0]?.count ?? 0,
      page,
      limit,
    };
  }

  async getUser(id: string, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    await this.getTargetOrThrow(id);
    const [user] = await this.hydrate([id], auth);
    if (!auth.isAdmin && id !== actor.id && user.ventures.length === 0) {
      throw new NotFoundError('Employee not found');
    }
    return user;
  }

  // ───────────────────────── Accounts ─────────────────────────

  async createUser(input: CreateUserInput, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);

    if (!auth.isAdmin) {
      if (auth.departmentsLed.size === 0) {
        throw new ForbiddenError('Only administrators and department heads can add employees.');
      }
      if (!input.departmentId || !auth.departmentsLed.has(input.departmentId)) {
        throw new ForbiddenError('You can only add employees to a department you head.');
      }
    }

    if (!input.departmentId && (input.teamId || input.sectionIds.length > 0)) {
      throw new BadRequestError('Choose a department before assigning a team or sections.');
    }

    let ventureId: string | null = null;
    if (input.departmentId) {
      const [dept] = await db
        .select({ ventureId: departments.ventureId })
        .from(departments)
        .where(eq(departments.id, input.departmentId))
        .limit(1);
      if (!dept) throw new BadRequestError('The selected department does not exist.');
      ventureId = dept.ventureId;
      if (input.teamId) await this.assertTeamInDepartment(input.teamId, input.departmentId);
      await this.assertSectionsInDepartment(input.sectionIds, input.departmentId);
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing) {
      throw new ConflictError(
        auth.isAdmin
          ? `An account with ${input.email} already exists. Open it from People and add it to this department instead.`
          : `An account with ${input.email} already exists. Ask an administrator to add this person to your department.`
      );
    }

    const passwordHash = await hashPassword(input.password);

    const newId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({ name: input.name, email: input.email, passwordHash, isAdmin: false, status: 'active' })
        .returning({ id: users.id });

      if (input.departmentId && ventureId) {
        await tx.insert(userMemberships).values({
          userId: created.id,
          ventureId,
          departmentId: input.departmentId,
          teamId: input.teamId ?? null,
        });
        const sectionIds = Array.from(new Set(input.sectionIds));
        if (sectionIds.length > 0) {
          await tx.insert(userSections).values(sectionIds.map((sectionId) => ({ userId: created.id, sectionId })));
        }
      }
      return created.id;
    });

    const [user] = await this.hydrate([newId], auth);
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    await this.assertCanEditAccount(id, auth);

    if (input.email) {
      const [clash] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, input.email), ne(users.id, id)))
        .limit(1);
      if (clash) throw new ConflictError(`Email "${input.email}" is already in use.`);
    }

    await db
      .update(users)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    const [user] = await this.hydrate([id], auth);
    return user;
  }

  async updateStatus(id: string, input: UpdateStatusInput, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    if (id === actor.id) throw new BadRequestError('You cannot change the status of your own account.');
    await this.assertCanEditAccount(id, auth);

    await db.transaction(async (tx) => {
      await tx.update(users).set({ status: input.status, updatedAt: new Date() }).where(eq(users.id, id));
      if (input.status === 'inactive') {
        await tx.delete(sessions).where(eq(sessions.userId, id));
        await tx.update(departments).set({ headUserId: null }).where(eq(departments.headUserId, id));
        await tx.update(teams).set({ headUserId: null }).where(eq(teams.headUserId, id));
      }
    });
    invalidateSessionCache();

    const [user] = await this.hydrate([id], auth);
    return user;
  }

  async resetPassword(id: string, newPassword: string, actor: Actor): Promise<void> {
    const auth = await loadAuthority(actor);
    await this.assertCanEditAccount(id, auth);

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
    await db.delete(sessions).where(eq(sessions.userId, id));
    invalidateSessionCache();
  }

  // ───────────────────────── Placement ─────────────────────────

  /**
   * Places a user in a department and (optionally) a team.
   * Admin: any department. Department head: only changes the team of someone already in their department.
   */
  async setMembership(id: string, input: SetMembershipInput, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    const target = await this.getTargetOrThrow(id);

    const [dept] = await db
      .select({ id: departments.id, ventureId: departments.ventureId, status: departments.status })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);
    if (!dept) throw new BadRequestError('The selected department does not exist.');

    const existing = await this.findMembership(id, (m) => m.ventureId === dept.ventureId);

    if (!auth.isAdmin) {
      if (id === actor.id) throw new ForbiddenError('You cannot change your own placement.');
      if (!auth.departmentsLed.has(input.departmentId)) {
        throw new ForbiddenError('You can only assign teams inside a department you head.');
      }
      if (!existing || existing.departmentId !== input.departmentId) {
        throw new ForbiddenError(
          'This person is not in your department. Ask an administrator to move them.'
        );
      }
    }

    if (target.status !== 'active' && !existing) {
      throw new BadRequestError('Reactivate this account before adding it to a department.');
    }

    if (input.teamId) await this.assertTeamInDepartment(input.teamId, input.departmentId);

    await db.transaction(async (tx) => {
      if (!existing) {
        await tx.insert(userMemberships).values({
          userId: id,
          ventureId: dept.ventureId,
          departmentId: input.departmentId,
          teamId: input.teamId,
        });
        return;
      }

      if (existing.departmentId !== input.departmentId) {
        await this.detachFromDepartment(tx, id, existing.departmentId);
      } else if (existing.teamId && existing.teamId !== input.teamId) {
        await tx
          .update(teams)
          .set({ headUserId: null, updatedAt: new Date() })
          .where(and(eq(teams.id, existing.teamId), eq(teams.headUserId, id)));
      }

      await tx
        .update(userMemberships)
        .set({ departmentId: input.departmentId, teamId: input.teamId, updatedAt: new Date() })
        .where(and(eq(userMemberships.userId, id), eq(userMemberships.ventureId, dept.ventureId)));
    });

    const [user] = await this.hydrate([id], auth);
    return user;
  }

  async removeMembership(id: string, ventureId: string, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    await this.getTargetOrThrow(id);
    const existing = await this.findMembership(id, (m) => m.ventureId === ventureId);
    if (!existing) throw new NotFoundError('This person is not part of that venture.');
    if (!canRemoveMembership(auth, existing)) {
      throw new ForbiddenError('Only an administrator or the head of this department can remove this person.');
    }

    await db.transaction(async (tx) => {
      await this.detachFromDepartment(tx, id, existing.departmentId);
      await tx
        .delete(userMemberships)
        .where(and(eq(userMemberships.userId, id), eq(userMemberships.ventureId, ventureId)));
    });

    const [user] = await this.hydrate([id], auth);
    return user;
  }

  // ───────────────────────── Section access ─────────────────────────

  private async assertCanManageSectionsIn(id: string, departmentId: string, auth: Authority) {
    await this.getTargetOrThrow(id);
    const membership = await this.findMembership(id, (m) => m.departmentId === departmentId);
    if (!membership) {
      throw new BadRequestError('This person is not a member of the department that owns these sections.');
    }
    if (!canManageSections(auth, membership)) {
      throw new ForbiddenError(
        membership.userId === auth.userId
          ? 'You cannot change your own section access.'
          : 'You can only manage section access for people in your department or your team.'
      );
    }
    return membership;
  }

  private assertCanGrant(auth: Authority, membership: MembershipRow, sectionIds: string[]) {
    if (sectionIds.some((sectionId) => !canGrantSection(auth, membership, sectionId))) {
      throw new ForbiddenError(
        'As a team head you can only give or take away sections that you have access to yourself.'
      );
    }
  }

  /**
   * Replaces the user's granted sections inside one department.
   * Only sections the requester may grant are touched, so a team head's update never
   * removes sections they don't hold themselves (for example ones a department head granted).
   */
  async setSections(id: string, input: SetSectionsInput, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    const membership = await this.assertCanManageSectionsIn(id, input.departmentId, auth);
    await this.assertSectionsInDepartment(input.sectionIds, input.departmentId);

    const wanted = new Set(input.sectionIds);
    const grantable = grantableSections(auth, input.departmentId);
    const current = await db
      .select({ sectionId: userSections.sectionId })
      .from(userSections)
      .innerJoin(sections, eq(userSections.sectionId, sections.id))
      .where(and(eq(userSections.userId, id), eq(sections.departmentId, input.departmentId)));
    const currentIds = new Set(current.map((c) => c.sectionId));

    const toAdd = [...wanted].filter((sid) => !currentIds.has(sid));
    const toRemove = [...currentIds].filter(
      (sid) => !wanted.has(sid) && (grantable === null || grantable.has(sid))
    );
    this.assertCanGrant(auth, membership, toAdd);

    await db.transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx
          .delete(userSections)
          .where(and(eq(userSections.userId, id), inArray(userSections.sectionId, toRemove)));
      }
      if (toAdd.length > 0) {
        await tx
          .insert(userSections)
          .values(toAdd.map((sectionId) => ({ userId: id, sectionId })))
          .onConflictDoNothing();
      }
    });

    const [user] = await this.hydrate([id], auth);
    return user;
  }

  private async getSectionDepartment(sectionId: string): Promise<string> {
    const [section] = await db
      .select({ departmentId: sections.departmentId })
      .from(sections)
      .where(eq(sections.id, sectionId))
      .limit(1);
    if (!section) throw new NotFoundError('Section not found');
    return section.departmentId;
  }

  async grantSection(id: string, sectionId: string, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    const membership = await this.assertCanManageSectionsIn(id, await this.getSectionDepartment(sectionId), auth);
    this.assertCanGrant(auth, membership, [sectionId]);
    await db.insert(userSections).values({ userId: id, sectionId }).onConflictDoNothing();
    const [user] = await this.hydrate([id], auth);
    return user;
  }

  async revokeSection(id: string, sectionId: string, actor: Actor): Promise<UserResponseItem> {
    const auth = await loadAuthority(actor);
    const membership = await this.assertCanManageSectionsIn(id, await this.getSectionDepartment(sectionId), auth);
    this.assertCanGrant(auth, membership, [sectionId]);
    await db
      .delete(userSections)
      .where(and(eq(userSections.userId, id), eq(userSections.sectionId, sectionId)));
    const [user] = await this.hydrate([id], auth);
    return user;
  }
}

export const usersService = new UsersService();
