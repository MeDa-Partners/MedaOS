import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sessions, users } from '../db/schema';
import { hashSessionToken } from '../utils/crypto';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { getSessionCookieOptions } from '../utils/cookie';

interface CachedSessionRecord {
  sessionId: string;
  sessionUserId: string;
  expiresAt: Date;
  lastUsedAt: Date;
  userId: string;
  userName: string;
  userEmail: string;
  userIsAdmin: boolean;
  userStatus: string;
}

interface CachedSession {
  record: CachedSessionRecord;
  cachedAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 30 * 1000; // 30 seconds TTL

export function invalidateSessionCache(tokenHash?: string): void {
  if (tokenHash) {
    sessionCache.delete(tokenHash);
  } else {
    sessionCache.clear();
  }
}

/**
 * Middleware that authenticates an incoming request via server-side session cookie.
 * Verifies session token hash against the database, validates expiry, and verifies user status.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = req.cookies?.[env.SESSION_COOKIE_NAME];

    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedError('Authentication required');
    }

    const tokenHash = hashSessionToken(rawToken);

    let record: CachedSessionRecord;
    const cached = sessionCache.get(tokenHash);

    if (cached && Date.now() - cached.cachedAt < SESSION_CACHE_TTL_MS) {
      record = cached.record;
    } else {
      // Retrieve the session and user from the database with single retry on transient network hiccup
      let sessionRecords;
      try {
        sessionRecords = await db
          .select({
            sessionId: sessions.id,
            sessionUserId: sessions.userId,
            expiresAt: sessions.expiresAt,
            lastUsedAt: sessions.lastUsedAt,
            userId: users.id,
            userName: users.name,
            userEmail: users.email,
            userIsAdmin: users.isAdmin,
            userStatus: users.status,
          })
          .from(sessions)
          .innerJoin(users, eq(sessions.userId, users.id))
          .where(eq(sessions.tokenHash, tokenHash))
          .limit(1);
      } catch (queryErr: any) {
        const isTransient =
          queryErr?.code === '57014' ||
          queryErr?.cause?.code === '57014' ||
          queryErr?.code === 'ECONNRESET' ||
          queryErr?.code === 'ETIMEDOUT';

        if (isTransient) {
          console.warn('[Auth] Transient DB delay on session lookup, retrying...');
          await new Promise((r) => setTimeout(r, 200));
          sessionRecords = await db
            .select({
              sessionId: sessions.id,
              sessionUserId: sessions.userId,
              expiresAt: sessions.expiresAt,
              lastUsedAt: sessions.lastUsedAt,
              userId: users.id,
              userName: users.name,
              userEmail: users.email,
              userIsAdmin: users.isAdmin,
              userStatus: users.status,
            })
            .from(sessions)
            .innerJoin(users, eq(sessions.userId, users.id))
            .where(eq(sessions.tokenHash, tokenHash))
            .limit(1);
        } else {
          throw queryErr;
        }
      }

      if (sessionRecords.length === 0) {
        sessionCache.delete(tokenHash);
        // Clear invalid cookie
        res.clearCookie(env.SESSION_COOKIE_NAME, getSessionCookieOptions(req));
        throw new UnauthorizedError('Invalid or expired session');
      }

      record = sessionRecords[0];
      sessionCache.set(tokenHash, {
        record,
        cachedAt: Date.now(),
      });
    }

    // Check if session has expired
    if (new Date() > record.expiresAt) {
      sessionCache.delete(tokenHash);
      // Invalidate expired session
      await db.delete(sessions).where(eq(sessions.id, record.sessionId));
      res.clearCookie(env.SESSION_COOKIE_NAME, getSessionCookieOptions(req));
      throw new UnauthorizedError('Session has expired. Please log in again.');
    }

    // Check user active status
    if (record.userStatus !== 'active') {
      sessionCache.delete(tokenHash);
      // Deactivate session for inactive user
      await db.delete(sessions).where(eq(sessions.id, record.sessionId));
      res.clearCookie(env.SESSION_COOKIE_NAME, getSessionCookieOptions(req));
      throw new ForbiddenError('Your account has been deactivated. Contact an administrator.');
    }

    // Throttle lastUsedAt update (only update if lastUsedAt is older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (record.lastUsedAt < fiveMinutesAgo) {
      db.update(sessions)
        .set({ lastUsedAt: new Date() })
        .where(eq(sessions.id, record.sessionId))
        .catch((err) => {
          console.error('Failed to update session lastUsedAt:', err);
        });
    }

    // Attach authenticated context to request
    req.user = {
      id: record.userId,
      name: record.userName,
      email: record.userEmail,
      isAdmin: record.userIsAdmin,
      status: record.userStatus,
    };

    req.session = {
      id: record.sessionId,
      expiresAt: record.expiresAt,
    };

    // Extract venture context if provided in header (X-Venture-Id) or query (?ventureId=)
    const headerVentureId = req.headers['x-venture-id'];
    const queryVentureId = req.query.ventureId;
    if (typeof headerVentureId === 'string' && headerVentureId.trim()) {
      req.ventureId = headerVentureId.trim();
    } else if (typeof queryVentureId === 'string' && queryVentureId.trim()) {
      req.ventureId = queryVentureId.trim();
    }

    next();
  } catch (error) {
    next(error);
  }
}
