import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { env } from '../config/env';

// Determine if SSL should be used (default to require for remote Supabase connections)
const isRemoteDb =
  env.DATABASE_URL.includes('supabase.co') ||
  env.DATABASE_URL.includes('supabase.com') ||
  env.DATABASE_URL.includes('pooler.supabase.com') ||
  env.NODE_ENV === 'production';

export const sqlClient = postgres(env.DATABASE_URL, {
  prepare: false, // Essential for Supabase PgBouncer transaction mode
  ssl: isRemoteDb ? 'require' : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db = drizzle(sqlClient, { schema });
export { schema };
