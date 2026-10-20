'use client';

import type { SectionModuleProps } from '../registry';
import { OrderWorkspace } from '../order-kit/order-workspace';

/** Portal Actions: the portal person's queue, soonest deadline first. Portal fields editable by the owner. */
export default function PortalActionsSection({ venture }: SectionModuleProps) {
  return <OrderWorkspace ventureId={venture.id} config={{ scope: 'portal', defaultView: 'my_pending' }} />;
}
