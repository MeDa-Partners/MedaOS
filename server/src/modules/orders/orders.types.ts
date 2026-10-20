/**
 * Shared values for the COD verification flow. Stored as plain varchar in the DB, so a value
 * change here needs no DDL.
 */

export const ORDER_STAGES = ['new', 'verification_pending', 'portal_pending', 'done', 'closed'] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

/** Steps 1 (scan) and 2 (call) are done by one person, so they share the `verification` step. */
export const ORDER_STEPS = ['verification', 'portal'] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

export const PAYMENT_METHODS = ['COD', 'Prepaid'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Step 1 scan outcomes, worded exactly as in the live sheet (including its spelling). */
export const SCAN_GOOD_TO_GO = 'Shiprocket Scanned - Good to go';
export const SCAN_OUTCOMES = [
  SCAN_GOOD_TO_GO,
  'Duplicate Order - Proceed to cancel',
  'Non Servicable Pincode - Proceed to cancel',
  'Past RTO Customer - Proceed to cancel',
] as const;
export type ScanOutcome = (typeof SCAN_OUTCOMES)[number];

export const FINAL_RESPONSES = [
  'Prepaid Converted',
  'Semi-Prepaid',
  'Proceed COD',
  'Soft Refused',
  'Hard Refused',
  'Customer Unreachable',
] as const;
export type FinalResponse = (typeof FINAL_RESPONSES)[number];

export const PORTAL_ACTIONS = ['Order Cancelled in Portal', 'Order Proceed In Portal'] as const;
export type PortalAction = (typeof PORTAL_ACTIONS)[number];

/** Columns the team owns. The Shopify sync must never write any of these. */
export const TEAM_OWNED_COLUMNS = [
  'scanOutcome',
  'scanAt',
  'finalResponse',
  'collectedAmount',
  'balanceAmount',
  'addressConfirmed',
  'newAddress',
  'screenshotUrl',
  'crmRemarks',
  'portalAction',
  'portalDone',
  'adminRemarks',
  'followUpRequired',
  'followUpDone',
  'followUpNotes',
  'verificationAssignee',
  'verificationPlannedAt',
  'verificationActualAt',
  'portalAssignee',
  'portalPlannedAt',
  'portalActualAt',
] as const;

// ───────────── API response shapes ─────────────

/** overdue = open and past its deadline (amber); late = completed after its deadline (red). */
export type DelayStatus = 'overdue' | 'late' | null;

export interface OrderListItem {
  id: string;
  taskId: string | null;
  orderNumber: string;
  orderDate: string;
  customerName: string | null;
  phone: string | null;
  products: string | null;
  totalAmount: number;
  stage: string;
  /** Whoever owns the step the order is waiting on. */
  assigneeName: string | null;
  /** Minutes late (open: now − planned; finished: worst completed step); null when on time. */
  delayMinutes: number | null;
  /** Planned time of the step the order is waiting on. */
  plannedAt: string | null;
  delayStatus: DelayStatus;
  followUpRequired: boolean;
  followUpDone: boolean;
}

export interface OrderListResult {
  orders: OrderListItem[];
  /** The tabs this screen shows, in order. */
  views: string[];
  /** Count per tab (honours the search box, not the active tab). */
  counts: Record<string, number>;
}

export interface OrderTimelineEntry {
  id: string;
  step: string;
  event: string;
  at: string;
  note: string | null;
  byUserName: string | null;
}

export interface OrderDetail {
  id: string;
  taskId: string | null;
  shopifyOrderId: string;
  orderNumber: string;
  orderDate: string;
  customerName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  products: string | null;
  totalQty: number;
  totalAmount: number;
  paymentMethod: string;
  channel: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledInShopify: boolean;
  stage: string;
  scanOutcome: string | null;
  scanAt: string | null;
  finalResponse: string | null;
  collectedAmount: number | null;
  balanceAmount: number | null;
  addressConfirmed: boolean | null;
  newAddress: string | null;
  screenshotUrl: string | null;
  crmRemarks: string | null;
  portalAction: string | null;
  portalDone: boolean;
  adminRemarks: string | null;
  followUpRequired: boolean;
  followUpDone: boolean;
  followUpNotes: string | null;
  verificationAssignee: { id: string; name: string } | null;
  verificationPlannedAt: string | null;
  verificationActualAt: string | null;
  portalAssignee: { id: string; name: string } | null;
  portalPlannedAt: string | null;
  portalActualAt: string | null;
  delayMinutes: number | null;
  delayStatus: DelayStatus;
  createdAt: string;
  updatedAt: string;
  timeline: OrderTimelineEntry[];
  capabilities: OrderCapabilities;
}

/** What the current user may do with one order. The client renders forms from these only. */
export interface OrderCapabilities {
  canEditVerification: boolean;
  canEditPortal: boolean;
  canEditFollowUp: boolean;
  /** The step that may be reassigned (the one the order is waiting on), or null. */
  reassignStep: OrderStep | null;
}
