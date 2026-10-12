import { z } from 'zod';

export const createDepartmentSchema = z.object({
  ventureId: z.string().uuid('Valid venture ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  headUserId: z.string().uuid('Valid user ID is required').nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  headUserId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const assignDepartmentHeadSchema = z.object({
  headUserId: z.string().uuid().nullable(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type AssignDepartmentHeadInput = z.infer<typeof assignDepartmentHeadSchema>;
