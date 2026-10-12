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
    selectDistinct: vi.fn(),
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

function mockQuery(result: any[] = []) {
  const query: any = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(result)),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe('Domain Services Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UsersService', () => {
    it('should throw ConflictError if creating user with already existing email', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([{ id: 'existing-id' }]));

      await expect(
        usersService.createUser(
          {
            name: 'Rahul',
            email: 'rahul@meda.com',
            password: 'Password123!',
            status: 'active',
            sectionIds: [],
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should throw BadRequestError if specified department does not belong to venture', async () => {
      vi.mocked(db.select).mockImplementation(() => mockQuery([]));

      await expect(
        usersService.createUser(
          {
            name: 'Rahul',
            email: 'rahul@meda.com',
            password: 'Password123!',
            ventureId: '11111111-1111-4111-8111-111111111111',
            departmentId: '22222222-2222-4222-8222-222222222222',
            teamId: '33333333-3333-4333-8333-333333333333',
            status: 'active',
            sectionIds: [],
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError if getting a user that does not exist', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([]));

      await expect(
        usersService.getUserById('33333333-3333-4333-8333-333333333333', {
          id: 'admin-1',
          isAdmin: true,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('TeamsService', () => {
    it('should throw NotFoundError if department does not exist', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([]));

      await expect(
        teamsService.createTeam(
          {
            departmentId: '11111111-1111-4111-8111-111111111111',
            name: 'NBD',
            slug: 'nbd',
            status: 'active',
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if team slug is already taken within department', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        // 1st: department exists
        // 2nd: team slug exists in department
        return mockQuery([{ id: callCount === 1 ? 'dept-1' : 'existing-team-id', headUserId: null }]);
      });

      await expect(
        teamsService.createTeam(
          {
            departmentId: '11111111-1111-4111-8111-111111111111',
            name: 'Sales',
            slug: 'sales',
            status: 'active',
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('VenturesService', () => {
    it('should throw ConflictError if venture slug is already taken', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([{ id: 'existing-venture-id' }]));

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
    it('should throw NotFoundError if department does not exist', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([]));

      await expect(
        sectionsService.createSection(
          {
            departmentId: '11111111-1111-4111-8111-111111111111',
            name: 'Sales - NBD',
            slug: 'sales-nbd',
            status: 'active',
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if section slug is already taken in department', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return mockQuery([{ id: callCount === 1 ? 'dept-1' : 'existing-section-id', headUserId: null }]);
      });

      await expect(
        sectionsService.createSection(
          {
            departmentId: '11111111-1111-4111-8111-111111111111',
            name: 'Sales - NBD',
            slug: 'sales-nbd',
            status: 'active',
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(ConflictError);
    });
  });
});
