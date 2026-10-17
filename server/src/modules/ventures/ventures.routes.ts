import { Router } from 'express';
import { venturesController } from './ventures.controller';
import { authenticate } from '../../middleware/authenticate';

// Creating, renaming and deleting ventures is catalog work done in /dev (see dev module).
const router = Router();

router.use(authenticate);

router.get('/', (req, res, next) => venturesController.list(req, res, next));
router.get('/:id', (req, res, next) => venturesController.getById(req, res, next));

export const venturesRoutes = router;
