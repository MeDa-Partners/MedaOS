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
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:');
  console.error(parsedEnv.error.flatten().fieldErrors);
  throw new Error('Environment configuration error. Check your .env file.');
}

export const env = parsedEnv.data;
