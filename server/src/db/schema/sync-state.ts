import { pgTable, uuid, varchar, text, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { ventures } from './ventures';

export const syncState = pgTable(
  'sync_state',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(),
    /** Sync cursor. Only advanced after every page of a run succeeded. */
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastError: text('last_error'),
    ordersSynced: integer('orders_synced').notNull().default(0),
    /** Run lease: a sync may start only when this is null or in the past. */
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('sync_state_venture_provider_unique').on(table.ventureId, table.provider)]
);

export type SyncState = typeof syncState.$inferSelect;
export type NewSyncState = typeof syncState.$inferInsert;
