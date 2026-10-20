import type { OrderStage, OrderView } from '@/lib/api';

export const STAGE_LABEL: Record<OrderStage, string> = {
  new: 'New',
  verification_pending: 'Verification',
  portal_pending: 'Portal',
  done: 'Done',
  closed: 'Closed',
};

export const STAGE_VARIANT: Record<OrderStage, 'secondary' | 'venture' | 'warning' | 'success' | 'outline'> = {
  new: 'secondary',
  verification_pending: 'venture',
  portal_pending: 'warning',
  done: 'success',
  closed: 'outline',
};

export const VIEW_LABEL: Record<OrderView, string> = {
  all: 'All',
  my_pending: 'My Pending',
  delayed: 'Delayed',
  converted: 'Converted',
  cancelled: 'Cancelled',
  follow_up: 'Follow-up',
  completed: 'Completed',
};

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const formatAmount = (n: number | null | undefined) => (n === null || n === undefined ? '—' : inr.format(n));

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');

/** 95 → "1h 35m", 3000 → "2d 2h". */
export function formatDelay(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}


/** Indian mobile numbers are stored as 10 digits; tel: and WhatsApp need the country code. */
export const phoneHref = (phone: string) => `tel:+91${phone}`;
export const whatsappHref = (phone: string) => `https://wa.me/91${phone}`;

const EVENT_LABEL: Record<string, string> = {
  'intake/received': 'Order received from Shopify',
  'verification/assigned': 'Assigned for verification',
  'verification/unassigned': 'No verification owner',
  'portal/assigned': 'Assigned for portal',
  'portal/unassigned': 'No portal owner',
  'verification/scanned': 'Scan outcome recorded',
  'verification/completed': 'Verification completed',
  'verification/reassigned': 'Verification reassigned',
  'portal/completed': 'Done in portal',
  'portal/reassigned': 'Portal step reassigned',
  'follow_up/done': 'Follow-up done',
  'follow_up/reopened': 'Follow-up reopened',
};
export const timelineLabel = (step: string, event: string) => EVENT_LABEL[`${step}/${event}`] ?? `${step} · ${event}`;

/** Delay colours, matching the sheet: amber = open and overdue, red = finished late. */
export const DELAY_CLASS = { overdue: 'text-amber-700', late: 'text-red-600' } as const;

// Dropdown values, worded exactly as in the live sheet (the server validates against the same lists).
export const SCAN_GOOD_TO_GO = 'Shiprocket Scanned - Good to go';
export const SCAN_OUTCOMES = [
  SCAN_GOOD_TO_GO,
  'Duplicate Order - Proceed to cancel',
  'Non Servicable Pincode - Proceed to cancel',
  'Past RTO Customer - Proceed to cancel',
] as const;
export const FINAL_RESPONSES = [
  'Prepaid Converted',
  'Semi-Prepaid',
  'Proceed COD',
  'Soft Refused',
  'Hard Refused',
  'Customer Unreachable',
] as const;
export const PORTAL_ACTIONS = ['Order Cancelled in Portal', 'Order Proceed In Portal'] as const;

export const STEP_LABEL = { verification: 'Verification', portal: 'Portal' } as const;
