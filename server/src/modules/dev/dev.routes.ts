import { Router } from 'express';
import { devController } from './dev.controller';
import { authenticateDev } from '../../middleware/authenticate-dev';
import { authRateLimiter } from '../../middleware/rate-limiter';

const router = Router();

// 1. Developer Authentication (isolated from employee login)
router.post('/auth/login', authRateLimiter, (req, res, next) =>
  devController.login(req, res, next)
);

// All routes below require valid Developer Authentication
router.use(authenticateDev);

router.post('/auth/logout', (req, res, next) => devController.logout(req, res, next));
router.get('/auth/me', (req, res, next) => devController.me(req, res, next));

// 2. Feature Registry & Complete Catalog Overview
router.get('/registry', (req, res, next) => devController.getRegistry(req, res, next));
router.get('/overview', (req, res, next) => devController.getCatalogOverview(req, res, next));

// 3. Ventures Catalog Management
router.get('/ventures', (req, res, next) => devController.listVentures(req, res, next));
router.post('/ventures', (req, res, next) => devController.createVenture(req, res, next));
router.patch('/ventures/:id', (req, res, next) => devController.updateVenture(req, res, next));
router.delete('/ventures/:id', (req, res, next) => devController.deleteVenture(req, res, next));

// 4. Departments Catalog Management
router.get('/departments', (req, res, next) => devController.listDepartments(req, res, next));
router.post('/departments', (req, res, next) => devController.createDepartment(req, res, next));
router.patch('/departments/:id', (req, res, next) => devController.updateDepartment(req, res, next));
router.delete('/departments/:id', (req, res, next) => devController.deleteDepartment(req, res, next));

// 5. Sections Catalog Management
router.get('/sections', (req, res, next) => devController.listSections(req, res, next));
router.post('/sections', (req, res, next) => devController.createSection(req, res, next));
router.patch('/sections/:id', (req, res, next) => devController.updateSection(req, res, next));
router.delete('/sections/:id', (req, res, next) => devController.deleteSection(req, res, next));

export const devRoutes = router;
