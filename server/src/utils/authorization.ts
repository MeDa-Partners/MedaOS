import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { departments, teams, userMemberships, users } from '../db/schema';
import { ForbiddenError, NotFoundError } from './errors';

export interface UserAuthorityContext {
  userId: string;
  isAdmin: boolean;
  departmentsLed: string[];
  teamsLed: string[];
}

/**
 * Loads authority context for a user: Global Admin flag, departments led, and teams led.
 */
export async function getUserAuthorityContext(userId: string, isAdmin: boolean): Promise<UserAuthorityContext> {
  if (isAdmin) {
    return {
      userId,
      isAdmin: true,
      departmentsLed: [],
      teamsLed: [],
    };
  }

  const [deptRecords, teamRecords] = await Promise.all([
    db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.headUserId, userId), eq(departments.status, 'active'))),
    db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.headUserId, userId), eq(teams.status, 'active'))),
  ]);

  return {
    userId,
    isAdmin: false,
    departmentsLed: deptRecords.map((d) => d.id),
    teamsLed: teamRecords.map((t) => t.id),
  };
}

/**
 * Asserts whether the caller can manage the given department.
 * Permitted: Global Admin OR the designated Department Head.
 */
export async function assertCanManageDepartment(
  callerId: string,
  callerIsAdmin: boolean,
  departmentId: string
): Promise<void> {
  if (callerIsAdmin) return;

  const [dept] = await db
    .select({ id: departments.id, headUserId: departments.headUserId })
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);

  if (!dept) {
    throw new NotFoundError('Department not found');
  }

  if (dept.headUserId !== callerId) {
    throw new ForbiddenError('You do not have management authority over this department');
  }
}

/**
 * Asserts whether the caller can manage the given team.
 * Permitted: Global Admin OR Department Head of the owning department OR the designated Team Head.
 */
export async function assertCanManageTeam(
  callerId: string,
  callerIsAdmin: boolean,
  teamId: string
): Promise<void> {
  if (callerIsAdmin) return;

  const [team] = await db
    .select({
      id: teams.id,
      departmentId: teams.departmentId,
      headUserId: teams.headUserId,
      deptHeadUserId: departments.headUserId,
    })
    .from(teams)
    .innerJoin(departments, eq(teams.departmentId, departments.id))
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  const isTeamHead = team.headUserId === callerId;
  const isDeptHead = team.deptHeadUserId === callerId;

  if (!isTeamHead && !isDeptHead) {
    throw new ForbiddenError('You do not have management authority over this team');
  }
}

/**
 * Asserts whether the caller can manage the target user.
 * Permitted: Global Admin OR Department Head (if target is in their department) OR Team Head (if target is in their team).
 */
export async function assertCanManageUser(
  callerId: string,
  callerIsAdmin: boolean,
  targetUserId: string
): Promise<void> {
  if (callerIsAdmin) return;

  if (callerId === targetUserId) {
    // A user can view/manage limited self records, but cannot promote themselves
    return;
  }

  const [targetUser] = await db
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  if (targetUser.isAdmin) {
    throw new ForbiddenError('You cannot manage a Global Administrator');
  }

  const auth = await getUserAuthorityContext(callerId, callerIsAdmin);

  // Check if target user belongs to any department or team led by the caller
  const targetMemberships = await db
    .select({
      departmentId: userMemberships.departmentId,
      teamId: userMemberships.teamId,
    })
    .from(userMemberships)
    .where(eq(userMemberships.userId, targetUserId));

  const inDept = targetMemberships.some((m) => auth.departmentsLed.includes(m.departmentId));
  const inTeam = targetMemberships.some((m) => auth.teamsLed.includes(m.teamId));

  if (!inDept && !inTeam) {
    throw new ForbiddenError('Target user is outside your authorized management scope');
  }
}
