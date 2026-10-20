import { describe, it, expect } from 'vitest';
import { detectPayment, normalizeGateways } from '../src/modules/shopify/payment';
import { mapShopifyOrder, normalizePhone } from '../src/modules/shopify/mapper';
import { ShopifyClient, nextPageUrl, ShopifyApiError } from '../src/modules/shopify/client';
import { getAccessToken } from '../src/modules/shopify/token';
import { ShopifyOrder } from '../src/modules/shopify/shopify.types';
import { TEAM_OWNED_COLUMNS } from '../src/modules/orders/orders.types';
import { buildUpsert, formatTaskId, SHOPIFY_OWNED_KEYS } from '../src/modules/shopify/sync';
import { orders } from '../src/db/schema';

const pay = (financial_status: string, payment_gateway_names: string[]) =>
  detectPayment({ financial_status, payment_gateway_names });

describe('detectPayment (ported v3.2 ladder)', () => {
  it('does NOT treat Cashfree as COD — the bug that took two versions to find', () => {
    expect(pay('paid', ['Cashfree Payments'])).toBe('Prepaid');
    expect(pay('pending', ['Cashfree Payments'])).toBe('Prepaid');
    expect(normalizeGateways(['Cashfree Payments'])).toBe(' cashfree payments ');
  });

  it('1. gateway names COD as a whole word → COD, even when marked paid', () => {
    expect(pay('pending', ['Cash on Delivery (COD)'])).toBe('COD');
    expect(pay('pending', ['gokwik_cod'])).toBe('COD');
    expect(pay('pending', ['Pay on Delivery'])).toBe('COD');
    expect(pay('paid', ['cash_on_delivery'])).toBe('COD');
  });

  it('does not match "cod" inside another word', () => {
    expect(pay('pending', ['Codewave Pay'])).toBe('Prepaid');
  });

  it('2. partially_paid → COD', () => {
    expect(pay('partially_paid', ['Razorpay'])).toBe('COD');
  });

  it('3. paid / authorized / refunded → Prepaid', () => {
    for (const fin of ['paid', 'authorized', 'partially_refunded', 'refunded', 'PAID']) {
      expect(pay(fin, ['Razorpay'])).toBe('Prepaid');
    }
  });

  it('4. nothing captured and no online gateway → COD', () => {
    expect(pay('pending', [])).toBe('COD');
    expect(detectPayment({ financial_status: 'pending', payment_gateway_names: null })).toBe('COD');
    expect(pay('pending', ['manual'])).toBe('COD');
    expect(pay('pending', ['bogus'])).toBe('COD');
  });

  it('5. online gateway named but still pending → Prepaid', () => {
    expect(pay('pending', ['Razorpay'])).toBe('Prepaid');
    expect(pay('voided', ['PhonePe'])).toBe('Prepaid');
  });
});

const baseOrder: ShopifyOrder = {
  id: 6543210987654,
  name: '#1042',
  created_at: '2026-10-19T10:15:00+05:30',
  updated_at: '2026-10-19T10:20:00+05:30',
  total_price: '1299.00',
  financial_status: 'pending',
  fulfillment_status: null,
  payment_gateway_names: ['Cash on Delivery (COD)'],
  source_name: 'web',
  phone: null,
  customer: { first_name: 'Asha', last_name: 'Verma', phone: '+91 98765 43210' },
  shipping_address: {
    name: 'Asha Verma',
    phone: null,
    address1: '12 MG Road',
    address2: null,
    city: 'Hisar',
    province: 'Haryana',
    zip: '125001',
    country: 'India',
  },
  billing_address: null,
  line_items: [
    { title: 'Ashwagandha', quantity: 2 },
    { title: 'Triphala', quantity: 1 },
  ],
};

describe('normalizePhone', () => {
  it('strips non-digits, a leading 91 from 12 digits and a leading 0 from 11', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
    expect(normalizePhone('9876543210')).toBe('9876543210');
    expect(normalizePhone(null)).toBe('');
  });
});

