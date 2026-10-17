import { Router } from 'express';
import { usersController as c } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireLeadership } from '../../middleware/require-leadership';

/**
 * People management. Only leaders (admin, department heads, team heads) get past the router;
 * every handler then applies the fine-grained rules in `utils/access.ts`.
 */
const router = Router();

router.use(authenticate, requireLeadership);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.patch('/:id', c.update);
router.patch('/:id/status', c.updateStatus);
router.post('/:id/reset-password', c.resetPassword);

// Placement: department + team inside a venture
router.put('/:id/membership', c.setMembership);
router.delete('/:id/membership/:ventureId', c.removeMembership);

// Section access (user-based)
router.put('/:id/sections', c.setSections);
router.post('/:id/sections/:sectionId', c.grantSection);
router.delete('/:id/sections/:sectionId', c.revokeSection);

export const usersRoutes = router;
