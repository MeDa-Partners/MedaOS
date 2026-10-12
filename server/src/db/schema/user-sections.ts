import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { sections } from './sections';

export const userSections = pgTable(
  'user_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_sections_user_section_unique').on(table.userId, table.sectionId),
    index('user_sections_user_id_idx').on(table.userId),
    index('user_sections_section_id_idx').on(table.sectionId),
  ]
);

export type UserSection = typeof userSections.$inferSelect;
export type NewUserSection = typeof userSections.$inferInsert;
