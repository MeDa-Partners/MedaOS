import { z } from 'zod';

const emailSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.string().email('Valid email is required')
);

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(150, 'Name must be 150 characters or less'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long'),
  ventureId: z
    .string()
    .uuid('Valid venture UUID is required')
    .optional(),
  teamId: z
    .string()
    .uuid('Valid team UUID is required')
    .optional(),
  sectionIds: z
    .array(z.string().uuid('Each sectionId must be a valid UUID'))
    .optional()
    .default([]),
  status: z
    .enum(['active', 'inactive'])
    .optional()
    .default('active'),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(150)
    .optional(),
  email: emailSchema.optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export const assignTeamSchema = z.object({
  ventureId: z.string().uuid('Valid venture UUID is required'),
  teamId: z.string().uuid('Valid team UUID is required'),
});

export const assignSectionsSchema = z.object({
  ventureId: z.string().uuid('Valid venture UUID is required'),
  sectionIds: z.array(z.string().uuid('Each sectionId must be a valid UUID')),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AssignTeamInput = z.infer<typeof assignTeamSchema>;
export type AssignSectionsInput = z.infer<typeof assignSectionsSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

