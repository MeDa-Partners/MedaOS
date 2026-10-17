import { Router } from 'express';
import { sectionsController } from './sections.controller';
import { authenticate } from '../../middleware/authenticate';

// Creating, renaming, enabling and deleting sections is catalog work done in /dev (see dev module).
const router = Router();

router.use(authenticate);

router.get('/', sectionsController.list);
router.get('/:slug/access-check', sectionsController.accessCheck);
router.get('/:id', sectionsController.getById);

export const sectionsRoutes = router;
