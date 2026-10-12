import { Router } from 'express';
import { venturesController } from './ventures.controller';
import { authenticate } from '../../middleware/authenticate';
import { ForbiddenError } from '../../utils/errors';

const router = Router();

// Catalog structural mutations (create, edit, delete) are strictly restricted to Dev Admin (/dev)
router.post('/', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Venture catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot create ventures.'
    )
  );
});
router.patch('/:id', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Venture catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot edit venture definitions.'
    )
  );
});
router.delete('/:id', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Venture catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot delete ventures.'
    )
  );
});

router.use(authenticate);

router.get('/', (req, res, next) => venturesController.list(req, res, next));
router.get('/:id', (req, res, next) => venturesController.getById(req, res, next));

export const venturesRoutes = router;
