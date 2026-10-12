import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { departments } from './departments';

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sections_department_id_slug_unique').on(table.departmentId, table.slug),
    index('sections_department_id_idx').on(table.departmentId),
    index('sections_slug_idx').on(table.slug),
    index('sections_status_idx').on(table.status),
  ]
);

export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
