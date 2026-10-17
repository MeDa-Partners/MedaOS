export interface TeamDetail {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  name: string;
  slug: string;
  headUserId: string | null;
  headUser: { id: string; name: string; email: string } | null;
  status: string;
  memberCount: number;
  /** Admin or this department's head: may rename, delete, appoint head, move members. */
  canManage: boolean;
  members?: { id: string; name: string; email: string; status: string; isTeamHead: boolean }[];
  createdAt: string;
  updatedAt: string;
}
