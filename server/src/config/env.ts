import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000'),
  SESSION_COOKIE_NAME: z
    .string()
    .default('meda_session'),
  SESSION_TTL_HOURS: z
    .string()
    .default('168')
    .transform((val) => parseInt(val, 10)),
  ADMIN_INITIAL_EMAIL: z
    .string()
    .email()
    .default('admin@meda.com'),
  ADMIN_INITIAL_PASSWORD: z
    .string()
    .min(8)
    .default('Admin@MeDa2026!'),
  ADMIN_INITIAL_NAME: z
    .string()
    .default('System Administrator'),
  DEV_ADMIN_USERNAME: z
    .string()
    .default('devadmin'),
  DEV_ADMIN_PASSWORD: z
    .string()
    .min(8)
    .default('DevAdmin@MeDa2026!'),
  DEV_ADMIN_PASSWORD_HASH: z
    .string()
    .optional(),
  DEV_SESSION_COOKIE_NAME: z
    .string()
    .default('meda_dev_session'),
  DEV_SESSION_SECRET: z
    .string()
    .min(16)
    .default('meda-dev-super-secret-key-2026-secure'),
  DEV_SESSION_TTL_HOURS: z
    .string()
    .default('24')
    .transform((val) => parseInt(val, 10)),
  // Shopify (WayVeda order sync). Optional so the API still boots without them; the sync
  // refuses to run until all three are set.
  SHOPIFY_SHOP_DOMAIN: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().default('2026-01'),
  /** The venture that receives the orders (single-venture setup until venture_integrations is used). */
  SHOPIFY_VENTURE_SLUG: z.string().default('wayveda'),
  /** Turns on the 5-minute sync inside this server process. Off unless set to "true". */
  SHOPIFY_SYNC_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  /** First run only (no cursor yet): import orders created on or after this. Default: last 24 hours. */
  SHOPIFY_BACKFILL_FROM: z.string().datetime({ offset: true }).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:');
  console.error(parsedEnv.error.flatten().fieldErrors);
  throw new Error('Environment configuration error. Check your .env file.');
}

export const env = parsedEnv.data;
