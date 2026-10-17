import { Router } from 'express';
import { departmentsController } from './departments.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/require-admin';

// Creating, renaming and deleting departments is catalog work done in /dev (see dev module).
const router = Router();

router.use(authenticate);

router.get('/', departmentsController.list);
router.get('/:id', departmentsController.getById);
router.patch('/:id/head', requireAdmin, departmentsController.assignHead);

export const departmentsRoutes = router;
