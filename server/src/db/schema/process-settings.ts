import { pgTable, uuid, time, integer, timestamp } from 'drizzle-orm/pg-core';
import { ventures } from './ventures';

/** Office hours and deadlines, one row per venture. Times are 'HH:MM:SS', Asia/Kolkata. */
export const processSettings = pgTable('process_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ventureId: uuid('venture_id')
    .notNull()
    .unique()
    .references(() => ventures.id, { onDelete: 'cascade' }),
  officeStart: time('office_start').notNull().default('09:00'),
  officeEnd: time('office_end').notNull().default('18:00'),
  overnightDeadline: time('overnight_deadline').notNull().default('11:00'),
  verificationTatMinutes: integer('verification_tat_minutes').notNull().default(5),
  portalTatMinutes: integer('portal_tat_minutes').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ProcessSetting = typeof processSettings.$inferSelect;
export type NewProcessSetting = typeof processSettings.$inferInsert;
