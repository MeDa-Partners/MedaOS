import { z } from 'zod';

export const createSectionSchema = z.object({
  departmentId: z.string().uuid('Valid department ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens')
    .optional(),
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
  status: z.enum(['active', 'inactive']).optional(),
});

export const updateSectionStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type UpdateSectionStatusInput = z.infer<typeof updateSectionStatusSchema>;
