import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { ventures } from './ventures';
import { systemSections } from './sections';

export const ventureSections = pgTable(
  'venture_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => systemSections.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('venture_sections_venture_id_section_id_unique').on(
      table.ventureId,
      table.sectionId
    ),
    index('venture_sections_venture_id_idx').on(table.ventureId),
    index('venture_sections_section_id_idx').on(table.sectionId),
  ]
);

export type VentureSection = typeof ventureSections.$inferSelect;
export type NewVentureSection = typeof ventureSections.$inferInsert;
