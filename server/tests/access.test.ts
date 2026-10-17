import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db', () => ({ db: {}, sqlClient: { end: vi.fn() } }));

import {
  Authority,
  MembershipRef,
  canChangeTeam,
  canEditAccount,
  canGrantSection,
  canManageDepartment,
  canManageSections,
  canRemoveMembership,
  canViewMembership,
  grantableSections,
  isLeader,
  membershipCapabilities,
} from '../src/utils/access';

// Org used throughout:
//   Venture V → Department SALES (head: deptHead) → teams NORTH (head: teamHead), SOUTH
//             → Department OPS (head: opsHead)
//   Sections in SALES: S1, S2, S3. The team head holds S1 and S2.
const SALES = 'dept-sales';
const OPS = 'dept-ops';
const NORTH = 'team-north';
const SOUTH = 'team-south';

const authority = (overrides: Partial<Authority> & { userId: string }): Authority => ({
  isAdmin: false,
  departmentsLed: new Set(),
  teamsLed: new Map(),
  heldSections: new Set(),
  ...overrides,
});

const admin = authority({ userId: 'admin', isAdmin: true });
const deptHead = authority({ userId: 'deptHead', departmentsLed: new Set([SALES]) });
const teamHead = authority({
  userId: 'teamHead',
  teamsLed: new Map([[NORTH, SALES]]),
  heldSections: new Set(['S1', 'S2']),
});
const member = authority({ userId: 'member' });

const m = (userId: string, departmentId = SALES, teamId: string | null = NORTH): MembershipRef => ({
  userId,
  ventureId: 'V',
  departmentId,
  teamId,
});

const northMember = m('alice', SALES, NORTH);
const southMember = m('bob', SALES, SOUTH);
const noTeamMember = m('carol', SALES, null);
const opsMember = m('dan', OPS, null);

describe('roles', () => {
  it('only admins, department heads and team heads are leaders', () => {
    expect(isLeader(admin)).toBe(true);
    expect(isLeader(deptHead)).toBe(true);
    expect(isLeader(teamHead)).toBe(true);
    expect(isLeader(member)).toBe(false);
  });

  it('department head manages only their own department (teams, new employees)', () => {
    expect(canManageDepartment(deptHead, SALES)).toBe(true);
    expect(canManageDepartment(deptHead, OPS)).toBe(false);
    expect(canManageDepartment(teamHead, SALES)).toBe(false);
    expect(canManageDepartment(admin, OPS)).toBe(true);
  });
});

describe('visibility', () => {
  it('department head sees their whole department, team head only their team', () => {
    expect(canViewMembership(deptHead, southMember)).toBe(true);
    expect(canViewMembership(deptHead, opsMember)).toBe(false);
    expect(canViewMembership(teamHead, northMember)).toBe(true);
    expect(canViewMembership(teamHead, southMember)).toBe(false);
    expect(canViewMembership(teamHead, noTeamMember)).toBe(false);
  });
});

describe('team placement', () => {
  it('only admins and the department head can change a team', () => {
    expect(canChangeTeam(admin, opsMember)).toBe(true);
    expect(canChangeTeam(deptHead, northMember)).toBe(true);
    expect(canChangeTeam(deptHead, noTeamMember)).toBe(true);
    expect(canChangeTeam(deptHead, opsMember)).toBe(false);
  });

  it('team heads can never change anyone’s team, not even in their own team', () => {
    expect(canChangeTeam(teamHead, northMember)).toBe(false);
    expect(canRemoveMembership(teamHead, northMember)).toBe(false);
  });

  it('a department head cannot move themselves', () => {
    expect(canChangeTeam(deptHead, m('deptHead'))).toBe(false);
  });
});

describe('section access (user-based)', () => {
  it('department head manages sections for anyone in the department', () => {
    expect(canManageSections(deptHead, northMember)).toBe(true);
    expect(canManageSections(deptHead, noTeamMember)).toBe(true);
    expect(canManageSections(deptHead, opsMember)).toBe(false);
  });

  it('team head manages sections only for members of their team', () => {
    expect(canManageSections(teamHead, northMember)).toBe(true);
    expect(canManageSections(teamHead, southMember)).toBe(false);
    expect(canManageSections(teamHead, noTeamMember)).toBe(false);
  });

  it('nobody but an admin changes their own access', () => {
    expect(canManageSections(teamHead, m('teamHead'))).toBe(false);
    expect(canManageSections(deptHead, m('deptHead'))).toBe(false);
    expect(canManageSections(member, m('member'))).toBe(false);
  });

  it('department head may grant every department section', () => {
    expect(grantableSections(deptHead, SALES)).toBeNull();
    expect(canGrantSection(deptHead, northMember, 'S3')).toBe(true);
  });

  it('team head may only grant or revoke sections they hold themselves', () => {
    expect(canGrantSection(teamHead, northMember, 'S1')).toBe(true);
    expect(canGrantSection(teamHead, northMember, 'S2')).toBe(true);
    expect(canGrantSection(teamHead, northMember, 'S3')).toBe(false);
    expect(canGrantSection(teamHead, southMember, 'S1')).toBe(false);
  });

  it('capabilities expose the grantable set to the UI', () => {
    expect(membershipCapabilities(teamHead, northMember)).toEqual({
      canChangeTeam: false,
      canManageSections: true,
      grantableSectionIds: ['S1', 'S2'],
      canRemove: false,
    });
    expect(membershipCapabilities(deptHead, northMember).grantableSectionIds).toBeNull();
    expect(membershipCapabilities(teamHead, southMember).canManageSections).toBe(false);
  });
});

describe('account edits (name, status, password)', () => {
  const target = { id: 'alice', isAdmin: false };

  it('department head may edit someone who only belongs to their department', () => {
    expect(canEditAccount(deptHead, target, [northMember])).toBe(true);
  });

  it('department head may not edit someone who also belongs elsewhere', () => {
    expect(canEditAccount(deptHead, target, [northMember, m('alice', OPS, null)])).toBe(false);
  });

  it('team heads and members never edit accounts; nobody but admins edits admins', () => {
    expect(canEditAccount(teamHead, target, [northMember])).toBe(false);
    expect(canEditAccount(deptHead, { id: 'x', isAdmin: true }, [m('x')])).toBe(false);
    expect(canEditAccount(admin, { id: 'x', isAdmin: true }, [])).toBe(true);
  });
});
