import { z } from 'zod';

const emailSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.string().email('Valid email is required')
);

const uuid = (label: string) => z.string().uuid(`Valid ${label} is required`);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be 150 characters or less'),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  /** Department to place the new employee in. Required for department heads; optional for admins. */
  departmentId: uuid('department').optional(),
  teamId: uuid('team').nullable().optional(),
  sectionIds: z.array(uuid('section')).optional().default([]),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(150).optional(),
  email: emailSchema.optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

/** Place a user in a department (and optionally a team). One department per venture. */
export const setMembershipSchema = z.object({
  departmentId: uuid('department'),
  teamId: uuid('team').nullable().optional().default(null),
});

/** Replace a user's granted sections inside one department. */
export const setSectionsSchema = z.object({
  departmentId: uuid('department'),
  sectionIds: z.array(uuid('section')),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().max(100).optional(),
  ventureId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  /** Admin only: include users with no membership in the selected venture. */
  includeUnassigned: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type SetMembershipInput = z.infer<typeof setMembershipSchema>;
export type SetSectionsInput = z.infer<typeof setSectionsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
