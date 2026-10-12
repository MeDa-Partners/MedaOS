import { eq } from 'drizzle-orm';
import { db } from './index';
import { users } from './schema';
import { hashPassword } from '../utils/crypto';
import { env } from '../config/env';

/**
 * Idempotent bootstrap for initial Global Administrator.
 * Only executes if the initial administrator account does not yet exist.
 * Never resets password on subsequent boots.
 */
export async function bootstrapAdmin(): Promise<void> {
  const adminEmail = (env.ADMIN_INITIAL_EMAIL || 'admin@meda.com').toLowerCase().trim();
  const adminName = env.ADMIN_INITIAL_NAME || 'Global Administrator';
  const adminPassword = env.ADMIN_INITIAL_PASSWORD || 'Admin@MeDa2026!';

  try {
    const existing = await db
      .select({ id: users.id, email: users.email, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existing.length === 0) {
      console.log(`[Bootstrap] Initializing Global Admin (${adminEmail})...`);
      const passwordHash = await hashPassword(adminPassword);
      await db.insert(users).values({
        name: adminName,
        email: adminEmail,
        passwordHash,
        isAdmin: true,
        status: 'active',
      });
      console.log(`[Bootstrap] Global Administrator provisioned successfully.`);
    } else {
      // Ensure the configured initial admin has isAdmin = true
      if (!existing[0].isAdmin) {
        await db.update(users).set({ isAdmin: true }).where(eq(users.id, existing[0].id));
      }
      console.log(`[Bootstrap] Global Administrator account already exists.`);
    }
  } catch (error) {
    console.error('[Bootstrap] Failed to bootstrap administrator:', error);
    // Don't crash server if bootstrap fails on transient connection, but log warning
  }
}
