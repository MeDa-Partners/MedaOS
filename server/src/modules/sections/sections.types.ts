export interface SectionDetail {
  id: string;
  departmentId: string;
  departmentName?: string;
  departmentSlug?: string;
  ventureId?: string;
  ventureName?: string;
  ventureSlug?: string;
  name: string;
  slug: string;
  route: string;
  status: 'active' | 'inactive';
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}
