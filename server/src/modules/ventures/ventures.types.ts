export interface VentureResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sections?: Array<{
    id: string;
    name: string;
    slug: string;
    route: string;
  }>;
  teams?: Array<{
    id: string;
    ventureId: string;
    name: string;
    slug: string;
    status: string;
  }>;
}
