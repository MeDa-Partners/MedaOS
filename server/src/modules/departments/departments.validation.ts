import { z } from 'zod';

export const assignDepartmentHeadSchema = z.object({
  headUserId: z.string().uuid().nullable(),
});
