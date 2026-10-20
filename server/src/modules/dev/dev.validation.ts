import { z } from 'zod';

export const devLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const devCreateVentureSchema = z.object({
  name: z.string().min(2, 'Venture name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const devUpdateVentureSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const devCreateDepartmentSchema = z.object({
  ventureId: z.string().uuid('Valid venture ID is required'),
  name: z.string().min(2, 'Department name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const devUpdateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const devCreateSectionSchema = z.object({
  departmentId: z.string().uuid('Valid department ID is required'),
  name: z.string().min(2, 'Section name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const devUpdateSectionSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type DevLoginInput = z.infer<typeof devLoginSchema>;
export type DevCreateVentureInput = z.infer<typeof devCreateVentureSchema>;
export type DevUpdateVentureInput = z.infer<typeof devUpdateVentureSchema>;
export type DevCreateDepartmentInput = z.infer<typeof devCreateDepartmentSchema>;
export type DevUpdateDepartmentInput = z.infer<typeof devUpdateDepartmentSchema>;
export type DevCreateSectionInput = z.infer<typeof devCreateSectionSchema>;
export type DevUpdateSectionInput = z.infer<typeof devUpdateSectionSchema>;
