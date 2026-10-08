import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireEmployeeManagement } from '../../middleware/require-employee-management';

const router = Router();

// Employee management endpoints require authentication and Employee Management authorization
// (Authorized for global administrators and venture team managers with 'employees' section access)
router.use(authenticate, requireEmployeeManagement);

router.get('/', (req, res, next) => usersController.list(req, res, next));
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
