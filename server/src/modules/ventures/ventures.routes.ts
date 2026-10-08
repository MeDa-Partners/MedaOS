import { Router } from 'express';
import { venturesController } from './ventures.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/require-admin';
import { requireVentureAccess } from '../../middleware/require-venture';

const router = Router();

// Viewing ventures requires authentication
router.get('/', authenticate, (req, res, next) =>
  venturesController.list(req, res, next)
);

router.get('/:id', authenticate, (req, res, next) =>
  venturesController.getById(req, res, next)
);

// Admin-only management
router.post('/', authenticate, requireAdmin, (req, res, next) =>
  venturesController.create(req, res, next)
);

router.patch('/:id', authenticate, requireAdmin, (req, res, next) =>
  venturesController.update(req, res, next)
);

router.patch('/:id/sections', authenticate, requireAdmin, (req, res, next) =>
  venturesController.setSections(req, res, next)
);

// Authorization test/verification endpoint for venture access
router.get(
  '/:ventureId/test-access',
  authenticate,
  requireVentureAccess('ventureId'),
  (req, res, next) => venturesController.testAccess(req, res, next)
);

export const venturesRoutes = router;
