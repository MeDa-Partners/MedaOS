import { describe, it, expect, vi } from 'vitest';
import { requireAdmin } from '../src/middleware/require-admin';
import { requireSection } from '../src/middleware/require-section';
import { requireVentureAccess } from '../src/middleware/require-venture';
import { requireLeadership } from '../src/middleware/require-leadership';
import { requireEmployeeManagement } from '../src/middleware/require-employee-management';
import { ForbiddenError, UnauthorizedError, NotFoundError } from '../src/utils/errors';
import { Request, Response } from 'express';

// Mock DB
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '../src/db';

describe('Authorization Middleware Unit Tests', () => {
  describe('requireAdmin', () => {
    it('should allow requests when user is an admin', () => {
      const req = {
        user: { id: 'u1', name: 'Admin', email: 'admin@meda.com', isAdmin: true },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should deny requests when user is not an admin (403)', () => {
      const req = {
        user: { id: 'u2', name: 'Sales Rep', email: 'sales@meda.com', isAdmin: false },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should return 401 Unauthorized if request context is unauthenticated', () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('requireSection (Hierarchical Section Authorization)', () => {
    it('should allow Admin if active section exists in database', async () => {
      const req = {
        user: { id: 'u1', isAdmin: true },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            sectionId: 'sec-1',
            sectionName: 'Sales',
            sectionSlug: 'sales',
            sectionStatus: 'active',
            departmentId: 'dept-1',
            deptHeadUserId: null,
            ventureId: 'v-1',
            ventureName: 'WayVeda',
          },
        ]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny operational access if section is disabled for Global Admin (403)', async () => {
      const req = {
        user: { id: 'u1', isAdmin: true },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            sectionId: 'sec-1',
            sectionName: 'Sales',
            sectionSlug: 'sales',
            sectionStatus: 'inactive',
            departmentId: 'dept-1',
            deptHeadUserId: null,
            ventureId: 'v-1',
            ventureName: 'WayVeda',
          },
        ]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should deny operational access if section is disabled for Department Head (403)', async () => {
      const req = {
        user: { id: 'u-head', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            sectionId: 'sec-1',
            sectionName: 'Sales',
            sectionSlug: 'sales',
            sectionStatus: 'inactive',
            departmentId: 'dept-1',
            deptHeadUserId: 'u-head',
            ventureId: 'v-1',
            ventureName: 'WayVeda',
          },
        ]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should deny operational access if section is disabled for regular Employee (403)', async () => {
      const req = {
        user: { id: 'u-emp', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            sectionId: 'sec-1',
            sectionName: 'Sales',
            sectionSlug: 'sales',
            sectionStatus: 'inactive',
            departmentId: 'dept-1',
            deptHeadUserId: 'other-head',
            ventureId: 'v-1',
            ventureName: 'WayVeda',
          },
        ]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should allow Department Head if section is active and belongs to their department', async () => {
      const req = {
        user: { id: 'u-head', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Section query
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                sectionId: 'sec-1',
                sectionName: 'Sales',
                sectionSlug: 'sales',
                sectionStatus: 'active',
                departmentId: 'dept-1',
                deptHeadUserId: 'u-head',
                ventureId: 'v-1',
                ventureName: 'WayVeda',
              },
            ]),
          } as any;
        }
        // Membership query
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: 'mem-1' }]),
        } as any;
      });

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as any).ventureId).toBe('v-1');
    });

    it('should deny Department Head if department head does NOT belong to the department (403)', async () => {
      const req = {
        user: { id: 'u-head-other', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Section query
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                sectionId: 'sec-1',
                sectionName: 'Sales',
                sectionSlug: 'sales',
                sectionStatus: 'active',
                departmentId: 'dept-1',
                deptHeadUserId: 'u-head-1',
                ventureId: 'v-1',
                ventureName: 'WayVeda',
              },
            ]),
          } as any;
        }
        // Membership query: empty
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        } as any;
      });

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should allow Employee if section is active and assigned in userSections', async () => {
      const req = {
        user: { id: 'u-emp', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Section query
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                sectionId: 'sec-1',
                sectionName: 'Sales',
                sectionSlug: 'sales',
                sectionStatus: 'active',
                departmentId: 'dept-1',
                deptHeadUserId: 'u-head',
                ventureId: 'v-1',
                ventureName: 'WayVeda',
              },
            ]),
          } as any;
        }
        if (callCount === 2) {
          // Membership query
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'mem-1' }]),
          } as any;
        }
        // Section assignment query
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: 'assigned-1' }]),
        } as any;
      });

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect((req as any).ventureId).toBe('v-1');
    });

    it('should deny Employee if section is active but not assigned in userSections (403)', async () => {
      const req = {
        user: { id: 'u-emp', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                sectionId: 'sec-1',
                sectionName: 'Sales',
                sectionSlug: 'sales',
                sectionStatus: 'active',
                departmentId: 'dept-1',
                deptHeadUserId: 'u-head',
                ventureId: 'v-1',
                ventureName: 'WayVeda',
              },
            ]),
          } as any;
        }
        if (callCount === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 'mem-1' }]),
          } as any;
        }
        // Section assignment query: empty
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        } as any;
      });

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should throw NotFoundError (404) if section does not exist', async () => {
      const req = {
        user: { id: 'u2', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireSection('operations');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('requireVentureAccess (Hierarchical Venture Membership)', () => {
    it('should immediately allow Global Admin', async () => {
      const req = {
        user: { id: 'u1', isAdmin: true },
        params: { ventureId: 'wayveda' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = requireVentureAccess('ventureId');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should allow user if user has membership in userMemberships', async () => {
      const req = {
        user: { id: 'u2', isAdmin: false },
        params: { ventureId: 'wayveda' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ membershipId: 'm-1', ventureId: 'v-1', ventureName: 'WayVeda' }]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireVentureAccess('ventureId');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny user (403) if user has no membership in venture', async () => {
      const req = {
        user: { id: 'u2', isAdmin: false },
        params: { ventureId: 'other-venture' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireVentureAccess('ventureId');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('requireLeadership & requireEmployeeManagement', () => {
    it('should immediately allow Global Admin', async () => {
      const req = {
        user: { id: 'u1', isAdmin: true },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      await requireEmployeeManagement(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should allow Department Head with active leadership', async () => {
      const req = {
        user: { id: 'u-dept-head', isAdmin: false },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      // Mock getUserAuthorityContext: returns deptRecords with 1 dept and teamRecords with 0
      let callIndex = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callIndex++;
        const isDept = callIndex % 2 === 1;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(isDept ? [{ id: 'dept-1' }] : []),
        } as any;
      });

      await requireLeadership(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should deny non-admin non-leader employee (403)', async () => {
      const req = {
        user: { id: 'u-staff', isAdmin: false },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      } as any);

      await requireLeadership(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });
});
