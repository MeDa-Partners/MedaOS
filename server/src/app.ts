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

  // 1. Trust Reverse Proxy (Render load balancer, Vercel edge, Cloudflare)
  // Required so req.secure, client IP, and secure cookies work properly behind HTTPS proxies.
  app.set('trust proxy', 1);

  // 2. Security Headers (allow cross-origin API calls)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 3. CORS configuration for frontend credentials & session cookies
  const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, ''));
  const allowedOrigins = Array.from(
    new Set([
      ...configuredOrigins,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ])
  );

  const isOriginAllowed = (origin: string): boolean => {
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
      return true;
    }
    // Allow any Vercel deployment (e.g. meda-os.vercel.app or branch preview URLs)
    if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(cleanOrigin)) {
      return true;
    }
    // Allow Render deployment domain
    if (/^https:\/\/[a-zA-Z0-9_.-]+\.onrender\.com$/.test(cleanOrigin)) {
      return true;
    }
    return false;
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        callback(null, false);
      },
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Venture-Id'],
    })
  );

  // 4. Body Parsing & Cookie Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 5. Global standard rate limiter
  app.use(standardRateLimiter);

  // 6. Health Check
  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'meda-os-backend',
    });
  });

  app.get("/api/test", async (_req: Request, res: Response) => {
    const start = Date.now();

    res.json({
      message: "Backend is working",
      time: `${Date.now() - start}ms`,
    });
  });

  // 7. API Routes Mount (both /api/v1 and root fallback for deployment resilience)
  const apiRouter = express.Router();
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', usersRoutes);
  apiRouter.use('/employees', usersRoutes);
  apiRouter.use('/teams', teamsRoutes);
  apiRouter.use('/ventures', venturesRoutes);
  apiRouter.use('/sections', sectionsRoutes);

  // Mount at standard /api/v1 prefix
  app.use('/api/v1', apiRouter);

  // Fallback mount at root in case client deployment omits /api/v1
  app.use('/auth', authRoutes);
  app.use('/users', usersRoutes);
  app.use('/employees', usersRoutes);
  app.use('/teams', teamsRoutes);
  app.use('/ventures', venturesRoutes);
  app.use('/sections', sectionsRoutes);

  // 8. 404 Catch-All Route
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
