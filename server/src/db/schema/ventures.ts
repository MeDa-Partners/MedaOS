import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const ventures = pgTable(
  'ventures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ventures_slug_idx').on(table.slug),
    index('ventures_status_idx').on(table.status),
  ]
);

export type Venture = typeof ventures.$inferSelect;
export type NewVenture = typeof ventures.$inferInsert;
