import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { ventures } from './ventures';
import { departments } from './departments';
import { teams } from './teams';

export const userMemberships = pgTable(
  'user_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    // Optional: an employee can belong to a department before being placed in a team.
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_memberships_user_venture_unique').on(table.userId, table.ventureId),
    index('user_memberships_user_id_idx').on(table.userId),
    index('user_memberships_venture_id_idx').on(table.ventureId),
    index('user_memberships_dept_id_idx').on(table.departmentId),
    index('user_memberships_team_id_idx').on(table.teamId),
  ]
);

export type UserMembership = typeof userMemberships.$inferSelect;
export type NewUserMembership = typeof userMemberships.$inferInsert;
