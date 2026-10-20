import { env } from '../../config/env';
import { getAccessToken, invalidateAccessToken } from './token';
import { ShopifyCredentials, ShopifyOrder } from './shopify.types';

/**
 * Shopify Admin REST client. Ported from the sync loop in docs/reference/wayveda-sheet-sync.js:
 * Link-header cursor paging, 429 → sleep 2s and retry, 401 → drop the token and retry once.
 */

type FetchFn = typeof fetch;

const RATE_LIMIT_SLEEP_MS = 2000;
const PAGE_SLEEP_MS = 600;
/** The script retries 429s forever; cap it so a stuck run fails loudly instead of hanging. */
const MAX_RATE_LIMIT_RETRIES = 10;

export class ShopifyApiError extends Error {
  constructor(
    public readonly status: number,
    body: string
  ) {
    super(`Shopify API error ${status}: ${body.slice(0, 500)}`);
  }
}

export interface ShopifyClientOptions {
  apiVersion?: string;
  fetchImpl?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

/** `<url>; rel="next"` from a Link header, or null on the last page. */
export function nextPageUrl(linkHeader: string | null): string | null {
  const m = String(linkHeader || '').match(/<([^>]+)>;\s*rel="next"/);
  return m ? m[1] : null;
}

export class ShopifyClient {
  private readonly apiVersion: string;
  private readonly fetchImpl: FetchFn;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly creds: ShopifyCredentials,
    opts: ShopifyClientOptions = {}
  ) {
    this.apiVersion = opts.apiVersion ?? env.SHOPIFY_API_VERSION;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private url(path: string, params: Record<string, string | number> = {}): string {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return `https://${this.creds.shopDomain}/admin/api/${this.apiVersion}/${path}${qs ? `?${qs}` : ''}`;
  }

  /** One GET with the retry rules. Returns the parsed body and the next-page URL. */
  async get<T>(url: string): Promise<{ body: T; nextUrl: string | null }> {
    let retried401 = false;
    let rateLimited = 0;
    for (;;) {
      const token = await getAccessToken(this.creds, this.fetchImpl);
      const res = await this.fetchImpl(url, { headers: { 'X-Shopify-Access-Token': token } });

      if (res.status === 429 && rateLimited < MAX_RATE_LIMIT_RETRIES) {
        rateLimited++;
        await this.sleep(RATE_LIMIT_SLEEP_MS);
        continue;
      }
      if (res.status === 401 && !retried401) {
        retried401 = true;
        invalidateAccessToken(this.creds.shopDomain);
        continue;
      }
      if (res.status !== 200) throw new ShopifyApiError(res.status, await res.text());

      return { body: (await res.json()) as T, nextUrl: nextPageUrl(res.headers.get('link')) };
    }
  }

  /**
   * Every order matching `params`, one page (≤250) at a time. Follow-up pages use the Link URL
   * as given: it carries only page_info + limit, which is what Shopify requires.
   */
  async *orderPages(params: Record<string, string | number>): AsyncGenerator<ShopifyOrder[]> {
    let url: string | null = this.url('orders.json', { status: 'any', limit: 250, ...params });
    while (url) {
      const { body, nextUrl }: { body: { orders?: ShopifyOrder[] }; nextUrl: string | null } =
        await this.get<{ orders?: ShopifyOrder[] }>(url);
      yield body.orders ?? [];
      url = nextUrl;
      if (url) await this.sleep(PAGE_SLEEP_MS);
    }
  }
}
