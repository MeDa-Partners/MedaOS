import { Router } from 'express';
import { sectionsController } from './sections.controller';
import { authenticate } from '../../middleware/authenticate';
import { ForbiddenError } from '../../utils/errors';

const router = Router();

// Catalog structural mutations (create, edit, delete) are strictly restricted to Dev Admin (/dev)
router.post('/', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Section catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot create sections.'
    )
  );
});

router.patch('/:id/status', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Section catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot alter section status.'
    )
  );
});

router.patch('/:id', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Section catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot edit section definitions.'
    )
  );
});

router.delete('/:id', (_req, _res, next) => {
  next(
    new ForbiddenError(
      'Section catalog modifications are restricted to Dev Admin (/dev). Regular administrators cannot delete sections.'
    )
  );
});

router.use(authenticate);

router.get('/access-check', (req, res, next) => sectionsController.accessCheck(req, res, next));
router.get('/:slug/access-check', (req, res, next) => sectionsController.accessCheck(req, res, next));
router.get('/', (req, res, next) => sectionsController.list(req, res, next));
router.get('/:id', (req, res, next) => sectionsController.getById(req, res, next));

export const sectionsRoutes = router;