describe('mapShopifyOrder', () => {
  it('maps a Shopify order to the Shopify-owned columns', () => {
    const row = mapShopifyOrder(baseOrder);
    expect(row).toMatchObject({
      shopifyOrderId: 6543210987654,
      orderNumber: '1042',
      customerName: 'Asha Verma',
      phone: '9876543210',
      products: 'Ashwagandha x2, Triphala x1',
      totalQty: 3,
      totalAmount: '1299',
      paymentMethod: 'COD',
      channel: 'web',
      address: '12 MG Road, Hisar, Haryana, 125001, India',
      city: 'Hisar',
      state: 'Haryana',
      pincode: '125001',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
    });
    expect(row.orderDate).toEqual(new Date('2026-10-19T04:45:00Z'));
    expect(row.shopifyUpdatedAt).toEqual(new Date('2026-10-19T04:50:00Z'));
  });

  it('falls back to the billing address and the customer name', () => {
    const row = mapShopifyOrder({
      ...baseOrder,
      shipping_address: null,
      billing_address: { address1: 'Plot 7', city: 'Delhi', zip: '110001' },
    });
    expect(row.customerName).toBe('Asha Verma');
    expect(row.address).toBe('Plot 7, Delhi, 110001, India');
  });

  it('never produces a team-owned field, stage or task id', () => {
    const keys = Object.keys(mapShopifyOrder(baseOrder));
    for (const col of [...TEAM_OWNED_COLUMNS, 'stage', 'taskId']) expect(keys).not.toContain(col);
  });
});

describe('nextPageUrl', () => {
  it('picks rel="next" even when rel="previous" comes first', () => {
    const link = '<https://s.myshopify.com/a?page_info=p>; rel="previous", <https://s.myshopify.com/a?page_info=n>; rel="next"';
    expect(nextPageUrl(link)).toBe('https://s.myshopify.com/a?page_info=n');
    expect(nextPageUrl('<https://s.myshopify.com/a?page_info=p>; rel="previous"')).toBeNull();
    expect(nextPageUrl(null)).toBeNull();
  });
});

/** A fake Shopify: the token endpoint plus a scripted queue of API responses. */
function fakeShopify(apiResponses: Array<{ status: number; body?: unknown; link?: string }>, expiresIn = 86399) {
  const calls: string[] = [];
  let tokens = 0;
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/admin/oauth/access_token')) {
      tokens++;
      return new Response(JSON.stringify({ access_token: `tok-${tokens}`, expires_in: expiresIn }), { status: 200 });
    }
    const next = apiResponses.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    return new Response(JSON.stringify(next.body ?? {}), {
      status: next.status,
      headers: next.link ? { link: next.link } : {},
    });
  }) as typeof fetch;
  return { fetchImpl, calls, tokenCount: () => tokens };
}

let shopSeq = 0;
const creds = () => ({ shopDomain: `test-${++shopSeq}.myshopify.com`, clientId: 'id', clientSecret: 'secret' });
const noSleep = async () => {};

describe('Shopify token cache', () => {
  it('reuses a cached token until 30 minutes before expiry', async () => {
    const c = creds();
    const fresh = fakeShopify([]);
    await getAccessToken(c, fresh.fetchImpl);
    await getAccessToken(c, fresh.fetchImpl);
    expect(fresh.tokenCount()).toBe(1);

    const c2 = creds();
    const expiring = fakeShopify([], 20 * 60); // 20 min: already inside the refresh window
    await getAccessToken(c2, expiring.fetchImpl);
    await getAccessToken(c2, expiring.fetchImpl);
    expect(expiring.tokenCount()).toBe(2);
  });
});

