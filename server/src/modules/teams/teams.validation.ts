import { z } from 'zod';

export const createTeamSchema = z.object({
  ventureId: z.string().uuid('Valid venture ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens'),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateTeamSchema = z.object({
  ventureId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric lowercase with hyphens')
    .optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
