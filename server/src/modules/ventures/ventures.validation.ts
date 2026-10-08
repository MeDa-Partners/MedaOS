import { z } from 'zod';

export const createVentureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens'),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sectionIds: z.array(z.string().uuid()).optional(),
});

export const updateVentureSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens')
    .optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const setVentureSectionsSchema = z.object({
  sectionIds: z.array(z.string().uuid()),
});

export type CreateVentureInput = z.infer<typeof createVentureSchema>;
export type UpdateVentureInput = z.infer<typeof updateVentureSchema>;
export type SetVentureSectionsInput = z.infer<typeof setVentureSectionsSchema>;
