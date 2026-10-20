import { pgTable, uuid, varchar, time, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { ventures } from './ventures';
import { users } from './users';

/**
 * Who owns orders arriving in each time window, per step ('verification' | 'portal').
 * A step's shifts tile all 24 hours; start > end means the shift crosses midnight.
 */
export const assignmentShifts = pgTable(
  'assignment_shifts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    step: varchar('step', { length: 30 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    /** 'HH:MM:SS', Asia/Kolkata. */
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('assignment_shifts_venture_step_idx').on(table.ventureId, table.step)]
);

export type AssignmentShift = typeof assignmentShifts.$inferSelect;
export type NewAssignmentShift = typeof assignmentShifts.$inferInsert;
