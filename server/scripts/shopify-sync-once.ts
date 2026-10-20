/**
 * Runs ONE Shopify sync for SHOPIFY_VENTURE_SLUG and prints the result and the sync state.
 * Same code path as the 5-minute schedule; safe to run while the server is running (the lease
 * stops two syncs overlapping).
 *
 *   npm run shopify:sync-once
 */
import { sqlClient } from '../src/db';
import { env } from '../src/config/env';
import { runConfiguredShopifySync } from '../src/modules/shopify/sync';
import { getSyncHealth } from '../src/modules/sync/sync.service';

async function main() {
  const result = await runConfiguredShopifySync();
  console.log('Result:', result);
  console.log('Health:', await getSyncHealth(env.SHOPIFY_VENTURE_SLUG));
}

main()
  .catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
