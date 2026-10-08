import { z } from 'zod';

export const createSectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens'),
  route: z
    .string()
    .min(1, 'Route is required')
    .startsWith('/', 'Route must start with a leading slash (e.g., /sales)'),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens')
    .optional(),
  route: z
    .string()
    .min(1)
    .startsWith('/', 'Route must start with a leading slash (e.g., /sales)')
    .optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
