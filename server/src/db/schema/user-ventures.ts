import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { ventures } from './ventures';
import { teams } from './teams';

export const userVentures = pgTable(
  'user_ventures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_ventures_user_id_venture_id_unique').on(table.userId, table.ventureId),
    index('user_ventures_user_id_idx').on(table.userId),
    index('user_ventures_venture_id_idx').on(table.ventureId),
    index('user_ventures_team_id_idx').on(table.teamId),
  ]
);

export type UserVenture = typeof userVentures.$inferSelect;
export type NewUserVenture = typeof userVentures.$inferInsert;
