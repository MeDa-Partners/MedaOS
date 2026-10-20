'use client';

import type { SectionModuleProps } from '../registry';
import { OrderWorkspace } from '../order-kit/order-workspace';

/** Verification & Calls: the caller's queue, soonest deadline first. Scan + call fields editable by the owner. */
export default function VerificationSection({ venture }: SectionModuleProps) {
  return <OrderWorkspace ventureId={venture.id} config={{ scope: 'verification', defaultView: 'my_pending' }} />;
}
