/**
 * READ-ONLY smoke test for the Shopify connection: gets a token, fetches the latest order and
 * prints the raw payload, the mapped row and the COD/Prepaid decision. Writes nothing anywhere.
 *
 *   npm run shopify:fetch-one
 */
import { ShopifyClient } from '../src/modules/shopify/client';
import { shopifyCredentialsFromEnv } from '../src/modules/shopify/token';
import { mapShopifyOrder } from '../src/modules/shopify/mapper';
import { ShopifyOrder } from '../src/modules/shopify/shopify.types';

async function main() {
  const creds = shopifyCredentialsFromEnv();
  console.log(`Shop: ${creds.shopDomain}`);

  const client = new ShopifyClient(creds);
  const url = `https://${creds.shopDomain}/admin/api/${process.env.SHOPIFY_API_VERSION || '2026-01'}/orders.json?status=any&limit=1`;
  const { body } = await client.get<{ orders?: ShopifyOrder[] }>(url);
  const order = body.orders?.[0];
  if (!order) {
    console.log('Token OK, but the store has no orders yet.');
    return;
  }

  console.log('\n=== Raw Shopify order ===');
  console.log(JSON.stringify(order, null, 2));

  const { rawPayload: _raw, ...row } = mapShopifyOrder(order);
  console.log('\n=== Mapped orders row (Shopify-owned fields) ===');
  console.log(row);
  console.log(`\nPayment: ${row.paymentMethod} → ${row.paymentMethod === 'COD' ? 'WOULD be imported' : 'would be skipped (Prepaid)'}`);
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
