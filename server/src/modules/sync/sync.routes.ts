import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireVentureAccess } from '../../middleware/require-venture';
import { sendSuccess } from '../../utils/response';
import { getSyncHealth } from './sync.service';

const router = Router();

router.use(authenticate);

/** GET /sync/health?ventureId=<id or slug> — last run, last error, and whether the sync is stale. */
router.get('/health', requireVentureAccess('ventureId'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await getSyncHealth(req.ventureId!));
  } catch (error) {
    next(error);
  }
});

export const syncRoutes = router;