describe('ShopifyClient', () => {
  it('follows the Link header across pages', async () => {
    const c = creds();
    const shop = fakeShopify([
      { status: 200, body: { orders: [{ id: 1 }, { id: 2 }] }, link: `<https://${c.shopDomain}/next?page_info=abc&limit=250>; rel="next"` },
      { status: 200, body: { orders: [{ id: 3 }] } },
    ]);
    const client = new ShopifyClient(c, { fetchImpl: shop.fetchImpl, sleep: noSleep });
    const ids: number[] = [];
    for await (const page of client.orderPages({ updated_at_min: '2026-10-19T00:00:00Z' })) ids.push(...page.map((o) => o.id));
    expect(ids).toEqual([1, 2, 3]);
    expect(shop.calls.filter((u) => u.includes('orders.json'))[0]).toContain('status=any&limit=250&updated_at_min=');
    expect(shop.calls).toContain(`https://${c.shopDomain}/next?page_info=abc&limit=250`);
  });

  it('sleeps and retries on 429', async () => {
    const shop = fakeShopify([{ status: 429 }, { status: 200, body: { orders: [] } }]);
    const slept: number[] = [];
    const client = new ShopifyClient(creds(), { fetchImpl: shop.fetchImpl, sleep: async (ms) => void slept.push(ms) });
    await client.get('https://x/orders.json');
    expect(slept).toEqual([2000]);
  });

  it('on 401 drops the token and retries exactly once', async () => {
    const ok = fakeShopify([{ status: 401 }, { status: 200, body: {} }]);
    await new ShopifyClient(creds(), { fetchImpl: ok.fetchImpl, sleep: noSleep }).get('https://x/orders.json');
    expect(ok.tokenCount()).toBe(2);

    const bad = fakeShopify([{ status: 401 }, { status: 401 }]);
    await expect(
      new ShopifyClient(creds(), { fetchImpl: bad.fetchImpl, sleep: noSleep }).get('https://x/orders.json')
    ).rejects.toBeInstanceOf(ShopifyApiError);
  });

  it('throws on other errors instead of returning partial data', async () => {
    const shop = fakeShopify([{ status: 500, body: { errors: 'boom' } }]);
    await expect(
      new ShopifyClient(creds(), { fetchImpl: shop.fetchImpl, sleep: noSleep }).get('https://x/orders.json')
    ).rejects.toThrow('Shopify API error 500');
  });
});

describe('sync upsert never overwrites team fields (spec §4.4)', () => {
  const teamColumnNames = TEAM_OWNED_COLUMNS.map((k) => orders[k].name);

  it('refreshes exactly the mapper fields on conflict', () => {
    const mapped = Object.keys(mapShopifyOrder(baseOrder)).filter((k) => k !== 'shopifyOrderId').sort();
    expect([...SHOPIFY_OWNED_KEYS].sort()).toEqual(mapped);
  });

  it('the generated DO UPDATE SET clause names no team-owned column, stage or task id', () => {
    const { sql: text } = buildUpsert('00000000-0000-0000-0000-000000000001', [mapShopifyOrder(baseOrder)]).toSQL();
    const updateClause = text.slice(text.indexOf('do update set'));
    expect(updateClause.length).toBeGreaterThan(0);
    for (const col of [...teamColumnNames, 'stage', 'task_id']) expect(updateClause).not.toContain(`"${col}"`);
    expect(text).toContain('on conflict ("venture_id","shopify_order_id") do update set');
  });

  it('only applies a payload newer than the stored one', () => {
    const { sql: text } = buildUpsert('00000000-0000-0000-0000-000000000001', [mapShopifyOrder(baseOrder)]).toSQL();
    expect(text).toContain('where "orders"."shopify_updated_at" < excluded."shopify_updated_at"');
  });
});

describe('formatTaskId', () => {
  it('pads to three digits and never truncates past 999', () => {
    expect(formatTaskId(1)).toBe('TSK-001');
    expect(formatTaskId(42)).toBe('TSK-042');
    expect(formatTaskId(999)).toBe('TSK-999');
    expect(formatTaskId(1000)).toBe('TSK-1000');
    expect(formatTaskId(12345)).toBe('TSK-12345');
  });
});
