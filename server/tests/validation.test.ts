import { describe, it, expect } from 'vitest';
import { loginSchema, changePasswordSchema } from '../src/modules/auth/auth.validation';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
} from '../src/modules/users/users.validation';
import { createDepartmentSchema } from '../src/modules/departments/departments.validation';
import { createTeamSchema } from '../src/modules/teams/teams.validation';
import { createVentureSchema } from '../src/modules/ventures/ventures.validation';
import { createSectionSchema } from '../src/modules/sections/sections.validation';

describe('Validation Schemas', () => {
  describe('Auth Validation', () => {
    it('should validate and normalize login email', () => {
      const parsed = loginSchema.parse({
        email: '  Rahul.Sharma@Meda.COM  ',
        password: 'Password123!',
      });
      expect(parsed.email).toBe('rahul.sharma@meda.com');
      expect(parsed.password).toBe('Password123!');
    });

    it('should reject invalid emails on login', () => {
      expect(() =>
        loginSchema.parse({
          email: 'not-an-email',
          password: 'Password123!',
        })
      ).toThrow();
    });

    it('should require minimum 8 characters for new password', () => {
      expect(() =>
        changePasswordSchema.parse({
          currentPassword: 'oldpassword',
          newPassword: 'short',
        })
      ).toThrow();
    });
  });

  describe('User Validation', () => {
    it('should require a valid team UUID and normalize email on user creation', () => {
      const parsed = createUserSchema.parse({
        name: 'Rahul Sharma',
        email: '  Rahul@Meda.com  ',
        password: 'SecurePassword123!',
        teamId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
      });

      expect(parsed.email).toBe('rahul@meda.com');
      expect(parsed.name).toBe('Rahul Sharma');
      expect(parsed.status).toBe('active');
    });

    it('should reject non-UUID teamId on user creation', () => {
      expect(() =>
        createUserSchema.parse({
          name: 'Rahul Sharma',
          email: 'rahul@meda.com',
          password: 'SecurePassword123!',
          teamId: 'invalid-team-id',
        })
      ).toThrow();
    });

    it('should reject invalid user status', () => {
      expect(() =>
        updateStatusSchema.parse({
          status: 'suspended', // only active or inactive allowed
        })
      ).toThrow();
    });
  });

  describe('Department, Team, Venture & Section Validation', () => {
    it('should validate venture slugs', () => {
      const valid = createVentureSchema.parse({
        name: 'Nature Mania',
        slug: 'nature-mania',
      });
      expect(valid.slug).toBe('nature-mania');
    });

    it('should validate department schema with ventureId', () => {
      const valid = createDepartmentSchema.parse({
        ventureId: '11111111-1111-4111-8111-111111111111',
        name: 'Sales Department',
        slug: 'sales',
      });
      expect(valid.name).toBe('Sales Department');
      expect(valid.slug).toBe('sales');
      expect(valid.status).toBe('active');
    });

    it('should validate slug format for teams with departmentId', () => {
      const valid = createTeamSchema.parse({
        departmentId: '11111111-1111-4111-8111-111111111111',
        name: 'NBD Team',
        slug: 'nbd',
      });
      expect(valid.slug).toBe('nbd');

      expect(() =>
        createTeamSchema.parse({
          departmentId: '11111111-1111-4111-8111-111111111111',
          name: 'NBD Team',
          slug: 'NBD Team With Spaces',
        })
      ).toThrow();
    });

    it('should validate section schema with departmentId', () => {
      const valid = createSectionSchema.parse({
        departmentId: '11111111-1111-4111-8111-111111111111',
        name: 'Sales - NBD',
        slug: 'sales-nbd',
      });
      expect(valid.name).toBe('Sales - NBD');
      expect(valid.slug).toBe('sales-nbd');
      expect(valid.status).toBe('active');
    });
  });
});
