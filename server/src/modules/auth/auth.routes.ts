import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { authRateLimiter } from '../../middleware/rate-limiter';

const router = Router();

// Public routes (rate limited)
router.post('/login', authRateLimiter, (req, res, next) =>
  authController.login(req, res, next)
);

// Protected routes (requires valid session)
router.post('/logout', authenticate, (req, res, next) =>
  authController.logout(req, res, next)
);

router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

router.patch('/change-password', authenticate, (req, res, next) =>
  authController.changePassword(req, res, next)
);

export const authRoutes = router;
