/**
 * MeDa OS access model — the single source of truth for "who can do what".
 *
 * Hierarchy:  Venture → Department (head) → Team (head)
 *                         └→ Sections (coded modules, granted per USER, never per team)
 *
 * Roles:
 *  - Global Admin (users.is_admin): everything.
 *  - Department Head: creates employees in their department, creates/edits teams there,
 *    places department members into those teams, appoints team heads, and grants/revokes
 *    any of the department's sections to any department member. Sees all department sections.
 *  - Team Head: grants/revokes sections for members of THEIR team only, and only sections
 *    the team head holds themselves. Cannot create employees or change anyone's team.
 *  - Member: uses the sections granted to them.
 *
 * The pure `can*` helpers take an `Authority` and plain membership refs, so they are
 * unit-testable without a database. `loadAuthority` and `resolveSectionAccess` hit the DB.
 */
import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { departments, sections, teams, userMemberships, userSections, users, ventures } from '../db/schema';

export interface Actor {
  id: string;
  isAdmin: boolean;
}

export interface Authority {
  userId: string;
  isAdmin: boolean;
  /** Active departments this user heads. */
  departmentsLed: Set<string>;
  /** Active teams this user heads: teamId → departmentId. */
  teamsLed: Map<string, string>;
  /** Sections explicitly granted to this user (what a team head may pass on). */
  heldSections: Set<string>;
}

export interface MembershipRef {
  userId: string;
  ventureId: string;
  departmentId: string;
  teamId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function loadAuthority(actor: Actor): Promise<Authority> {
  if (actor.isAdmin) {
    return {
      userId: actor.id,
      isAdmin: true,
      departmentsLed: new Set(),
      teamsLed: new Map(),
      heldSections: new Set(),
    };
  }

  const [deptRows, teamRows, grantRows] = await Promise.all([
    db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.headUserId, actor.id), eq(departments.status, 'active'))),
    db
      .select({ id: teams.id, departmentId: teams.departmentId })
      .from(teams)
      .where(and(eq(teams.headUserId, actor.id), eq(teams.status, 'active'))),
    db
      .select({ sectionId: userSections.sectionId })
      .from(userSections)
      .where(eq(userSections.userId, actor.id)),
  ]);

  return {
    userId: actor.id,
    isAdmin: false,
    departmentsLed: new Set(deptRows.map((d) => d.id)),
    teamsLed: new Map(teamRows.map((t) => [t.id, t.departmentId])),
    heldSections: new Set(grantRows.map((g) => g.sectionId)),
  };
}

export function isLeader(auth: Authority): boolean {
  return auth.isAdmin || auth.departmentsLed.size > 0 || auth.teamsLed.size > 0;
}

export function leadsDepartment(auth: Authority, departmentId: string): boolean {
  return auth.isAdmin || auth.departmentsLed.has(departmentId);
}

export function leadsTeam(auth: Authority, teamId: string | null | undefined): boolean {
  return !!teamId && auth.teamsLed.has(teamId);
}

/** Create employees / teams, appoint team heads, edit teams in this department. */
export function canManageDepartment(auth: Authority, departmentId: string): boolean {
  return leadsDepartment(auth, departmentId);
}

/** Whether the actor may see this membership (people lists, team rosters). */
export function canViewMembership(auth: Authority, m: MembershipRef): boolean {
  return (
    auth.isAdmin ||
    m.userId === auth.userId ||
    auth.departmentsLed.has(m.departmentId) ||
    leadsTeam(auth, m.teamId)
  );
}

/** Change which team someone is in (within their department), or remove them from it. */
export function canChangeTeam(auth: Authority, m: MembershipRef): boolean {
  if (auth.isAdmin) return true;
  return m.userId !== auth.userId && auth.departmentsLed.has(m.departmentId);
}

/** Remove someone from a department entirely (admin or that department's head). */
export function canRemoveMembership(auth: Authority, m: MembershipRef): boolean {
  return canChangeTeam(auth, m);
}

/** Whether the actor may manage this member's section access at all (which sections: see grantableSections). */
export function canManageSections(auth: Authority, m: MembershipRef): boolean {
  if (auth.isAdmin) return true;
  if (m.userId === auth.userId) return false;
  if (auth.departmentsLed.has(m.departmentId)) return true;
  return leadsTeam(auth, m.teamId) && auth.teamsLed.get(m.teamId!) === m.departmentId;
}

