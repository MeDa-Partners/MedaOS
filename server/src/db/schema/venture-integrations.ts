import { pgTable, uuid, varchar, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { ventures } from './ventures';

export const ventureIntegrations = pgTable(
  'venture_integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull(),
    shopDomain: varchar('shop_domain', { length: 255 }).notNull(),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    /** Encrypted at rest. Never return it from the API. */
    clientSecret: text('client_secret').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('venture_integrations_venture_provider_unique').on(table.ventureId, table.provider)]
);

export type VentureIntegration = typeof ventureIntegrations.$inferSelect;
export type NewVentureIntegration = typeof ventureIntegrations.$inferInsert;
