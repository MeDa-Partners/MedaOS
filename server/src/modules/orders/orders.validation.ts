import { z } from 'zod';
import { FINAL_RESPONSES, ORDER_STEPS, PORTAL_ACTIONS, SCAN_OUTCOMES } from './orders.types';

/**
 * Which screen is asking. Each scope is guarded by its own section (see orders.routes.ts), so a
 * caller holding only `verification` can list and open the orders in their queue.
 */
export const ORDER_SCOPES = ['orders', 'verification', 'portal'] as const;
export type OrderScope = (typeof ORDER_SCOPES)[number];

export const SCOPE_SECTION: Record<OrderScope, string> = {
  orders: 'orders',
  verification: 'verification',
  portal: 'portal-actions',
};

export const ORDER_VIEWS = ['all', 'my_pending', 'delayed', 'converted', 'cancelled', 'follow_up', 'completed'] as const;
export type OrderView = (typeof ORDER_VIEWS)[number];

export const scopeQuerySchema = z.object({ scope: z.enum(ORDER_SCOPES).default('orders') });

export const listOrdersQuerySchema = z.object({
  scope: z.enum(ORDER_SCOPES).default('orders'),
  view: z.enum(ORDER_VIEWS).default('all'),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

const amount = z.number().min(0).max(10_000_000).nullable().optional();
const text = (max: number) => z.string().trim().max(max).nullable().optional();

/** Scan + call fields. Omitted = unchanged. */
export const verificationUpdateSchema = z
  .object({
    scanOutcome: z.enum(SCAN_OUTCOMES).optional(),
    finalResponse: z.enum(FINAL_RESPONSES).optional(),
    collectedAmount: amount,
    balanceAmount: amount,
    addressConfirmed: z.boolean().nullable().optional(),
    newAddress: text(1000),
    crmRemarks: text(2000),
  })
  .strict();
export type VerificationUpdate = z.infer<typeof verificationUpdateSchema>;

export const portalUpdateSchema = z
  .object({
    portalAction: z.enum(PORTAL_ACTIONS).optional(),
    portalDone: z.boolean().optional(),
    adminRemarks: text(2000),
  })
  .strict();
export type PortalUpdate = z.infer<typeof portalUpdateSchema>;

export const followUpUpdateSchema = z
  .object({
    followUpDone: z.boolean().optional(),
    followUpNotes: text(2000),
  })
  .strict();
export type FollowUpUpdate = z.infer<typeof followUpUpdateSchema>;

export const reassignSchema = z
  .object({
    step: z.enum(ORDER_STEPS),
    /** null = unassign. */
    userId: z.string().uuid().nullable(),
  })
  .strict();
export type ReassignInput = z.infer<typeof reassignSchema>;

export const bulkReassignSchema = z
  .object({
    step: z.enum(ORDER_STEPS),
    /** Whose pending orders to move; null = the step's unassigned orders. */
    fromUserId: z.string().uuid().nullable(),
    toUserId: z.string().uuid(),
  })
  .strict();
export type BulkReassignInput = z.infer<typeof bulkReassignSchema>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');

export const saveShiftsSchema = z
  .object({
    step: z.enum(ORDER_STEPS),
    shifts: z
      .array(
        z
          .object({
            name: z.string().trim().min(1, 'Every shift needs a name').max(100),
            startTime: hhmm,
            endTime: hhmm,
            assigneeUserId: z.string().uuid().nullable(),
          })
          .strict()
      )
      .max(5, 'A step can have at most 5 shifts'),
  })
  .strict();
export type SaveShiftsInput = z.infer<typeof saveShiftsSchema>;
