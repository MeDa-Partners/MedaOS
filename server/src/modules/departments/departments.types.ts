export interface DepartmentItem {
  id: string;
  ventureId: string;
  ventureName?: string;
  ventureSlug?: string;
  name: string;
  slug: string;
  headUserId: string | null;
  headUserName: string | null;
  headUserEmail: string | null;
  headUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: string;
  teamCount?: number;
  sectionCount?: number;
  createdAt: string;
  updatedAt: string;
}
