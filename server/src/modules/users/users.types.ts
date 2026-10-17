export interface UserMembershipItem {
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  isDepartmentHead: boolean;
  teamId: string | null;
  teamName: string | null;
  teamSlug: string | null;
  isTeamHead: boolean;
  /** Sections explicitly granted to this user in this department. */
  sections: { id: string; name: string; slug: string; route: string }[];
  /** What the requester may do with this membership. */
  capabilities: {
    canChangeTeam: boolean;
    canManageSections: boolean;
    /** Sections the requester may grant/revoke here. null = all sections of the department. */
    grantableSectionIds: string[] | null;
    canRemove: boolean;
  };
}

export interface UserResponseItem {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** Memberships visible to the requester (admins see all). */
  ventures: UserMembershipItem[];
  /** Whether the requester may edit name/email, status and password. */
  canEditAccount: boolean;
}
