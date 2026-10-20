import { FinalResponse, PortalAction, ScanOutcome, SCAN_GOOD_TO_GO } from './orders.types';

/**
 * Where an order goes once verification is decided. Ported from the sheet's getRoute / autoCancel
 * (spec v2 §7, routing rules):
 *
 *   scan ≠ "Good to go"                  → closed          Order Cancelled in Portal
 *   Prepaid Converted / Semi-Prepaid     → portal_pending  Order Cancelled in Portal
 *   Proceed COD                          → portal_pending  Order Proceed In Portal
 *   Soft Refused                         → portal_pending  Order Cancelled in Portal, follow-up
 *   Hard Refused                         → closed          Order Cancelled in Portal
 *   Customer Unreachable                 → closed          (blank)
 */
export interface VerificationRoute {
  stage: 'portal_pending' | 'closed';
  portalAction: PortalAction | null;
  followUpRequired: boolean;
}

const CANCEL: PortalAction = 'Order Cancelled in Portal';
const PROCEED: PortalAction = 'Order Proceed In Portal';

/** Null while verification is still undecided (no scan yet, or a good scan without a response). */
export function routeAfterVerification(
  scanOutcome: ScanOutcome | null,
  finalResponse: FinalResponse | null
): VerificationRoute | null {
  if (!scanOutcome) return null;
  if (scanOutcome !== SCAN_GOOD_TO_GO) return { stage: 'closed', portalAction: CANCEL, followUpRequired: false };
  switch (finalResponse) {
    case 'Prepaid Converted':
    case 'Semi-Prepaid':
      return { stage: 'portal_pending', portalAction: CANCEL, followUpRequired: false };
    case 'Proceed COD':
      return { stage: 'portal_pending', portalAction: PROCEED, followUpRequired: false };
    case 'Soft Refused':
      return { stage: 'portal_pending', portalAction: CANCEL, followUpRequired: true };
    case 'Hard Refused':
      return { stage: 'closed', portalAction: CANCEL, followUpRequired: false };
    case 'Customer Unreachable':
      return { stage: 'closed', portalAction: null, followUpRequired: false };
    default:
      return null;
  }
}

/** Stage after the portal step is marked done: follow-up orders end closed (the Follow-up view). */
export function stageAfterPortal(followUpRequired: boolean): 'done' | 'closed' {
  return followUpRequired ? 'closed' : 'done';
}
