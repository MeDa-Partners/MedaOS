import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { devAuthService } from '../modules/dev/dev-auth.service';
import { UnauthorizedError } from '../utils/errors';
import { getSessionCookieOptions } from '../utils/cookie';

/**
 * Middleware that strictly restricts access to authenticated Developer Administrators.
 * Completely isolated from normal user/employee sessions.
 * Normal Global Administrators cannot pass this middleware.
 */
export async function authenticateDev(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = req.cookies?.[env.DEV_SESSION_COOKIE_NAME];

    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedError(
        'Developer authentication required. Please sign in to Dev Admin.'
      );
    }

    try {
      const payload = devAuthService.verifyToken(rawToken);
      req.devUser = {
        username: payload.username,
        isDeveloper: true,
      };
      next();
    } catch (tokenError) {
      // Clear invalid developer session cookie
      res.clearCookie(env.DEV_SESSION_COOKIE_NAME, getSessionCookieOptions(req));
      throw new UnauthorizedError(
        tokenError instanceof Error ? tokenError.message : 'Invalid developer session'
      );
    }
  } catch (error) {
    next(error);
  }
}
