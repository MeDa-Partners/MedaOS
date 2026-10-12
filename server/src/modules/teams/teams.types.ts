export interface TeamDetail {
  id: string;
  departmentId: string;
  departmentName?: string;
  departmentSlug?: string;
  ventureId?: string;
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
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}
