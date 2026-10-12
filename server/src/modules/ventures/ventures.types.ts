export interface VentureResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
  departmentCount?: number;
  teamCount?: number;
  sectionCount?: number;
  employeeCount?: number;
  departments?: {
    id: string;
    name: string;
    slug: string;
    headUserId: string | null;
    headUserName?: string | null;
    status: string;
    teams?: {
      id: string;
      name: string;
      slug: string;
      headUserId: string | null;
      status: string;
    }[];
    sections?: {
      id: string;
      name: string;
      slug: string;
      status: string;
    }[];
  }[];
  createdAt: string;
  updatedAt: string;
}
