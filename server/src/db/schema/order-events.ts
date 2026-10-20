import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { ventures } from './ventures';
import { orders } from './orders';
import { users } from './users';

/** The timeline: one row per thing that happened to an order. */
export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    step: varchar('step', { length: 30 }).notNull(),
    event: varchar('event', { length: 50 }).notNull(),
    byUser: uuid('by_user').references(() => users.id, { onDelete: 'set null' }),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
    note: text('note'),
  },
  (table) => [
    index('order_events_order_id_idx').on(table.orderId),
    index('order_events_venture_id_idx').on(table.ventureId),
  ]
);

export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;
