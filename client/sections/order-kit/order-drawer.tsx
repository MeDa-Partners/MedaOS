'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, Phone, TriangleAlert } from 'lucide-react';
import { api, OrderDetail, OrderScope } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/form';
import {
  STAGE_LABEL,
  STAGE_VARIANT,
  formatAmount,
  formatDateTime,
  formatDelay,
  phoneHref,
  timelineLabel,
  whatsappHref,
} from './format';
import { FollowUpForm, PortalForm, ReassignControl, VerificationForm } from './order-forms';

export type DrawerTab = 'primary' | 'others';

interface OrderDrawerProps {
  ventureId: string;
  orderId: string;
  /** Position in the current list, for the Prev / Next arrows. */
  position: { index: number; total: number };
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** The screen showing the drawer; decides which work form appears. */
  scope: OrderScope;
  /** Called after a save so the list can refresh. */
  onChanged: () => void;
}

/**
 * Order drawer: header → actions → the work form for this screen → Primary / Others tabs →
 * activity timeline, with Prev / Next so a caller can work through a queue without closing it.
 * Forms appear only when the server's capability flags allow them.
 */
export function OrderDrawer({ ventureId, orderId, position, tab, onTabChange, onPrev, onNext, onClose, scope, onChanged }: OrderDrawerProps) {
  const { data: order, error, loading, setData } = useAsync(() => api.orders.get(ventureId, orderId, scope), [ventureId, orderId, scope]);
  const shown = order && order.id === orderId ? order : null;
  const formKey = shown ? `${shown.id}:${shown.updatedAt}` : '';
  const onSaved = (fresh: OrderDetail) => {
    setData(fresh);
    onChanged();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader className="pr-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono text-[#71717a]">{shown?.taskId ?? '…'}</span>
              {shown && (
                <Badge variant={STAGE_VARIANT[shown.stage]} dot>
                  {STAGE_LABEL[shown.stage]}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] text-[#a1a1aa] mr-1 tabular-nums">
                {position.index + 1} / {position.total}
              </span>
              <NavButton label="Previous order" disabled={position.index <= 0} onClick={onPrev}>
                <ChevronLeft className="w-4 h-4" />
              </NavButton>
              <NavButton label="Next order" disabled={position.index >= position.total - 1} onClick={onNext}>
                <ChevronRight className="w-4 h-4" />
              </NavButton>
            </div>
          </div>
          <h2 className="text-base font-semibold text-[#09090b] tracking-tight truncate">
            {shown ? shown.customerName || 'Unknown customer' : 'Loading…'}
          </h2>
          {shown && (
            <p className="text-xs text-[#71717a]">
              Order #{shown.orderNumber} · {formatAmount(shown.totalAmount)} · Owner: {currentAssignee(shown) ?? 'Unassigned'}
            </p>
          )}
        </SheetHeader>

        <SheetBody className="space-y-5">
          {error && <Alert>{error}</Alert>}
          {!shown && loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-[#71717a]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading order…
            </div>
          )}
          {shown && (
            <>
              {shown.cancelledInShopify && (
                <Alert tone="warning">This order was cancelled in Shopify.</Alert>
              )}
              {formatDelay(shown.delayMinutes) && shown.delayStatus && (
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    shown.delayStatus === 'overdue'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  <TriangleAlert className="w-3.5 h-3.5" />
                  {shown.delayStatus === 'overdue' ? 'Overdue by' : 'Finished late by'} {formatDelay(shown.delayMinutes)}
                </div>
              )}

              <div className="flex gap-2">
                {shown.phone ? (
                  <>
                    <ActionLink href={phoneHref(shown.phone)} icon={<Phone className="w-3.5 h-3.5" />} label="Call" />
                    <ActionLink
                      href={whatsappHref(shown.phone)}
                      icon={<MessageCircle className="w-3.5 h-3.5" />}
                      label="WhatsApp"
                      external
                    />
                  </>
                ) : (
                  <span className="text-[11px] text-[#a1a1aa]">No phone number on this order.</span>
                )}
              </div>

              {scope === 'verification' && shown.capabilities.canEditVerification && (
                <VerificationForm key={formKey} ventureId={ventureId} order={shown} onSaved={onSaved} />
              )}
              {scope === 'portal' && shown.capabilities.canEditPortal && (
                <PortalForm key={formKey} ventureId={ventureId} order={shown} onSaved={onSaved} />
              )}
              {scope === 'orders' && shown.capabilities.canEditFollowUp && (
                <FollowUpForm key={formKey} ventureId={ventureId} order={shown} onSaved={onSaved} />
              )}
              {shown.capabilities.reassignStep && (
                <ReassignControl
                  key={`r:${formKey}`}
                  ventureId={ventureId}
                  order={shown}
                  onSaved={onSaved}
                  step={shown.capabilities.reassignStep}
                />
              )}
              {scope !== 'orders' && !(scope === 'verification' ? shown.capabilities.canEditVerification : shown.capabilities.canEditPortal) && (
                <p className="text-[11px] text-[#71717a]">
                  {(scope === 'verification' ? shown.stage === 'verification_pending' : shown.stage === 'portal_pending')
                    ? 'View only: this order is owned by someone else.'
                    : 'This step is finished for this order.'}
                </p>
              )}

              <div className="flex gap-1 border-b border-[#f0f0f2]">
                {(['primary', 'others'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTabChange(t)}
                    className={`px-3 py-2 text-xs font-medium -mb-px border-b-2 cursor-pointer ${
                      tab === t ? 'border-[#09090b] text-[#09090b]' : 'border-transparent text-[#71717a] hover:text-[#09090b]'
                    }`}
                  >
                    {t === 'primary' ? 'Primary' : 'Others'}
                  </button>
                ))}
              </div>

              {tab === 'primary' ? <PrimaryFields order={shown} /> : <OtherFields order={shown} />}

              <section>
                <h3 className="text-xs font-semibold text-[#09090b] mb-2">Activity</h3>
                {shown.timeline.length === 0 ? (
                  <p className="text-[11px] text-[#a1a1aa]">No activity yet.</p>
                ) : (
                  <ol className="space-y-3 border-l border-[#e4e4e7] ml-1.5">
                    {shown.timeline.map((e) => (
                      <li key={e.id} className="pl-4 relative">
                        <span className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-[#d4d4d8]" />
                        <div className="text-xs text-[#09090b]">{timelineLabel(e.step, e.event)}</div>
                        <div className="text-[11px] text-[#71717a]">
                          {formatDateTime(e.at)}
                          {e.byUserName && ` · ${e.byUserName}`}
                        </div>
                        {e.note && <p className="text-[11px] text-[#3f3f46] mt-0.5">{e.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function currentAssignee(o: OrderDetail): string | null {
  return (o.stage === 'portal_pending' ? o.portalAssignee : o.verificationAssignee)?.name ?? null;
}

function PrimaryFields({ order: o }: { order: OrderDetail }) {
  return (
    <div className="space-y-4">
      <FieldGroup title="Customer">
        <Row label="Name" value={o.customerName} />
        <Row label="Phone" value={o.phone} mono />
        <Row label="Address" value={o.address} />
        <Row label="City / State" value={[o.city, o.state].filter(Boolean).join(', ')} />
        <Row label="Pincode" value={o.pincode} mono />
      </FieldGroup>
      <FieldGroup title="Order">
        <Row label="Order no." value={`#${o.orderNumber}`} mono />
        <Row label="Placed" value={formatDateTime(o.orderDate)} />
        <Row label="Products" value={o.products} />
        <Row label="Quantity" value={String(o.totalQty)} />
        <Row label="Amount" value={formatAmount(o.totalAmount)} />
        <Row label="Payment" value={o.paymentMethod} />
        <Row label="Channel" value={o.channel} />
      </FieldGroup>
    </div>
  );
}

function OtherFields({ order: o }: { order: OrderDetail }) {
  const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Yes' : 'No');
  return (
    <div className="space-y-4">
      <FieldGroup title="Verification & call">
        <Row label="Owner" value={o.verificationAssignee?.name} />
        <Row label="Due" value={o.verificationPlannedAt ? formatDateTime(o.verificationPlannedAt) : null} />
        <Row label="Completed" value={o.verificationActualAt ? formatDateTime(o.verificationActualAt) : null} />
        <Row label="Scan outcome" value={o.scanOutcome} />
        <Row label="Customer response" value={o.finalResponse} />
        <Row label="Collected" value={o.collectedAmount === null ? null : formatAmount(o.collectedAmount)} />
        <Row label="Balance" value={o.balanceAmount === null ? null : formatAmount(o.balanceAmount)} />
        <Row label="Address confirmed" value={yesNo(o.addressConfirmed)} />
        <Row label="New address" value={o.newAddress} />
        <Row label="Payment proof" value={o.screenshotUrl ? 'Uploaded' : null} />
        <Row label="Remarks" value={o.crmRemarks} />
      </FieldGroup>
      <FieldGroup title="Portal">
        <Row label="Owner" value={o.portalAssignee?.name} />
        <Row label="Due" value={o.portalPlannedAt ? formatDateTime(o.portalPlannedAt) : null} />
        <Row label="Completed" value={o.portalActualAt ? formatDateTime(o.portalActualAt) : null} />
        <Row label="Portal action" value={o.portalAction} />
        <Row label="Done in portal" value={o.portalDone ? 'Yes' : 'No'} />
        <Row label="Admin remarks" value={o.adminRemarks} />
      </FieldGroup>
      {o.followUpRequired && (
        <FieldGroup title="Follow-up">
          <Row label="Status" value={o.followUpDone ? 'Done' : 'Pending'} />
          <Row label="Notes" value={o.followUpNotes} />
        </FieldGroup>
      )}
      <FieldGroup title="Shopify">
        <Row label="Financial status" value={o.financialStatus} />
        <Row label="Fulfillment" value={o.fulfillmentStatus} />
        <Row label="Shopify order id" value={o.shopifyOrderId} mono />
      </FieldGroup>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#e4e4e7] bg-white">
      <h3 className="px-3.5 py-2 text-[11px] font-medium text-[#71717a] border-b border-[#f0f0f2] bg-[#fafafa] rounded-t-xl">
        {title}
      </h3>
      <dl className="divide-y divide-[#f0f0f2]">{children}</dl>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2">
      <dt className="text-[11px] text-[#71717a]">{label}</dt>
      <dd className={`text-xs text-[#09090b] break-words ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-[#a1a1aa]">—</span>}
      </dd>
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="p-1.5 rounded-md border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
    >
      {children}
    </button>
  );
}

function ActionLink({ href, icon, label, external }: { href: string; icon: ReactNode; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      className="inline-flex items-center gap-1.5 h-7.5 px-2.5 text-xs rounded-md border border-[#e4e4e7] bg-white text-[#18181b] hover:bg-[#f4f4f5]"
    >
      {icon} {label}
    </a>
  );
}
