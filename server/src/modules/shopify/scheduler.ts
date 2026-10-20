import cron from 'node-cron';
import { env } from '../../config/env';
import { runConfiguredShopifySync } from './sync';

/**
 * Runs the Shopify sync every 5 minutes inside the API process (and once at boot).
 * Overlapping runs — two instances during a deploy, or a slow run — are stopped by the lease in
 * sync.ts, not here. Hosting must be always-on: a sleeping instance stops the schedule (orders
 * are not lost, the cursor catches up, but they arrive late).
 */
export function startShopifySyncSchedule(): void {
  if (env.NODE_ENV === 'test') return;
  if (!env.SHOPIFY_SYNC_ENABLED) {
    console.log('[Shopify] Sync schedule off (set SHOPIFY_SYNC_ENABLED=true to turn it on).');
    return;
  }

  const tick = async () => {
    try {
      const result = await runConfiguredShopifySync();
      if (result.status === 'ok') console.log(`[Shopify] Sync ok (${result.mode}): ${result.ordersSynced} order(s) written.`);
      else if (result.status === 'error') console.error(`[Shopify] Sync FAILED: ${result.error}`);
      else console.log(`[Shopify] Sync skipped: ${result.reason}.`);
    } catch (err) {
      console.error('[Shopify] Sync crashed:', err instanceof Error ? err.message : err);
    }
  };

  cron.schedule('*/5 * * * *', tick, { timezone: 'Asia/Kolkata' });
  console.log('[Shopify] Sync schedule on: every 5 minutes.');
  void tick();
}
