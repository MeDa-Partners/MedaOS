import { describe, it, expect } from 'vitest';
import { routeAfterVerification, stageAfterPortal } from '../src/modules/orders/routing';
import { SCAN_GOOD_TO_GO } from '../src/modules/orders/orders.types';

describe('routeAfterVerification (sheet getRoute / autoCancel)', () => {
  it('waits while undecided', () => {
    expect(routeAfterVerification(null, null)).toBeNull();
    expect(routeAfterVerification(SCAN_GOOD_TO_GO, null)).toBeNull();
  });

  it.each(['Duplicate Order - Proceed to cancel', 'Non Servicable Pincode - Proceed to cancel', 'Past RTO Customer - Proceed to cancel'] as const)(
    'scan "%s" closes the order and cancels it in the portal',
    (scan) => {
      expect(routeAfterVerification(scan, null)).toEqual({ stage: 'closed', portalAction: 'Order Cancelled in Portal', followUpRequired: false });
    }
  );

  it.each([
    ['Prepaid Converted', 'portal_pending', 'Order Cancelled in Portal', false],
    ['Semi-Prepaid', 'portal_pending', 'Order Cancelled in Portal', false],
    ['Proceed COD', 'portal_pending', 'Order Proceed In Portal', false],
    ['Soft Refused', 'portal_pending', 'Order Cancelled in Portal', true],
    ['Hard Refused', 'closed', 'Order Cancelled in Portal', false],
    ['Customer Unreachable', 'closed', null, false],
  ] as const)('good scan + "%s" → %s, %s, follow-up %s', (response, stage, portalAction, followUpRequired) => {
    expect(routeAfterVerification(SCAN_GOOD_TO_GO, response)).toEqual({ stage, portalAction, followUpRequired });
  });
});

describe('stageAfterPortal', () => {
  it('ends follow-up orders closed (the Follow-up view) and others done', () => {
    expect(stageAfterPortal(true)).toBe('closed');
    expect(stageAfterPortal(false)).toBe('done');
  });
});