/**
 * Which sections of the department the actor may grant or revoke.
 * `null` means every section (admin, department head). A team head may only pass on
 * sections they hold themselves.
 */
export function grantableSections(auth: Authority, departmentId: string): Set<string> | null {
  if (leadsDepartment(auth, departmentId)) return null;
  return auth.heldSections;
}

/** Grant or revoke one specific section for this member. */
export function canGrantSection(auth: Authority, m: MembershipRef, sectionId: string): boolean {
  if (!canManageSections(auth, m)) return false;
  const grantable = grantableSections(auth, m.departmentId);
  return grantable === null || grantable.has(sectionId);
}

/**
 * Edit name/email, activate/deactivate, reset password.
 * An account is global (it can span ventures), so a department head may only touch it
 * when every one of the person's memberships sits in a department they lead.
 */
export function canEditAccount(
  auth: Authority,
  target: { id: string; isAdmin: boolean },
  targetMemberships: MembershipRef[]
): boolean {
  if (auth.isAdmin) return true;
  if (target.isAdmin || target.id === auth.userId) return false;
  return (
    targetMemberships.length > 0 &&
    targetMemberships.every((m) => auth.departmentsLed.has(m.departmentId))
  );
}

/** Per-membership capability flags returned to the UI so it never has to re-derive rules. */
export function membershipCapabilities(auth: Authority, m: MembershipRef) {
  const manage = canManageSections(auth, m);
  const grantable = manage ? grantableSections(auth, m.departmentId) : new Set<string>();
  return {
    canChangeTeam: canChangeTeam(auth, m),
    canManageSections: manage,
    /** null = every section in the department; otherwise only these ids. */
    grantableSectionIds: grantable === null ? null : [...grantable],
    canRemove: canRemoveMembership(auth, m),
  };
}

export interface SectionAccessResult {
  allowed: boolean;
  reason?: string;
  section?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    departmentId: string;
    departmentName: string;
    ventureId: string;
    ventureName: string;
    ventureSlug: string;
  };
}

/**
 * Decides whether a user may open `/{venture}/{section}`.
 * Admin → yes. Otherwise the user must belong to the owning department and either head it
 * or hold an explicit user_sections grant. Disabled sections/ventures are closed to everyone.
 */
export async function resolveSectionAccess(
  actor: Actor,
  ventureIdentifier: string,
  sectionSlug: string
): Promise<SectionAccessResult> {
  const ventureMatch = isUuid(ventureIdentifier)
    ? or(eq(ventures.id, ventureIdentifier), eq(ventures.slug, ventureIdentifier))
    : eq(ventures.slug, ventureIdentifier);

  const [row] = await db
    .select({
      id: sections.id,
      name: sections.name,
      slug: sections.slug,
      status: sections.status,
      departmentId: departments.id,
      departmentName: departments.name,
      departmentStatus: departments.status,
      deptHeadUserId: departments.headUserId,
      ventureId: ventures.id,
      ventureName: ventures.name,
      ventureSlug: ventures.slug,
      ventureStatus: ventures.status,
    })
    .from(sections)
    .innerJoin(departments, eq(sections.departmentId, departments.id))
    .innerJoin(ventures, eq(departments.ventureId, ventures.id))
    .where(and(eq(sections.slug, sectionSlug), ventureMatch))
    .limit(1);

  if (!row) {
    return { allowed: false, reason: 'This section does not exist in this venture.' };
  }

  const section = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    ventureId: row.ventureId,
    ventureName: row.ventureName,
    ventureSlug: row.ventureSlug,
  };

  if (row.status !== 'active' || row.departmentStatus !== 'active' || row.ventureStatus !== 'active') {
    return { allowed: false, section, reason: 'This section is currently disabled.' };
  }

  if (actor.isAdmin) return { allowed: true, section };

  const [membership] = await db
    .select({ id: userMemberships.id })
    .from(userMemberships)
    .where(
      and(eq(userMemberships.userId, actor.id), eq(userMemberships.departmentId, row.departmentId))
    )
    .limit(1);

  if (!membership) {
    return {
      allowed: false,
      section,
      reason: `You are not a member of the ${row.departmentName} department.`,
    };
  }

  if (row.deptHeadUserId === actor.id) return { allowed: true, section };

  const [grant] = await db
    .select({ id: userSections.id })
    .from(userSections)
    .where(and(eq(userSections.userId, actor.id), eq(userSections.sectionId, row.id)))
    .limit(1);

  if (!grant) {
    return {
      allowed: false,
      section,
      reason: 'You have not been given access to this section. Ask your team or department head.',
    };
  }

  return { allowed: true, section };
}

