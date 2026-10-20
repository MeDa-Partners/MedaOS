'use client';

import { useState, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { api, errorMessage, OrderDetail, OrderStep } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Checkbox, Field, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { FINAL_RESPONSES, PORTAL_ACTIONS, SCAN_GOOD_TO_GO, SCAN_OUTCOMES, STEP_LABEL } from './format';

/**
 * Editable parts of the order drawer. Which ones render is decided by the server's capability
 * flags (see OrderDrawer); every rule is enforced again by the API. Each form is remounted with a
 * `key` when the order changes, so its fields always start from the saved values.
 */

interface FormProps {
  ventureId: string;
  order: OrderDetail;
  onSaved: (order: OrderDetail) => void;
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className="w-full px-3 py-2 text-xs bg-white text-[#09090b] placeholder:text-[#a1a1aa] border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#09090b] focus:border-[#09090b] resize-y"
    />
  );
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#09090b]/15 bg-white">
      <h3 className="px-3.5 py-2 text-[11px] font-semibold text-[#09090b] border-b border-[#f0f0f2] bg-[#fafafa] rounded-t-xl">{title}</h3>
      <div className="p-3.5 space-y-3">{children}</div>
    </section>
  );
}

/** Runs a save, reports the result, hands the fresh order back. */
function useSave(onSaved: (order: OrderDetail) => void) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (call: () => Promise<OrderDetail>, success: string) => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await call();
      toast(success);
      onSaved(fresh);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run };
}

const toNumber = (v: string) => (v.trim() === '' ? null : Number(v));

export function VerificationForm({ ventureId, order, onSaved }: FormProps) {
  const [scan, setScan] = useState(order.scanOutcome ?? '');
  const [response, setResponse] = useState(order.finalResponse ?? '');
  const [collected, setCollected] = useState(order.collectedAmount?.toString() ?? '');
  const [balance, setBalance] = useState(order.balanceAmount?.toString() ?? '');
  const [addressConfirmed, setAddressConfirmed] = useState(!!order.addressConfirmed);
  const [newAddress, setNewAddress] = useState(order.newAddress ?? '');
  const [remarks, setRemarks] = useState(order.crmRemarks ?? '');
  const { saving, error, run } = useSave(onSaved);

  const goodScan = scan === SCAN_GOOD_TO_GO;
  const completes = (scan !== '' && !goodScan) || (goodScan && response !== '');

  const save = () =>
    run(
      () =>
        api.orders.updateVerification(ventureId, order.id, {
          ...(scan && { scanOutcome: scan }),
          ...(goodScan && response && { finalResponse: response }),
          collectedAmount: toNumber(collected),
          balanceAmount: toNumber(balance),
          addressConfirmed,
          newAddress: newAddress.trim() || null,
          crmRemarks: remarks.trim() || null,
        }),
      completes ? 'Verification completed' : 'Saved'
    );

  return (
    <FormCard title="Verification & call">
      <Field label="1. Scan outcome" hint="Check the customer in ClickPost first.">
        <Select value={scan} onChange={(e) => setScan(e.target.value)}>
          <option value="">Choose…</option>
          {SCAN_OUTCOMES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="2. Customer final response" hint={goodScan ? undefined : 'Available after a "Good to go" scan.'}>
        <Select value={goodScan ? response : ''} disabled={!goodScan} onChange={(e) => setResponse(e.target.value)}>
          <option value="">Choose after the call…</option>
          {FINAL_RESPONSES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount collected (₹)">
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={collected} onChange={(e) => setCollected(e.target.value)} />
        </Field>
        <Field label="Balance (₹)">
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
      </div>
      <Checkbox checked={addressConfirmed} onChange={setAddressConfirmed} label="Address confirmed with the customer" />
      <Field label="New address" hint="Only if the customer gave a different address.">
        <Textarea rows={2} value={newAddress} maxLength={1000} onChange={(e) => setNewAddress(e.target.value)} />
      </Field>
      <Field label="Remarks">
        <Textarea rows={2} value={remarks} maxLength={2000} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      {error && <Alert>{error}</Alert>}
      {completes && <Alert tone="info">Saving completes verification and moves the order on. It can&apos;t be edited here afterwards.</Alert>}
      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          {completes ? 'Save & complete' : 'Save'}
        </Button>
      </div>
    </FormCard>
  );
}

export function PortalForm({ ventureId, order, onSaved }: FormProps) {
  const [action, setAction] = useState(order.portalAction ?? '');
  const [remarks, setRemarks] = useState(order.adminRemarks ?? '');
  const { saving, error, run } = useSave(onSaved);

  const save = (done: boolean) =>
    run(
      () =>
        api.orders.updatePortal(ventureId, order.id, {
          ...(action && { portalAction: action }),
          adminRemarks: remarks.trim() || null,
          ...(done && { portalDone: true }),
        }),
      done ? 'Marked done in portal' : 'Saved'
    );

  return (
    <FormCard title="Portal">
      <Field label="Portal action" hint="Set from the call result. Change it only if the portal work was different.">
        <Select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Choose…</option>
          {PORTAL_ACTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Admin remarks">
        <Textarea rows={2} value={remarks} maxLength={2000} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => save(false)} disabled={saving}>
          Save
        </Button>
        <Button onClick={() => save(true)} loading={saving} disabled={!action}>
          Mark done in portal
        </Button>
      </div>
    </FormCard>
  );
}

export function FollowUpForm({ ventureId, order, onSaved }: FormProps) {
  const [done, setDone] = useState(order.followUpDone);
  const [notes, setNotes] = useState(order.followUpNotes ?? '');
  const { saving, error, run } = useSave(onSaved);

  const save = () =>
    run(() => api.orders.updateFollowUp(ventureId, order.id, { followUpDone: done, followUpNotes: notes.trim() || null }), 'Follow-up saved');

  return (
    <FormCard title="Follow-up (Soft Refused)">
      <Field label="Follow-up notes">
        <Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Checkbox checked={done} onChange={setDone} label="Follow-up done" />
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </FormCard>
  );
}

/** For people who may edit shifts: move the waiting step to someone else. */
export function ReassignControl({ ventureId, order, onSaved, step }: FormProps & { step: OrderStep }) {
  const current = (step === 'verification' ? order.verificationAssignee : order.portalAssignee)?.id ?? '';
  const [userId, setUserId] = useState(current);
  const shifts = useAsync(() => api.shifts.get(ventureId), [ventureId]);
  const { saving, error, run } = useSave(onSaved);
  const candidates = shifts.data?.steps[step].candidates ?? [];

  return (
    <FormCard title={`Reassign ${STEP_LABEL[step].toLowerCase()} owner`}>
      <div className="flex gap-2">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="flex-1">
          <option value="">Unassigned</option>
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          onClick={() => run(() => api.orders.reassign(ventureId, order.id, step, userId || null), 'Reassigned')}
          loading={saving}
          disabled={userId === current}
        >
          Reassign
        </Button>
      </div>
      {shifts.error && <Alert>{shifts.error}</Alert>}
      {error && <Alert>{error}</Alert>}
    </FormCard>
  );
}
