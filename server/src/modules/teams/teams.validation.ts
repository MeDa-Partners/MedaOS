import { z } from 'zod';

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens');

export const createTeamSchema = z.object({
  departmentId: z.string().uuid('Valid department is required'),
  name: z.string().trim().min(1, 'Name is required').max(100),
  slug: slugSchema.optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: slugSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const assignTeamHeadSchema = z.object({
  headUserId: z.string().uuid().nullable(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
