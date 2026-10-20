import { ShopifyOrder } from './shopify.types';

/**
 * COD / Prepaid detection, ported verbatim from detectPayment_() (v3.2) in
 * docs/reference/wayveda-sheet-sync.js. Do not "simplify" it: the order of the checks is the fix.
 */

// Whole-word match. A substring test on "cash" mislabels every
// "Cashfree Payments" order as COD — this bug cost two versions to find.
const COD_TOKEN_RE = / (cod|cash on delivery|cashondelivery|pay on delivery|payondelivery) /;

/** ["Cash on Delivery (COD)", "gokwik_cod"] → " cash on delivery cod gokwik cod " */
export function normalizeGateways(names: string[] | null | undefined): string {
  const s = (names || []).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return s ? ` ${s} ` : '';
}

export function detectPayment(
  order: Pick<ShopifyOrder, 'financial_status' | 'payment_gateway_names'>
): 'COD' | 'Prepaid' {
  const fin = String(order.financial_status || '').toLowerCase();
  const gw = normalizeGateways(order.payment_gateway_names);

  if (COD_TOKEN_RE.test(gw)) return 'COD'; // 1. gateway says COD
  if (fin === 'partially_paid') return 'COD'; // 2. partial COD
  if (['paid', 'authorized', 'partially_refunded', 'refunded'].includes(fin)) return 'Prepaid'; // 3. captured online
  if (gw === '' || / (manual|bogus) /.test(gw)) return 'COD'; // 4. no online gateway
  return 'Prepaid'; // 5. online gateway, payment pending
}
