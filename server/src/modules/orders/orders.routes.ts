import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireSection } from '../../middleware/require-section';
import { BadRequestError } from '../../utils/errors';
import { ordersController } from './orders.controller';
import { SCOPE_SECTION, scopeQuerySchema } from './orders.validation';

// Venture comes from ?ventureId= (id or slug) or the X-Venture-Id header; requireSection resolves it
// into req.ventureId and every query in the services filters by it.

/** List and detail are guarded by the section of the screen asking (?scope=orders|verification|portal). */
function requireScopeSection(req: Request, res: Response, next: NextFunction) {
  const parsed = scopeQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(new BadRequestError('Invalid scope'));
  return requireSection(SCOPE_SECTION[parsed.data.scope])(req, res, next);
}

const router = Router();
router.use(authenticate);

router.get('/', requireScopeSection, ordersController.list);
router.post('/bulk-reassign', requireSection('shifts'), ordersController.bulkReassign);
router.get('/:id', requireScopeSection, ordersController.get);
router.patch('/:id/verification', requireSection('verification'), ordersController.updateVerification);
router.patch('/:id/portal', requireSection('portal-actions'), ordersController.updatePortal);
router.patch('/:id/follow-up', requireSection('orders'), ordersController.updateFollowUp);
router.post('/:id/reassign', requireSection('shifts'), ordersController.reassign);

export const ordersRoutes = router;

const shifts = Router();
shifts.use(authenticate);
shifts.get('/', requireSection('shifts'), ordersController.getShifts);
shifts.put('/', requireSection('shifts'), ordersController.saveShifts);

export const shiftsRoutes = shifts;
