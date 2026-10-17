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
  max: 15, // Keep sufficient connections for concurrent browser requests over pooler
  idle_timeout: 60, // Keep pooled connections alive up to 60s to prevent constant reconnections
  connect_timeout: 30, // 30s timeout to accommodate transient remote network latency
  max_lifetime: 60 * 30, // 30 minutes max connection lifetime
  connection: {
    statement_timeout: 15000, // 15s statement timeout in Postgres
    idle_in_transaction_session_timeout: 10000, // 10s auto-abort if a client connection stays idle with an open transaction
  },
  onnotice: () => {}, // Suppress notice spam
});

export const db = drizzle(sqlClient, { schema });
export { schema };
