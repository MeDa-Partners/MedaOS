'use client';

import type { SectionModuleProps } from '../registry';
import { OrderWorkspace } from '../order-kit/order-workspace';

/** Orders: every order with its timeline, current step, owner and delay. Read-only, plus the Soft Refused follow-up. */
export default function OrdersSection({ venture }: SectionModuleProps) {
  return <OrderWorkspace ventureId={venture.id} config={{ scope: 'orders', defaultView: 'all' }} />;
}
