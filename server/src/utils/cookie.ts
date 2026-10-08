import { Request, CookieOptions } from 'express';
import { env } from '../config/env';

/**
 * Helper to generate consistent session cookie options.
 *
 * For cross-site frontend/backend deployments (e.g. Vercel frontend + Render backend):
 * Modern browsers require SameSite=None and Secure=true for credentials: 'include'.
 * For local HTTP development, SameSite=Lax and Secure=false are used.
 */
export function getSessionCookieOptions(req: Request, maxAgeMs?: number): CookieOptions {
  const isSecure =
    env.NODE_ENV === 'production' ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}
