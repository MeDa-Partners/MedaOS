import { eq, and, ne } from 'drizzle-orm';
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
   * Resolves the full identity, venture memberships, department, team, and accessible sections.
   */
  async getAuthMe(userId: string): Promise<AuthMeResponse> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== 'active') {
      throw new ForbiddenError('Your account has been deactivated.');
    }

    // Resolve departments, teams, active ventures and sections in parallel
    const [deptLedRows, teamLedRows, allVenturesList, allActiveSections] = await Promise.all([
      db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.headUserId, user.id)),
      db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.headUserId, user.id)),
      db
        .select({
          id: ventures.id,
          name: ventures.name,
          slug: ventures.slug,
          status: ventures.status,
        })
        .from(ventures)
        .where(eq(ventures.status, 'active')),
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
        .where(eq(sections.status, 'active')),
    ]);

    const departmentsLed = deptLedRows.map((d) => d.id);
    const teamsLed = teamLedRows.map((t) => t.id);

    const allVenturesWithSections = allVenturesList.map((v) => {
      const vSections: SafeSection[] = allActiveSections
        .filter((s) => s.ventureId === v.id)
        .map((s) => ({
          id: s.id,
          departmentId: s.departmentId,
          departmentName: s.departmentName,
          departmentSlug: s.departmentSlug,
          name: s.name,
          slug: s.slug,
          route: `/${v.slug}/${s.slug}`,
          status: s.status,
        }));
      return {
        ...v,
        sections: vSections,
      };
    });

    const ventureMemberships: UserVentureMembership[] = [];

    if (user.isAdmin) {
      // Global Admin has complete organizational access across all active ventures
      for (const v of allVenturesWithSections) {
        ventureMemberships.push({
          venture: v,
          department: null,
          team: null,
          sections: v.sections || [],
        });
      }
    } else {
      // Query user's memberships and assigned sections in parallel
      const [userMemberRows, userSecRows] = await Promise.all([
        db
          .select({
            ventureId: ventures.id,
            ventureName: ventures.name,
            ventureSlug: ventures.slug,
            ventureStatus: ventures.status,
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
          .where(
            and(
              eq(userMemberships.userId, user.id),
              eq(ventures.status, 'active')
            )
          ),
        db
          .select({
            sectionId: userSections.sectionId,
          })
          .from(userSections)
          .where(eq(userSections.userId, user.id)),
      ]);

      const assignedSectionIdSet = new Set(userSecRows.map((r) => r.sectionId));

      for (const m of userMemberRows) {
        const isDeptHead = m.deptHeadUserId === user.id;

        // Department Heads inherit access to all active sections in their department
        // Regular employees and Team Heads access their specifically assigned active sections in their department
        const deptActiveSections = allActiveSections.filter(
          (s) => s.departmentId === m.departmentId
        );

        const accessibleSections: SafeSection[] = isDeptHead
          ? deptActiveSections.map((s) => ({
              id: s.id,
              departmentId: s.departmentId,
              departmentName: m.departmentName,
              departmentSlug: m.departmentSlug,
              name: s.name,
              slug: s.slug,
              route: `/${m.ventureSlug}/${s.slug}`,
              status: s.status,
            }))
          : deptActiveSections
              .filter((s) => assignedSectionIdSet.has(s.id))
              .map((s) => ({
                id: s.id,
                departmentId: s.departmentId,
                departmentName: m.departmentName,
                departmentSlug: m.departmentSlug,
                name: s.name,
                slug: s.slug,
                route: `/${m.ventureSlug}/${s.slug}`,
                status: s.status,
              }));

        ventureMemberships.push({
          venture: {
            id: m.ventureId,
            name: m.ventureName,
            slug: m.ventureSlug,
            status: m.ventureStatus,
            sections: accessibleSections,
          },
          department: {
            id: m.departmentId,
            ventureId: m.ventureId,
            name: m.departmentName,
            slug: m.departmentSlug,
            headUserId: m.deptHeadUserId,
          },
          team: {
            id: m.teamId,
            departmentId: m.departmentId,
            ventureId: m.ventureId,
            name: m.teamName,
            slug: m.teamSlug,
            headUserId: m.teamHeadUserId,
          },
          sections: accessibleSections,
        });
      }
    }

    const catalogSections: SafeSection[] = allActiveSections.map((s) => ({
      id: s.id,
      departmentId: s.departmentId,
      departmentName: s.departmentName,
      departmentSlug: s.departmentSlug,
      name: s.name,
      slug: s.slug,
      route: `/${s.slug}`,
      status: s.status,
    }));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        status: user.status,
      },
      ventures: ventureMemberships,
      allVentures: allVenturesWithSections,
      allSections: catalogSections,
      departmentsLed,
      teamsLed,
      isDepartmentHead: departmentsLed.length > 0,
      isTeamHead: teamsLed.length > 0,
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
