import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { ventures } from './ventures';
import { systemSections } from './sections';

export const userSections = pgTable(
  'user_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => systemSections.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_sections_user_venture_section_unique').on(
      table.userId,
      table.ventureId,
      table.sectionId
    ),
    index('user_sections_user_venture_idx').on(table.userId, table.ventureId),
    index('user_sections_section_id_idx').on(table.sectionId),
  ]
);

export type UserSection = typeof userSections.$inferSelect;
export type NewUserSection = typeof userSections.$inferInsert;
