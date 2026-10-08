export interface TeamDetail {
  id: string;
  ventureId: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  venture?: {
    id: string;
    name: string;
    slug: string;
  };
}
