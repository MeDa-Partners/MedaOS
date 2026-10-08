import { Router } from 'express';
import { sectionsController } from './sections.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/require-admin';
import { requireSection } from '../../middleware/require-section';
import { requireEmployeeManagement } from '../../middleware/require-employee-management';

const router = Router();

// Viewing sections requires standard authentication
router.get('/', authenticate, (req, res, next) =>
  sectionsController.list(req, res, next)
);

// Specific section access check test endpoints
router.get(
  '/sales/access-check',
  authenticate,
  requireSection('sales'),
  sectionsController.accessCheck('sales')
);

router.get(
  '/operations/access-check',
  authenticate,
  requireSection('operations'),
  sectionsController.accessCheck('operations')
);

router.get(
  '/orders/access-check',
  authenticate,
  requireSection('orders'),
  sectionsController.accessCheck('orders')
);

router.get(
  '/nbd/access-check',
  authenticate,
  requireSection('nbd'),
  sectionsController.accessCheck('nbd')
);

router.get(
  '/marketing/access-check',
  authenticate,
  requireSection('marketing'),
  sectionsController.accessCheck('marketing')
);

router.get(
  '/employees/access-check',
  authenticate,
  requireEmployeeManagement,
  sectionsController.accessCheck('employees')
);

// Admin-only management endpoints
router.post('/', authenticate, requireAdmin, (req, res, next) =>
  sectionsController.create(req, res, next)
);

router.get('/:id', authenticate, (req, res, next) =>
  sectionsController.getById(req, res, next)
);

router.patch('/:id', authenticate, requireAdmin, (req, res, next) =>
  sectionsController.update(req, res, next)
);

export const sectionsRoutes = router;
