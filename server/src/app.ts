import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { standardRateLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import { NotFoundError } from './utils/errors';
import { sendSuccess } from './utils/response';

// Route modules
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { teamsRoutes } from './modules/teams/teams.routes';
import { venturesRoutes } from './modules/ventures/ventures.routes';
import { sectionsRoutes } from './modules/sections/sections.routes';

export function createApp(): Express {
  const app: Express = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS configuration for frontend credentials & session cookies
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Venture-Id'],
    })
  );

  // 3. Body Parsing & Cookie Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Global standard rate limiter
  app.use(standardRateLimiter);

  // 5. Health Check
  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'meda-os-backend',
    });
  });

  // 6. API v1 Mounts
  const apiV1 = express.Router();
  apiV1.use('/auth', authRoutes);
  apiV1.use('/users', usersRoutes);
  apiV1.use('/employees', usersRoutes);
  apiV1.use('/teams', teamsRoutes);
  apiV1.use('/ventures', venturesRoutes);
  apiV1.use('/sections', sectionsRoutes);

  app.use('/api/v1', apiV1);

  // 7. 404 Catch-All Route
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // 8. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
