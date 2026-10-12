export interface UserVentureMembershipItem {
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  isDepartmentHead?: boolean;
  teamId: string;
  teamName: string;
  teamSlug: string;
  isTeamHead?: boolean;
  sections: {
    id: string;
    name: string;
    slug: string;
    route: string;
  }[];
}

export interface UserResponseItem {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  ventures: UserVentureMembershipItem[];
}
