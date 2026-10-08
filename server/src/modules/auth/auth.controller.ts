import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { loginSchema, changePasswordSchema } from './auth.validation';
import { sendSuccess } from '../../utils/response';
import { env } from '../../config/env';
import { getSessionCookieOptions } from '../../utils/cookie';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = loginSchema.parse(req.body);
      const result = await authService.login(validatedInput);

      // Set secure HttpOnly session cookie
      const cookieOptions = getSessionCookieOptions(req, env.SESSION_TTL_HOURS * 3600 * 1000);
      cookieOptions.expires = result.expiresAt;
      res.cookie(env.SESSION_COOKIE_NAME, result.rawToken, cookieOptions);

      sendSuccess(res, result.authData, 200, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.session?.id) {
        await authService.logout(req.session.id);
      }

      // Clear session cookie
      res.clearCookie(env.SESSION_COOKIE_NAME, getSessionCookieOptions(req));

      sendSuccess(res, null, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User context missing from authenticated request'));
      }

      const authData = await authService.getAuthMe(req.user.id);
      sendSuccess(res, authData, 200);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || !req.session) {
        return next(new Error('User context missing from authenticated request'));
      }

      const validatedInput = changePasswordSchema.parse(req.body);
      await authService.changePassword(
        req.user.id,
        validatedInput,
        req.session.id
      );

      sendSuccess(res, null, 200, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
