import { eq, and, ne } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  sessions,
  ventures,
  teams,
  systemSections,
  ventureSections,
  userVentures,
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
import { AuthMeResponse, LoginResult, UserVentureMembership } from './auth.types';

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
  }

  /**
   * Resolves the full identity, venture memberships, teams, and accessible sections for a user.
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

    // All active system sections catalog
    const allCatalogSections = await db
      .select({
        id: systemSections.id,
        name: systemSections.name,
        slug: systemSections.slug,
        route: systemSections.route,
      })
      .from(systemSections)
      .where(eq(systemSections.status, 'active'));

    const allVenturesList = await db
      .select({
        id: ventures.id,
        name: ventures.name,
        slug: ventures.slug,
        status: ventures.status,
      })
      .from(ventures)
      .where(eq(ventures.status, 'active'));

    // Preload enabled sections for all active ventures
    const allVenturesWithSections: {
      id: string;
      name: string;
      slug: string;
      status: string;
      sections: { id: string; name: string; slug: string; route: string }[];
    }[] = [];

    for (const v of allVenturesList) {
      const activeVentureSecs = await db
        .select({
          id: systemSections.id,
          name: systemSections.name,
          slug: systemSections.slug,
          route: systemSections.route,
        })
        .from(ventureSections)
        .innerJoin(systemSections, eq(ventureSections.sectionId, systemSections.id))
        .where(
          and(
            eq(ventureSections.ventureId, v.id),
            eq(systemSections.status, 'active')
          )
        );

      allVenturesWithSections.push({
        ...v,
        sections: activeVentureSecs,
      });
    }

    let ventureMemberships: UserVentureMembership[] = [];

    if (user.isAdmin) {
      // Administrator has complete unrestricted access across all active ventures
      for (const v of allVenturesWithSections) {
        // Find primary or default team if any
        const [vTeam] = await db
          .select({
            id: teams.id,
            ventureId: teams.ventureId,
            name: teams.name,
            slug: teams.slug,
          })
          .from(teams)
          .where(eq(teams.ventureId, v.id))
          .limit(1);

        ventureMemberships.push({
          venture: v,
          team: vTeam || {
            id: 'admin',
            ventureId: v.id,
            name: 'Administration',
            slug: 'admin',
          },
          sections: v.sections,
        });
      }
    } else {
      // Non-admin employee: resolve specific venture memberships and assigned sections
      const userVentureRows = await db
        .select({
          ventureId: ventures.id,
          ventureName: ventures.name,
          ventureSlug: ventures.slug,
          ventureStatus: ventures.status,
          teamId: teams.id,
          teamName: teams.name,
          teamSlug: teams.slug,
        })
        .from(userVentures)
        .innerJoin(ventures, eq(userVentures.ventureId, ventures.id))
        .innerJoin(teams, eq(userVentures.teamId, teams.id))
        .where(
          and(
            eq(userVentures.userId, user.id),
            eq(ventures.status, 'active'),
            eq(teams.status, 'active')
          )
        );

      for (const uv of userVentureRows) {
        // Fetch sections assigned to this user within this specific venture
        // (Must also be an enabled section in this venture's venture_sections)
        const assignedSections = await db
          .select({
            id: systemSections.id,
            name: systemSections.name,
            slug: systemSections.slug,
            route: systemSections.route,
          })
          .from(userSections)
          .innerJoin(systemSections, eq(userSections.sectionId, systemSections.id))
          .innerJoin(
            ventureSections,
            and(
              eq(ventureSections.ventureId, userSections.ventureId),
              eq(ventureSections.sectionId, systemSections.id)
            )
          )
          .where(
            and(
              eq(userSections.userId, user.id),
              eq(userSections.ventureId, uv.ventureId),
              eq(systemSections.status, 'active')
            )
          );

        const vConfig = allVenturesWithSections.find((v) => v.id === uv.ventureId);

        ventureMemberships.push({
          venture: {
            id: uv.ventureId,
            name: uv.ventureName,
            slug: uv.ventureSlug,
            status: uv.ventureStatus,
            sections: vConfig ? vConfig.sections : [],
          },
          team: {
            id: uv.teamId,
            ventureId: uv.ventureId,
            name: uv.teamName,
            slug: uv.teamSlug,
          },
          sections: assignedSections,
        });
      }
    }

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
      allSections: allCatalogSections,
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