// ───────────── Order work: shifts, reassignment, step editing (WayVeda COD verification) ─────────────

/** The department that owns the `shifts` section and that section's id (null if it isn't set up). */
export interface ShiftsContext {
  departmentId: string | null;
  shiftsSectionId: string | null;
}

/**
 * Edit shifts and reassign orders. Admin and the owning department's head always; a team head of
 * that department only if they hold the `shifts` section. Members never.
 */
export function canEditShifts(auth: Authority, ctx: ShiftsContext): boolean {
  if (auth.isAdmin) return true;
  if (!ctx.departmentId) return false;
  if (auth.departmentsLed.has(ctx.departmentId)) return true;
  const leadsTeamHere = [...auth.teamsLed.values()].includes(ctx.departmentId);
  return leadsTeamHere && !!ctx.shiftsSectionId && auth.heldSections.has(ctx.shiftsSectionId);
}

/**
 * Move an order's step from one owner to another (`null` = unassigned).
 * Admin and department head: any order in the department. A team head who may edit shifts: only
 * between members of a team they lead (an unassigned order may be given to their team).
 * That the new owner holds the step's section is checked separately (assertCanOwnStep).
 */
export function canReassignOrder(
  auth: Authority,
  ctx: ShiftsContext,
  from: MembershipRef | null,
  to: MembershipRef | null
): boolean {
  if (!canEditShifts(auth, ctx)) return false;
  if (auth.isAdmin || (ctx.departmentId && auth.departmentsLed.has(ctx.departmentId))) return true;
  const fromOk = from === null || leadsTeam(auth, from.teamId);
  return fromOk && to !== null && leadsTeam(auth, to.teamId);
}

/** Edit a step's fields: the step's owner, anyone who may edit shifts, or an admin. */
export function canEditStep(auth: Authority, ctx: ShiftsContext, stepOwnerId: string | null): boolean {
  return auth.isAdmin || (!!stepOwnerId && stepOwnerId === auth.userId) || canEditShifts(auth, ctx);
}

/** Where a section lives in a venture (id + department), or null if it doesn't exist there. */
export async function loadSectionRef(ventureId: string, slug: string) {
  const [row] = await db
    .select({ id: sections.id, departmentId: sections.departmentId })
    .from(sections)
    .innerJoin(departments, eq(sections.departmentId, departments.id))
    .where(and(eq(departments.ventureId, ventureId), eq(sections.slug, slug)))
    .limit(1);
  return row ?? null;
}

/**
 * Active people in the venture who can open a section: members of its department who head it or
 * hold a grant. (Admins open everything but are not venture members, so they are not listed.)
 */
export async function listSectionHolders(ventureId: string, slug: string) {
  const ref = await loadSectionRef(ventureId, slug);
  if (!ref) return [];
  const rows = await db
    .select({
      userId: userMemberships.userId,
      teamId: userMemberships.teamId,
      departmentId: userMemberships.departmentId,
      name: users.name,
      status: users.status,
      headUserId: departments.headUserId,
      grantId: userSections.id,
    })
    .from(userMemberships)
    .innerJoin(users, eq(users.id, userMemberships.userId))
    .innerJoin(departments, eq(departments.id, userMemberships.departmentId))
    .leftJoin(userSections, and(eq(userSections.userId, userMemberships.userId), eq(userSections.sectionId, ref.id)))
    .where(and(eq(userMemberships.ventureId, ventureId), eq(userMemberships.departmentId, ref.departmentId)));
  return rows
    .filter((r) => r.status === 'active' && (r.grantId || r.headUserId === r.userId))
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      membership: { userId: r.userId, ventureId, departmentId: r.departmentId, teamId: r.teamId } as MembershipRef,
    }));
}
