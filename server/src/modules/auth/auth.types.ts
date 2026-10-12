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
  ventureId?: string;
  name: string;
  slug: string;
  headUserId: string | null;
}

export interface SafeSection {
  id: string;
  departmentId: string;
  name: string;
  slug: string;
  route: string;
  status: string;
}

export interface SafeVenture {
  id: string;
  name: string;
  slug: string;
  status?: string;
  sections?: SafeSection[];
}

export interface UserVentureMembership {
  venture: SafeVenture;
  department: SafeDepartment | null;
  team: SafeTeam | null;
  sections: SafeSection[];
}

export interface AuthMeResponse {
  user: SafeUser;
  ventures: UserVentureMembership[];
  allVentures?: SafeVenture[];
  allSections?: SafeSection[];
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
