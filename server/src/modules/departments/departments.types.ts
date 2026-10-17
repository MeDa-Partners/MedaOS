export interface DepartmentItem {
  id: string;
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  name: string;
  slug: string;
  headUserId: string | null;
  headUser: { id: string; name: string; email: string } | null;
  status: string;
  teamCount: number;
  sectionCount: number;
  memberCount: number;
  /** Admin or this department's head. */
  canManage: boolean;
  createdAt: string;
  updatedAt: string;
}
