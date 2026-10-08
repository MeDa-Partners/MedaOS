import { Router } from 'express';
import { teamsController } from './teams.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/require-admin';

const router = Router();

// Viewing teams requires standard authentication
router.get('/', authenticate, (req, res, next) =>
  teamsController.list(req, res, next)
);
router.get('/:id', authenticate, (req, res, next) =>
  teamsController.getById(req, res, next)
);

// Modifying teams requires Administrator privileges
router.post('/', authenticate, requireAdmin, (req, res, next) =>
  teamsController.create(req, res, next)
);
router.patch('/:id', authenticate, requireAdmin, (req, res, next) =>
  teamsController.update(req, res, next)
);

export const teamsRoutes = router;
