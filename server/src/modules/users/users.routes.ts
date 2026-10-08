import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireEmployeeManagement } from '../../middleware/require-employee-management';

const router = Router();

// 1. Employee list (GET /) with profiling logs for performance monitoring
router.get(
  '/',
  (req, _res, next) => {
    const start = Date.now();
    (req as any)._apiStart = start;
    console.log('1. API started');

    (req as any)._authStart = Date.now();
    next();
  },
  authenticate,
  requireEmployeeManagement,
  (req, _res, next) => {
    const authStart = (req as any)._authStart || Date.now();
    console.log('2. Auth:', Date.now() - authStart, 'ms');
    next();
  },
  (req, res, next) => usersController.list(req, res, next)
);

// Employee management endpoints require authentication and Employee Management authorization
// (Authorized for global administrators and venture team managers with 'employees' section access)
router.use(authenticate, requireEmployeeManagement);
router.post('/', (req, res, next) => usersController.create(req, res, next));
router.get('/:id', (req, res, next) => usersController.getById(req, res, next));
router.patch('/:id', (req, res, next) => usersController.update(req, res, next));
router.patch('/:id/status', (req, res, next) =>
  usersController.updateStatus(req, res, next)
);

// Assigning venture team membership
router.patch('/:id/team', (req, res, next) =>
  usersController.assignTeam(req, res, next)
);
router.patch('/:id/assignment', (req, res, next) =>
  usersController.assignTeam(req, res, next)
);
router.delete('/:id/assignment/:ventureId', (req, res, next) =>
  usersController.removeVenture(req, res, next)
);

// Assigning venture section access
router.patch('/:id/sections', (req, res, next) =>
  usersController.assignSections(req, res, next)
);

router.post('/:id/reset-password', (req, res, next) =>
  usersController.resetPassword(req, res, next)
);

export const usersRoutes = router;
