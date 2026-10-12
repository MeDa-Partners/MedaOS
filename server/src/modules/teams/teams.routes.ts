import { Router } from 'express';
import { teamsController } from './teams.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', (req, res, next) => teamsController.list(req, res, next));
router.get('/:id', (req, res, next) => teamsController.getById(req, res, next));
router.post('/', (req, res, next) => teamsController.create(req, res, next));
router.patch('/:id/head', (req, res, next) => teamsController.assignHead(req, res, next));
router.patch('/:id', (req, res, next) => teamsController.update(req, res, next));
router.delete('/:id', (req, res, next) => teamsController.delete(req, res, next));

export const teamsRoutes = router;
