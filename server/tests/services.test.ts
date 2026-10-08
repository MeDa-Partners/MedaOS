import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usersService } from '../src/modules/users/users.service';
import { teamsService } from '../src/modules/teams/teams.service';
import { venturesService } from '../src/modules/ventures/ventures.service';
import { sectionsService } from '../src/modules/sections/sections.service';
import { ConflictError, NotFoundError, BadRequestError } from '../src/utils/errors';

// Mock DB
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
  sqlClient: {
    end: vi.fn(),
  },
}));

import { db } from '../src/db';

describe('Domain Services Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UsersService', () => {
    it('should throw ConflictError if creating user with already existing email', async () => {
      // Mock db.select returning an existing user
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
      } as any);

      await expect(
        usersService.createUser(
          {
            name: 'Rahul',
            email: 'rahul@meda.com',
            password: 'Password123!',
            status: 'active',
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should throw BadRequestError if specified team does not exist for venture', async () => {
      // First select: email check (returns empty)
      // Second select: team verification (returns empty)
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        } as any;
      });

      await expect(
        usersService.createUser(
          {
            name: 'Rahul',
            email: 'rahul@meda.com',
            password: 'Password123!',
            ventureId: '11111111-1111-4111-8111-111111111111',
            teamId: '22222222-2222-4222-8222-222222222222',
            status: 'active',
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError if getting a user that does not exist', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      await expect(
        usersService.getUserById('33333333-3333-4333-8333-333333333333', {
          id: 'admin-1',
          isAdmin: true,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('TeamsService', () => {
    it('should throw ConflictError if team slug is already taken within venture', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-team-id' }]),
      } as any);

      await expect(
        teamsService.createTeam({
          ventureId: '11111111-1111-4111-8111-111111111111',
          name: 'Sales',
          slug: 'sales',
          status: 'active',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('VenturesService', () => {
    it('should throw ConflictError if venture slug is already taken', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-venture-id' }]),
      } as any);

      await expect(
        venturesService.createVenture({
          name: 'Wayveda',
          slug: 'wayveda',
          status: 'active',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('SectionsService', () => {
    it('should throw ConflictError if section slug is already taken', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-section-id' }]),
      } as any);

      await expect(
        sectionsService.createSection({
          name: 'Sales Section',
          slug: 'sales',
          route: '/sales',
          status: 'active',
        })
      ).rejects.toThrow(ConflictError);
    });
  });
});
