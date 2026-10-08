export interface SafeUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: string;
}

export interface SafeTeam {
  id: string;
  ventureId: string;
  name: string;
  slug: string;
}

export interface SafeVenture {
  id: string;
  name: string;
  slug: string;
  status?: string;
  sections?: SafeSection[];
}

export interface SafeSection {
  id: string;
  name: string;
  slug: string;
  route: string;
}

export interface UserVentureMembership {
  venture: SafeVenture;
  team: SafeTeam | null;
  sections: SafeSection[];
}

export interface AuthMeResponse {
  user: SafeUser;
  ventures: UserVentureMembership[];
  allVentures?: SafeVenture[];
  allSections?: SafeSection[];
}

export interface LoginResult {
  rawToken: string;
  expiresAt: Date;
  authData: AuthMeResponse;
}
