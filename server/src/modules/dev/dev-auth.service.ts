import crypto from 'node:crypto';
import { env } from '../../config/env';
import { verifyPassword } from '../../utils/crypto';
import { UnauthorizedError } from '../../utils/errors';

export interface DevSessionPayload {
  username: string;
  exp: number;
}

export class DevAuthService {
  /**
   * Validates developer credentials against server environment configuration.
   * Completely isolated from application database.
   */
  async authenticateDeveloper(usernameInput: string, passwordInput: string): Promise<string> {
    const expectedUsername = env.DEV_ADMIN_USERNAME;

    // Constant-time compare username
    const uMatch =
      usernameInput.length === expectedUsername.length &&
      crypto.timingSafeEqual(
        Buffer.from(usernameInput, 'utf-8'),
        Buffer.from(expectedUsername, 'utf-8')
      );

    if (!uMatch) {
      throw new UnauthorizedError('Invalid developer credentials');
    }

    let passwordValid = false;
    if (env.DEV_ADMIN_PASSWORD_HASH) {
      passwordValid = await verifyPassword(env.DEV_ADMIN_PASSWORD_HASH, passwordInput);
    } else {
      const expectedPassword = env.DEV_ADMIN_PASSWORD;
      passwordValid =
        passwordInput.length === expectedPassword.length &&
        crypto.timingSafeEqual(
          Buffer.from(passwordInput, 'utf-8'),
          Buffer.from(expectedPassword, 'utf-8')
        );
    }

    if (!passwordValid) {
      throw new UnauthorizedError('Invalid developer credentials');
    }

    // Generate signed session token
    const token = this.generateToken(expectedUsername);
    return token;
  }

  /**
   * Generates a tamper-proof HMAC-SHA256 signed developer session token.
   */
  generateToken(username: string): string {
    const payload: DevSessionPayload = {
      username,
      exp: Date.now() + env.DEV_SESSION_TTL_HOURS * 3600 * 1000,
    };

    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', env.DEV_SESSION_SECRET)
      .update(encoded)
      .digest('base64url');

    return `${encoded}.${signature}`;
  }

  /**
   * Verifies a signed developer session token.
   */
  verifyToken(token: string): DevSessionPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Developer authentication token required');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedError('Malformed developer authentication token');
    }

    const [encoded, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', env.DEV_SESSION_SECRET)
      .update(encoded)
      .digest('base64url');

    const sigMatches =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature, 'utf-8'),
        Buffer.from(expectedSignature, 'utf-8')
      );

    if (!sigMatches) {
      throw new UnauthorizedError('Invalid developer token signature');
    }

    let payload: DevSessionPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    } catch {
      throw new UnauthorizedError('Invalid developer token payload');
    }

    if (Date.now() > payload.exp) {
      throw new UnauthorizedError('Developer session expired');
    }

    return payload;
  }
}

export const devAuthService = new DevAuthService();
