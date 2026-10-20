import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { ventures } from './ventures';
import { users } from './users';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ventureId: uuid('venture_id')
      .notNull()
      .references(() => ventures.id, { onDelete: 'cascade' }),

    // --- Shopify-owned: refreshed by every sync ---
    // Shopify order ids are ~2e13, well inside Number.MAX_SAFE_INTEGER (~9e15).
    shopifyOrderId: bigint('shopify_order_id', { mode: 'number' }).notNull(),
    shopifyUpdatedAt: timestamp('shopify_updated_at', { withTimezone: true }).notNull(),
    rawPayload: jsonb('raw_payload'),
    /** TSK-001 style, assigned by the sync from taskSeq. */
    taskId: varchar('task_id', { length: 30 }),
    taskSeq: integer('task_seq'),
    orderNumber: varchar('order_number', { length: 30 }).notNull(),
    orderDate: timestamp('order_date', { withTimezone: true }).notNull(),
    customerName: varchar('customer_name', { length: 200 }),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    pincode: varchar('pincode', { length: 20 }),
    products: text('products'),
    totalQty: integer('total_qty').notNull().default(0),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    paymentMethod: varchar('payment_method', { length: 20 }).notNull(),
    channel: varchar('channel', { length: 50 }),
    financialStatus: varchar('financial_status', { length: 30 }),
    fulfillmentStatus: varchar('fulfillment_status', { length: 30 }),

    stage: varchar('stage', { length: 30 }).notNull().default('new'),

    // --- Team-owned: a sync must never write these ---
    scanOutcome: varchar('scan_outcome', { length: 100 }),
    scanAt: timestamp('scan_at', { withTimezone: true }),
    finalResponse: varchar('final_response', { length: 50 }),
    collectedAmount: numeric('collected_amount', { precision: 12, scale: 2 }),
    balanceAmount: numeric('balance_amount', { precision: 12, scale: 2 }),
    addressConfirmed: boolean('address_confirmed'),
    newAddress: text('new_address'),
    screenshotUrl: text('screenshot_url'),
    crmRemarks: text('crm_remarks'),
    portalAction: varchar('portal_action', { length: 50 }),
    portalDone: boolean('portal_done').notNull().default(false),
    adminRemarks: text('admin_remarks'),
    /** Soft Refused: the customer is followed up after the order is cancelled. */
    followUpRequired: boolean('follow_up_required').notNull().default(false),
    followUpDone: boolean('follow_up_done').notNull().default(false),
    followUpNotes: text('follow_up_notes'),
    verificationAssignee: uuid('verification_assignee').references(() => users.id, { onDelete: 'set null' }),
    verificationPlannedAt: timestamp('verification_planned_at', { withTimezone: true }),
    verificationActualAt: timestamp('verification_actual_at', { withTimezone: true }),
    portalAssignee: uuid('portal_assignee').references(() => users.id, { onDelete: 'set null' }),
    portalPlannedAt: timestamp('portal_planned_at', { withTimezone: true }),
    portalActualAt: timestamp('portal_actual_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('orders_venture_shopify_order_unique').on(table.ventureId, table.shopifyOrderId),
    uniqueIndex('orders_venture_task_seq_unique').on(table.ventureId, table.taskSeq),
    index('orders_venture_stage_idx').on(table.ventureId, table.stage),
    index('orders_venture_order_date_idx').on(table.ventureId, table.orderDate),
    index('orders_verification_assignee_idx').on(table.verificationAssignee),
    index('orders_portal_assignee_idx').on(table.portalAssignee),
  ]
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
