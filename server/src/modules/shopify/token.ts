import { env } from '../../config/env';
import { ShopifyCredentials } from './shopify.types';

/**
 * Admin API access tokens via the client credentials grant. Ported from getAccessToken_() in
 * docs/reference/wayveda-sheet-sync.js: tokens live ~24h, are cached with their expiry and
 * refreshed 30 minutes early. Shopify retired static shpat_ tokens for admin-created apps on
 * 1 Jan 2026, so this is the only way in.
 */

const REFRESH_EARLY_MS = 30 * 60 * 1000;
const DEFAULT_EXPIRES_IN_S = 86000;

type FetchFn = typeof fetch;

const cache = new Map<string, { token: string; expiresAt: number }>();

export class ShopifyTokenError extends Error {}

export function shopifyCredentialsFromEnv(): ShopifyCredentials {
  const { SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = env;
  if (!SHOPIFY_SHOP_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new ShopifyTokenError(
      'Shopify is not configured. Set SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in server/.env.'
    );
  }
  return { shopDomain: SHOPIFY_SHOP_DOMAIN, clientId: SHOPIFY_CLIENT_ID, clientSecret: SHOPIFY_CLIENT_SECRET };
}

export async function getAccessToken(creds: ShopifyCredentials, fetchImpl: FetchFn = fetch): Promise<string> {
  const hit = cache.get(creds.shopDomain);
  if (hit && Date.now() < hit.expiresAt - REFRESH_EARLY_MS) return hit.token;

  const res = await fetchImpl(`https://${creds.shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }).toString(),
  });
  if (res.status !== 200) {
    throw new ShopifyTokenError(`Token generation failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cache.set(creds.shopDomain, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || DEFAULT_EXPIRES_IN_S) * 1000,
  });
  return data.access_token;
}

/** Called on a 401: forget the token so the next getAccessToken() fetches a fresh one. */
export function invalidateAccessToken(shopDomain: string): void {
  cache.delete(shopDomain);
}
