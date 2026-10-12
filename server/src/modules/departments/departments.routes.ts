import { Router } from 'express';
import { departmentsController } from './departments.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/require-admin';
import { ForbiddenError } from '../../utils/errors';

const router = Router();

// Catalog structural mutations (create, edit, delete) are strictly restricted to Dev Admin (/dev)
router.post('/', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Department catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot create departments.'
    )
  );
});

router.delete('/:id', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Department catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot delete departments.'
    )
  );
});

router.use(authenticate);

// Operational leadership assignment: Global Admin can assign or change Department Heads
router.patch('/:id/head', requireAdmin, (req, res, next) => departmentsController.assignHead(req, res, next));

// Metadata editing is restricted to Dev Admin
router.patch('/:id', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Department catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot edit department definitions.'
    )
  );
});

// List and detail routes accessible to authenticated users
router.get('/', (req, res, next) => departmentsController.list(req, res, next));
router.get('/:id', (req, res, next) => departmentsController.getById(req, res, next));

export const departmentsRoutes = router;
