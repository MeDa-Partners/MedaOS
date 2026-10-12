import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertCanManageDepartment, assertCanManageTeam, assertCanManageUser } from '../src/utils/authorization';
import { ForbiddenError, NotFoundError, BadRequestError } from '../src/utils/errors';
import { usersService } from '../src/modules/users/users.service';

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

describe('Organizational Hierarchy & Authority Policy Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Global Admin Access', () => {
    it('Global Admin bypasses department authority checks without membership', async () => {
      await expect(
        assertCanManageDepartment('admin-id', true, 'dept-any')
      ).resolves.toBeUndefined();
    });

    it('Global Admin bypasses team authority checks without membership', async () => {
      await expect(
        assertCanManageTeam('admin-id', true, 'team-any')
      ).resolves.toBeUndefined();
    });

    it('Global Admin can manage any user', async () => {
      await expect(
        assertCanManageUser('admin-id', true, 'user-any')
      ).resolves.toBeUndefined();
    });
  });

  describe('Department Head Scope', () => {
    it('Department Head can manage their own department', async () => {
      vi.mocked(db.select).mockReturnValue(
        mockQuery([{ id: 'dept-1', headUserId: 'user-head-1' }])
      );

      await expect(
        assertCanManageDepartment('user-head-1', false, 'dept-1')
      ).resolves.toBeUndefined();
    });

    it('Department Head cannot manage another department', async () => {
      vi.mocked(db.select).mockReturnValue(
        mockQuery([{ id: 'dept-2', headUserId: 'user-head-other' }])
      );

      await expect(
        assertCanManageDepartment('user-head-1', false, 'dept-2')
      ).rejects.toThrow(ForbiddenError);
    });

    it('Department Head can manage a team belonging to their department', async () => {
      vi.mocked(db.select).mockReturnValue(
        mockQuery([
          {
            id: 'team-1',
            departmentId: 'dept-1',
            headUserId: 'team-leader-id',
            deptHeadUserId: 'user-head-1',
          },
        ])
      );

      await expect(
        assertCanManageTeam('user-head-1', false, 'team-1')
      ).resolves.toBeUndefined();
    });
  });

  describe('Team Head Scope', () => {
    it('Team Head can manage their own team', async () => {
      vi.mocked(db.select).mockReturnValue(
        mockQuery([{ id: 'team-1', departmentId: 'dept-1', headUserId: 'user-team-head' }])
      );

      await expect(
        assertCanManageTeam('user-team-head', false, 'team-1')
      ).resolves.toBeUndefined();
    });

    it('Team Head cannot manage another team', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        // 1st: team-2 has different head and belongs to dept-1
        // 2nd: dept-1 has different dept head
        return mockQuery([
          callCount === 1
            ? { id: 'team-2', departmentId: 'dept-1', headUserId: 'other-head' }
            : { id: 'dept-1', headUserId: 'dept-head-id' },
        ]);
      });

      await expect(
        assertCanManageTeam('user-team-head', false, 'team-2')
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('Membership & Section Assignment Integrity', () => {
    it('Rejects assigning team from a different department than the selected department', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Department belongs to venture
          return mockQuery([{ id: 'dept-1', ventureId: 'v-1' }]);
        }
        // Team does NOT belong to dept-1 (returns empty)
        return mockQuery([]);
      });

      await expect(
        usersService.assignMembership(
          'user-1',
          {
            ventureId: 'v-1',
            departmentId: 'dept-1',
            teamId: 'team-from-different-dept',
          },
          { id: 'admin-1', isAdmin: true }
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('Allows user to have multiple section assignments within their assigned department', async () => {
      const mockValues = vi.fn().mockReturnValue(mockQuery([]));
      const mockTxInsert = vi.fn().mockReturnValue({ values: mockValues });
      const mockTxDelete = vi.fn().mockReturnValue(mockQuery([]));
      const mockTx = {
        insert: mockTxInsert,
        delete: mockTxDelete,
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // User memberships (department dept-1)
          return mockQuery([{ departmentId: 'dept-1' }]);
        }
        if (callCount === 2) {
          // Sections query (returns both sections sec-1 and sec-2 in dept-1)
          return mockQuery([
            { id: 'sec-1', departmentId: 'dept-1' },
            { id: 'sec-2', departmentId: 'dept-1' },
          ]);
        }
        // Hydrate users
        return mockQuery([
          {
            id: 'user-1',
            name: 'User 1',
            email: 'u1@meda.com',
            isAdmin: false,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
      });

      const result = await usersService.assignSections(
        'user-1',
        { sectionIds: ['sec-1', 'sec-2'] },
        { id: 'admin-1', isAdmin: true }
      );

      expect(db.transaction).toHaveBeenCalled();
      expect(mockTxInsert).toHaveBeenCalled();
      expect(result.id).toBe('user-1');
    });

    it('Forbids non-admin Department Head from assigning sections to themselves', async () => {
      // assertCanManageUser passes for user-head
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return mockQuery([{ departmentId: 'dept-1', headUserId: 'user-head' }]);
      });

      await expect(
        usersService.assignSections(
          'user-head',
          { sectionIds: ['sec-1'] },
          { id: 'user-head', isAdmin: false }
        )
      ).rejects.toThrow('You cannot assign sections to yourself');
    });

    it('Section assignment does NOT grant team management authority to employee', async () => {
      // Employee has section access, but assertCanManageTeam checks team authority
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Team query: team belongs to dept-1, headed by someone else
          return mockQuery([
            { id: 'team-1', departmentId: 'dept-1', headUserId: 'team-leader-id' },
          ]);
        }
        // Department query: dept-1 headed by someone else
        return mockQuery([{ id: 'dept-1', headUserId: 'dept-head-id' }]);
      });

      // Employee cannot manage team
      await expect(
        assertCanManageTeam('ordinary-employee-id', false, 'team-1')
      ).rejects.toThrow(ForbiddenError);
    });
  });
});

