import { z } from 'zod';

export const createTeamSchema = z.object({
  departmentId: z.string().uuid('Valid department ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  headUserId: z.string().uuid('Valid user ID is required').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  headUserId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const assignTeamHeadSchema = z.object({
  headUserId: z.string().uuid().nullable(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AssignTeamHeadInput = z.infer<typeof assignTeamHeadSchema>;
