export interface UserVentureMembershipItem {
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
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
  createdAt: Date;
  updatedAt: Date;
  ventures: UserVentureMembershipItem[];
}

