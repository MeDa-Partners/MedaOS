export interface SafeUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: string;
}

export interface SafeDepartment {
  id: string;
  ventureId: string;
  name: string;
  slug: string;
  headUserId: string | null;
}

export interface SafeTeam {
  id: string;
  departmentId: string;
  name: string;
  slug: string;
  headUserId: string | null;
}

export interface SafeSection {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  name: string;
  slug: string;
  /** App route: /{ventureSlug}/{sectionSlug} */
  route: string;
  status: string;
}

export interface SafeVenture {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export type VentureRole = 'admin' | 'department_head' | 'team_head' | 'member';

/** One entry per venture the user can work in. */
export interface UserVentureMembership {
  venture: SafeVenture;
  /** Null for admins without a membership in this venture. */
  department: SafeDepartment | null;
  team: SafeTeam | null;
  role: VentureRole;
  /** Sections the user can open in this venture, grouped by the UI per department. */
  sections: SafeSection[];
}

export interface AuthMeResponse {
  user: SafeUser;
  ventures: UserVentureMembership[];
  departmentsLed: string[];
  teamsLed: string[];
  isDepartmentHead: boolean;
  isTeamHead: boolean;
}

export interface LoginResult {
  rawToken: string;
  expiresAt: Date;
  authData: AuthMeResponse;
}
