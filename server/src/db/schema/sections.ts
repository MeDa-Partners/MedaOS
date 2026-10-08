import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';

export const systemSections = pgTable(
  'system_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    route: varchar('route', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('system_sections_slug_idx').on(table.slug),
    index('system_sections_status_idx').on(table.status),
  ]
);

export type SystemSection = typeof systemSections.$inferSelect;
export type NewSystemSection = typeof systemSections.$inferInsert;
