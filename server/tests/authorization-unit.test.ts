import { describe, it, expect, vi } from 'vitest';
import { requireAdmin } from '../src/middleware/require-admin';
import { requireSection } from '../src/middleware/require-section';
import { requireVentureAccess } from '../src/middleware/require-venture';
import { AppError, ForbiddenError, UnauthorizedError } from '../src/utils/errors';
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

  describe('requireSection (Generic Database-Driven Section Authorization)', () => {
    it('should immediately bypass check for Admin user (isAdmin = true)', async () => {
      const req = {
        user: { id: 'u1', isAdmin: true },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should allow non-admin employee if user has permission in user_sections database', async () => {
      const req = {
        user: { id: 'u2', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      // Mock database returning the matching record
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ userSectionId: 'us-123', ventureId: 'v1' }]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireSection('sales');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny non-admin employee (403) if user does not have section in database', async () => {
      const req = {
        user: { id: 'u2', isAdmin: false },
        params: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      // Mock database returning empty
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireSection('operations');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('requireVentureAccess (Generic User-Specific Venture Authorization)', () => {
    it('should immediately bypass check for Admin user', async () => {
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

    it('should allow user if venture is explicitly assigned in user_ventures', async () => {
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
        limit: vi.fn().mockResolvedValue([{ userVentureId: 'uv-1', ventureName: 'Wayveda' }]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      const middleware = requireVentureAccess('ventureId');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny user (403) if venture is not assigned in user_ventures', async () => {
      const req = {
        user: { id: 'u2', isAdmin: false },
        params: { ventureId: 'my-fit-brain' },
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

  describe('requireUserManagement (User Management Access Authorization)', () => {
    it('should immediately allow Global Admin', async () => {
      const { requireEmployeeManagement } = await import('../src/middleware/require-employee-management');
      const req = {
        user: { id: 'u1', isAdmin: true },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      await requireEmployeeManagement(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(db.select).not.toHaveBeenCalled();
    });

    it('should allow Team Head with employees section in user_sections', async () => {
      const { requireEmployeeManagement } = await import('../src/middleware/require-employee-management');
      const req = {
        user: { id: 'u-ops-head', isAdmin: false },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'sec-1' }]),
      };
      vi.mocked(db.select).mockReturnValue(mockQuery as any);

      await requireEmployeeManagement(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should deny non-admin without employees section (403)', async () => {
      const { requireEmployeeManagement } = await import('../src/middleware/require-employee-management');
      const req = {
        user: { id: 'u-staff', isAdmin: false },
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

      await requireEmployeeManagement(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });
});
