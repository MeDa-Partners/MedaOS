import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sectionsService } from '../src/modules/sections/sections.service';
import { departmentsService } from '../src/modules/departments/departments.service';
import { teamsService } from '../src/modules/teams/teams.service';
import { usersService } from '../src/modules/users/users.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../src/utils/errors';

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
    returning: vi.fn().mockImplementation(() => Promise.resolve(result)),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe('Leadership & Section Authorization Integrity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Section Operational Access Ordering (checkAccess)', () => {
    const disabledSectionRecord = {
      id: 'sec-1',
      departmentId: 'dept-1',
      departmentName: 'Sales Dept',
      departmentSlug: 'sales',
      deptHeadUserId: 'u-head-1',
      ventureId: 'v-1',
      ventureName: 'WayVeda',
      ventureSlug: 'wayveda',
      name: 'Leads',
      slug: 'leads',
      status: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const activeSectionRecord = {
      ...disabledSectionRecord,
      status: 'active',
    };

    it('denies operational access to disabled section for Global Admin', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([disabledSectionRecord]));

      const result = await sectionsService.checkAccess('wayveda', 'leads', 'u-admin', true);
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('This section is currently disabled');
    });

    it('denies operational access to disabled section for Department Head', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([disabledSectionRecord]));

      const result = await sectionsService.checkAccess('wayveda', 'leads', 'u-head-1', false);
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('This section is currently disabled');
    });

    it('denies operational access to disabled section for ordinary Employee', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([disabledSectionRecord]));

      const result = await sectionsService.checkAccess('wayveda', 'leads', 'u-emp-1', false);
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('This section is currently disabled');
    });

    it('allows Department Head access to active section when having department membership', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([activeSectionRecord]);
        // Membership query
        return mockQuery([{ id: 'm-1' }]);
      });

      const result = await sectionsService.checkAccess('wayveda', 'leads', 'u-head-1', false);
      expect(result.hasAccess).toBe(true);
      expect(result.section?.id).toBe('sec-1');
    });

    it('denies Department Head if user lacks membership in the owning department', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([activeSectionRecord]);
        // Membership query returns empty
        return mockQuery([]);
      });

      const result = await sectionsService.checkAccess('wayveda', 'leads', 'u-head-1', false);
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toContain('do not belong to the department');
    });

    it('allows Employee access to active section when assigned', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([activeSectionRecord]);
        if (callCount === 2) return mockQuery([{ id: 'm-1' }]); // membership
        return mockQuery([{ id: 'sec-assign-1' }]); // section assignment
      });

      const result = await sectionsService.checkAccess('wayveda', 'leads', 'u-emp-1', false);
      expect(result.hasAccess).toBe(true);
    });

    it('denies Employee access to active section when NOT assigned', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([activeSectionRecord]);
        if (callCount === 2) return mockQuery([{ id: 'm-1' }]); // membership
        return mockQuery([]); // no section assignment
      });

      const result = await sectionsService.checkAccess('wayveda', 'leads', 'u-emp-1', false);
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toContain('has not been granted');
    });
  });

  describe('2. Leadership Assignment Integrity (Departments & Teams)', () => {
    it('Department Head assignment rejects when user does not exist', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([{ id: 'dept-1', ventureId: 'v-1' }]); // dept
        return mockQuery([]); // user not found
      });

      await expect(
        departmentsService.assignHead('dept-1', 'non-existent-user', { id: 'admin-1', isAdmin: true })
      ).rejects.toThrow(BadRequestError);
    });

    it('Department Head assignment rejects when user is inactive', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([{ id: 'dept-1', ventureId: 'v-1' }]);
        return mockQuery([{ id: 'u-inactive', status: 'inactive' }]);
      });

      await expect(
        departmentsService.assignHead('dept-1', 'u-inactive', { id: 'admin-1', isAdmin: true })
      ).rejects.toThrow(BadRequestError);
    });

    it('Department Head assignment rejects when user is not a member of the department', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([{ id: 'dept-1', ventureId: 'v-1' }]);
        if (callCount === 2) return mockQuery([{ id: 'u-active', status: 'active' }]);
        return mockQuery([]); // membership query returns empty
      });

      await expect(
        departmentsService.assignHead('dept-1', 'u-active', { id: 'admin-1', isAdmin: true })
      ).rejects.toThrow(/User must have an active membership in this venture and department/);
    });

    it('Department Head assignment fails if caller is not Global Admin', async () => {
      await expect(
        departmentsService.assignHead('dept-1', 'u-active', { id: 'u-dept-head', isAdmin: false })
      ).rejects.toThrow(ForbiddenError);
    });

    it('Team Head assignment rejects when user is not a member of the team', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([{ id: 'team-1', departmentId: 'dept-1' }]); // team
        if (callCount === 2) return mockQuery([{ id: 'u-active', status: 'active' }]); // user
        return mockQuery([]); // team membership query returns empty
      });

      await expect(
        teamsService.assignHead('team-1', 'u-active', { id: 'admin-1', isAdmin: true })
      ).rejects.toThrow(/User must belong to this team and department/);
    });

    it('Team Head assignment rejects when user is inactive', async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockQuery([{ id: 'team-1', departmentId: 'dept-1' }]);
        return mockQuery([{ id: 'u-inactive', status: 'inactive' }]);
      });

      await expect(
        teamsService.assignHead('team-1', 'u-inactive', { id: 'admin-1', isAdmin: true })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('3. Membership Changes & Deactivation Integrity', () => {
    it('Deactivating user nullifies Department Head and Team Head roles in transaction', async () => {
      const mockTxUpdate = vi.fn().mockReturnValue(mockQuery([]));
      const mockTxDelete = vi.fn().mockReturnValue(mockQuery([]));
      const mockTx = {
        update: mockTxUpdate,
        delete: mockTxDelete,
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      let selectCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) {
          return mockQuery([
            {
              id: 'u-head',
              name: 'Leader',
              email: 'leader@meda.com',
              isAdmin: false,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);
        }
        return mockQuery([]);
      });

      await usersService.updateStatus(
        'u-head',
        { status: 'inactive' },
        { id: 'admin-1', isAdmin: true }
      );

      // Verify transaction was called
      expect(db.transaction).toHaveBeenCalled();
      // Sessions deleted
      expect(mockTx.delete).toHaveBeenCalled();
      // Dept head and team head updated to null
      expect(mockTx.update).toHaveBeenCalledTimes(3); // users status update + departments head nullify + teams head nullify
    });

    it('Prevents self status deactivation', async () => {
      await expect(
        usersService.updateStatus(
          'user-1',
          { status: 'inactive' },
          { id: 'user-1', isAdmin: true }
        )
      ).rejects.toThrow('You cannot deactivate your own account');
    });

    it('Prevents non-admin deactivating any user', async () => {
      vi.mocked(db.select).mockReturnValue(mockQuery([{ id: 'user-2' }]));

      await expect(
        usersService.updateStatus(
          'user-2',
          { status: 'inactive' },
          { id: 'user-1', isAdmin: false }
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('Moving an employee to another department revokes old Department Head and cleans old sections', async () => {
      const mockTxUpdate = vi.fn().mockReturnValue(mockQuery([]));
      const mockTxDelete = vi.fn().mockReturnValue(mockQuery([]));
      const mockTxSelect = vi.fn().mockImplementation(() => {
        return mockQuery([
          { id: 'mem-1', departmentId: 'dept-old', teamId: 'team-old' },
        ]);
      });
      const mockTx = {
        select: mockTxSelect,
        update: mockTxUpdate,
        delete: mockTxDelete,
        insert: vi.fn().mockReturnValue(mockQuery([])),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      let selectCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) {
          // Verify department belongs to venture
          return mockQuery([{ id: 'dept-new', ventureId: 'v-1' }]);
        }
        if (selectCount === 2) {
          // Verify team belongs to department
          return mockQuery([{ id: 'team-new', departmentId: 'dept-new' }]);
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

      await usersService.assignMembership(
        'user-1',
        {
          ventureId: 'v-1',
          departmentId: 'dept-new',
          teamId: 'team-new',
        },
        { id: 'admin-1', isAdmin: true }
      );

      expect(db.transaction).toHaveBeenCalled();
      // Updates departments (to nullify head if user was head of dept-old)
      expect(mockTx.update).toHaveBeenCalled();
    });
  });
});
