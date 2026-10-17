import { eq, and, ne, asc } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  sessions,
  ventures,
  departments,
  teams,
  sections,
  userMemberships,
  userSections,
} from '../../db/schema';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
} from '../../utils/crypto';
import { env } from '../../config/env';
import {
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from '../../utils/errors';
import { LoginInput, ChangePasswordInput } from './auth.validation';
import { invalidateSessionCache } from '../../middleware/authenticate';
import {
  AuthMeResponse,
  LoginResult,
  UserVentureMembership,
  SafeSection,
} from './auth.types';
import { loadAuthority } from '../../utils/access';

export class AuthService {
  /**
   * Validates user credentials, creates a server session, and returns auth context.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new ForbiddenError(
        'Your account has been deactivated. Please contact an administrator.'
      );
    }

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600 * 1000);

    await db.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const authData = await this.getAuthMe(user.id);

    return {
      rawToken,
      expiresAt,
      authData,
    };
  }

  /**
   * Invalidates a session from the database.
   */
  async logout(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    invalidateSessionCache();
  }

  /**
   * Resolves identity plus, per venture, the user's department, team, role and openable sections.
   * Admins get every active venture with every active section.
   */
  async getAuthMe(userId: string): Promise<AuthMeResponse> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    if (user.status !== 'active') {
      throw new ForbiddenError('Your account has been deactivated.');
    }

    const [activeVentures, activeSections, memberRows, grantRows, auth] = await Promise.all([
      db
        .select({ id: ventures.id, name: ventures.name, slug: ventures.slug, status: ventures.status })
        .from(ventures)
        .where(eq(ventures.status, 'active'))
        .orderBy(asc(ventures.name)),
      db
        .select({
          id: sections.id,
          departmentId: sections.departmentId,
          departmentName: departments.name,
          departmentSlug: departments.slug,
          name: sections.name,
          slug: sections.slug,
          status: sections.status,
          ventureId: departments.ventureId,
        })
        .from(sections)
        .innerJoin(departments, eq(sections.departmentId, departments.id))
        .where(and(eq(sections.status, 'active'), eq(departments.status, 'active')))
        .orderBy(asc(departments.name), asc(sections.name)),
      db
        .select({
          ventureId: userMemberships.ventureId,
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
        .innerJoin(departments, eq(userMemberships.departmentId, departments.id))
        .leftJoin(teams, eq(userMemberships.teamId, teams.id))
        .where(eq(userMemberships.userId, user.id)),
      db
        .select({ sectionId: userSections.sectionId })
        .from(userSections)
        .where(eq(userSections.userId, user.id)),
      loadAuthority({ id: user.id, isAdmin: user.isAdmin }),
    ]);

    const granted = new Set(grantRows.map((g) => g.sectionId));
    const ventureById = new Map(activeVentures.map((v) => [v.id, v]));
    const toSafeSection = (s: (typeof activeSections)[number], ventureSlug: string): SafeSection => ({
      id: s.id,
      departmentId: s.departmentId,
      departmentName: s.departmentName,
      departmentSlug: s.departmentSlug,
      name: s.name,
      slug: s.slug,
      route: `/${ventureSlug}/${s.slug}`,
      status: s.status,
    });

    const memberships: UserVentureMembership[] = [];

    for (const m of memberRows) {
      const venture = ventureById.get(m.ventureId);
      if (!venture) continue; // venture disabled

      const isDeptHead = auth.departmentsLed.has(m.departmentId);
      const isTeamHead = !!m.teamId && auth.teamsLed.has(m.teamId);
      const deptSections = activeSections.filter((s) => s.departmentId === m.departmentId);

      memberships.push({
        venture,
        department: {
          id: m.departmentId,
          ventureId: m.ventureId,
          name: m.departmentName,
          slug: m.departmentSlug,
          headUserId: m.deptHeadUserId,
        },
        team: m.teamId
          ? {
              id: m.teamId,
              departmentId: m.departmentId,
              name: m.teamName!,
              slug: m.teamSlug!,
              headUserId: m.teamHeadUserId,
            }
          : null,
        role: user.isAdmin ? 'admin' : isDeptHead ? 'department_head' : isTeamHead ? 'team_head' : 'member',
        sections: (user.isAdmin || isDeptHead ? deptSections : deptSections.filter((s) => granted.has(s.id))).map(
          (s) => toSafeSection(s, venture.slug)
        ),
      });
    }

    if (user.isAdmin) {
      // Admins work across every venture and see every section, membership or not.
      for (const venture of activeVentures) {
        const existing = memberships.find((m) => m.venture.id === venture.id);
        const allSections = activeSections
          .filter((s) => s.ventureId === venture.id)
          .map((s) => toSafeSection(s, venture.slug));
        if (existing) {
          existing.sections = allSections;
        } else {
          memberships.push({ venture, department: null, team: null, role: 'admin', sections: allSections });
        }
      }
    }

    memberships.sort((a, b) => a.venture.name.localeCompare(b.venture.name));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        status: user.status,
      },
      ventures: memberships,
      departmentsLed: [...auth.departmentsLed],
      teamsLed: [...auth.teamsLed.keys()],
      isDepartmentHead: auth.departmentsLed.size > 0,
      isTeamHead: auth.teamsLed.size > 0,
    };
  }

  /**
   * Changes the authenticated user's password and invalidates other sessions.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentSessionId: string
  ): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const isCurrentValid = await verifyPassword(
      user.passwordHash,
      input.currentPassword
    );

    if (!isCurrentValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    const newHash = await hashPassword(input.newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db
      .delete(sessions)
      .where(
        and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId))
      );
  }
}

export const authService = new AuthService();
