import { describe, it, expect } from 'vitest';
import { loginSchema, changePasswordSchema } from '../src/modules/auth/auth.validation';
import {
  createUserSchema,
  setMembershipSchema,
  setSectionsSchema,
  updateStatusSchema,
} from '../src/modules/users/users.validation';
import { createTeamSchema } from '../src/modules/teams/teams.validation';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('Validation Schemas', () => {
  it('normalizes login email', () => {
    const parsed = loginSchema.parse({ email: '  Test@MeDa.com ', password: 'x' });
    expect(parsed.email).toBe('test@meda.com');
  });

  it('requires 8+ character new passwords', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success).toBe(false);
  });

  it('creates an employee with a department and no team', () => {
    const parsed = createUserSchema.parse({
      name: 'Asha',
      email: 'ASHA@meda.com',
      password: 'Password1!',
      departmentId: UUID,
    });
    expect(parsed.email).toBe('asha@meda.com');
    expect(parsed.teamId).toBeUndefined();
    expect(parsed.sectionIds).toEqual([]);
  });

  it('rejects non-UUID ids', () => {
    expect(
      createUserSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'Password1!', departmentId: 'sales' })
        .success
    ).toBe(false);
  });

  it('membership team defaults to null (in department, no team yet)', () => {
    expect(setMembershipSchema.parse({ departmentId: UUID }).teamId).toBeNull();
  });

  it('section updates are scoped to a department', () => {
    expect(setSectionsSchema.safeParse({ sectionIds: [UUID] }).success).toBe(false);
    expect(setSectionsSchema.safeParse({ departmentId: UUID, sectionIds: [] }).success).toBe(true);
  });

  it('rejects unknown statuses', () => {
    expect(updateStatusSchema.safeParse({ status: 'suspended' }).success).toBe(false);
  });

  it('validates team slugs', () => {
    expect(createTeamSchema.safeParse({ departmentId: UUID, name: 'North', slug: 'North Team' }).success).toBe(false);
    expect(createTeamSchema.safeParse({ departmentId: UUID, name: 'North' }).success).toBe(true);
  });
});
