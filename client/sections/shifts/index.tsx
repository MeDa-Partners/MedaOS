'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, Plus, Trash2, TriangleAlert, Users } from 'lucide-react';
import type { SectionModuleProps } from '../registry';
import { api, errorMessage, OrderStep, ShiftRow, ShiftsOverview, StepShifts } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { shiftProblems } from './tiling';

const STEPS: { step: OrderStep; label: string; hint: string }[] = [
  { step: 'verification', label: 'Verification', hint: 'New COD orders go to the owner of the shift covering the time the order was placed.' },
  { step: 'portal', label: 'Portal', hint: 'After verification, the order goes to the owner of the shift covering that moment.' },
];

const TEMPLATE: ShiftRow[] = [
  { name: 'Day Shift', startTime: '09:00', endTime: '18:00', assigneeUserId: null },
  { name: 'Night Shift', startTime: '18:00', endTime: '09:00', assigneeUserId: null },
];

/**
 * Shifts & Assignment: who owns orders arriving in each time window, per step, plus moving
 * pending orders between people. Orders are assigned once, when they enter a step; editing a
 * shift never moves orders that are already assigned.
 */
export default function ShiftsSection({ venture }: SectionModuleProps) {
  const [step, setStep] = useState<OrderStep>('verification');
  const overview = useAsync(() => api.shifts.get(venture.id), [venture.id]);

  if (!overview.data) {
    return overview.error ? (
      <Alert>{overview.error}</Alert>
    ) : (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[#71717a]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading shifts…
      </div>
    );
  }

  const data = overview.data;
  const current = data.steps[step];
  const canEdit = data.capabilities.canEditShifts;
  const meta = STEPS.find((s) => s.step === step)!;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-[#e4e4e7]">
        {STEPS.map((s) => (
          <button
            key={s.step}
            type="button"
            onClick={() => setStep(s.step)}
            className={`px-3 py-2 text-xs font-medium -mb-px border-b-2 cursor-pointer flex items-center gap-1.5 ${
              step === s.step ? 'border-[#09090b] text-[#09090b]' : 'border-transparent text-[#71717a] hover:text-[#09090b]'
            }`}
          >
            {s.label}
            {data.steps[s.step].unassigned > 0 && (
              <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-1.5 py-px tabular-nums">
                {data.steps[s.step].unassigned}
              </span>
            )}
          </button>
        ))}
      </div>

      {current.unassigned > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-px" />
          <div>
            <span className="font-semibold">{current.unassigned} order(s) waiting on {meta.label.toLowerCase()} have no owner.</span>{' '}
            This happens when no shift covers the time, a shift has no owner, or its owner left. Move them below.
          </div>
        </div>
      )}

      <ShiftEditor
        key={`${step}:${JSON.stringify(current.shifts)}`}
        ventureId={venture.id}
        step={step}
        hint={meta.hint}
        data={current}
        canEdit={canEdit}
        onSaved={(fresh) => overview.setData(fresh)}
      />

      {canEdit && (
        <BulkReassign key={step} ventureId={venture.id} step={step} data={current} label={meta.label} onMoved={overview.reload} />
      )}
    </div>
  );
}

function ShiftEditor({
  ventureId,
  step,
  hint,
  data,
  canEdit,
  onSaved,
}: {
  ventureId: string;
  step: OrderStep;
  hint: string;
  data: StepShifts;
  canEdit: boolean;
  onSaved: (fresh: ShiftsOverview) => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<ShiftRow[]>(data.shifts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = shiftProblems(rows);
  const dirty = JSON.stringify(rows.map(strip)) !== JSON.stringify(data.shifts.map(strip));

  const update = (i: number, patch: Partial<ShiftRow>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await api.shifts.save(ventureId, step, rows.map(strip));
      toast('Shifts saved');
      onSaved(fresh);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#e4e4e7] bg-white shadow-2xs">
      <div className="px-4 py-3 border-b border-[#f0f0f2]">
        <h3 className="text-sm font-semibold text-[#09090b]">Shifts</h3>
        <p className="text-[11px] text-[#71717a] mt-0.5">{hint} Times are IST. A shift ending before it starts runs past midnight.</p>
      </div>

      <div className="p-4 space-y-2.5">
        {rows.length === 0 && (
          <div className="text-xs text-[#71717a] flex items-center gap-3">
            No shifts yet.
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setRows(TEMPLATE)}>
                Start with Day / Night shifts
              </Button>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <div className="hidden sm:grid grid-cols-[1fr_100px_100px_1fr_32px] gap-2 text-[11px] font-medium text-[#71717a] px-0.5">
            <span>Name</span>
            <span>Start</span>
            <span>End</span>
            <span>Owner</span>
            <span />
          </div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_100px_100px_1fr_32px] gap-2 items-center">
            <Input className="col-span-2 sm:col-span-1" value={r.name} disabled={!canEdit} placeholder="Shift name" onChange={(e) => update(i, { name: e.target.value })} />
            <Input type="time" value={r.startTime} disabled={!canEdit} onChange={(e) => update(i, { startTime: e.target.value })} />
            <Input type="time" value={r.endTime} disabled={!canEdit} onChange={(e) => update(i, { endTime: e.target.value })} />
            <Select
              className="col-span-2 sm:col-span-1"
              value={r.assigneeUserId ?? ''}
              disabled={!canEdit}
              onChange={(e) => update(i, { assigneeUserId: e.target.value || null })}
            >
              <option value="">No owner (orders wait unassigned)</option>
              {data.candidates.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name}
                </option>
              ))}
              {r.assigneeUserId && !data.candidates.some((c) => c.userId === r.assigneeUserId) && (
                <option value={r.assigneeUserId}>{r.assigneeName ?? 'Former owner'} (no longer eligible)</option>
              )}
            </Select>
            {canEdit && (
              <button
                type="button"
                title="Remove shift"
                aria-label="Remove shift"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                className="justify-self-end sm:justify-self-auto p-1.5 rounded-md text-[#a1a1aa] hover:text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {data.candidates.length === 0 && (
          <Alert tone="warning">
            Nobody can own these orders yet. Give people the {step === 'verification' ? 'Verification & Calls' : 'Portal Actions'} section first.
          </Alert>
        )}
        {rows.length > 0 && problems.length > 0 && <Alert tone="warning">{problems.join(' ')}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>

      {canEdit ? (
        <div className="px-4 py-3 border-t border-[#f0f0f2] bg-[#fafafa] rounded-b-xl flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={rows.length >= 5}
            onClick={() => setRows((prev) => [...prev, { name: '', startTime: '', endTime: '', assigneeUserId: null }])}
          >
            <Plus className="w-3.5 h-3.5" /> Add shift
          </Button>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button size="sm" variant="secondary" onClick={() => setRows(data.shifts)} disabled={saving}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={save} loading={saving} disabled={!dirty || problems.length > 0}>
              Save shifts
            </Button>
          </div>
        </div>
      ) : (
        <p className="px-4 py-3 border-t border-[#f0f0f2] text-[11px] text-[#71717a]">
          View only. A department head, or a team head with this section, can change shifts.
        </p>
      )}
    </section>
  );
}

const strip = (r: ShiftRow) => ({ name: r.name.trim(), startTime: r.startTime, endTime: r.endTime, assigneeUserId: r.assigneeUserId });

/** "Move all of X's pending orders to Y" — for leave and hand-overs. */
function BulkReassign({
  ventureId,
  step,
  data,
  label,
  onMoved,
}: {
  ventureId: string;
  step: OrderStep;
  data: StepShifts;
  label: string;
  onMoved: () => void;
}) {
  const toast = useToast();
  const [from, setFrom] = useState(data.unassigned > 0 ? '__unassigned' : data.pendingByOwner[0]?.userId ?? '');
  const [to, setTo] = useState('');
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sources = [
    ...(data.unassigned > 0 ? [{ value: '__unassigned', label: `Unassigned (${data.unassigned})` }] : []),
    ...data.pendingByOwner.map((p) => ({ value: p.userId, label: `${p.name} (${p.pending})` })),
  ];
  const fromUserId = from === '__unassigned' ? null : from;

  const move = async () => {
    setMoving(true);
    setError(null);
    try {
      const { moved } = await api.orders.bulkReassign(ventureId, step, fromUserId, to);
      toast(`${moved} order(s) moved`);
      onMoved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMoving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#e4e4e7] bg-white shadow-2xs">
      <div className="px-4 py-3 border-b border-[#f0f0f2]">
        <h3 className="text-sm font-semibold text-[#09090b] flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[#71717a]" /> Move pending {label.toLowerCase()} orders
        </h3>
        <p className="text-[11px] text-[#71717a] mt-0.5">
          For leave or a hand-over. Changing a shift owner does not move orders that are already assigned — do it here.
        </p>
      </div>
      <div className="p-4">
        {sources.length === 0 ? (
          <p className="text-xs text-[#71717a]">No pending {label.toLowerCase()} orders to move.</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Select value={from} onChange={(e) => setFrom(e.target.value)} className="sm:flex-1">
              {sources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <ArrowRight className="hidden sm:block w-4 h-4 text-[#a1a1aa] shrink-0" />
            <Select value={to} onChange={(e) => setTo(e.target.value)} className="sm:flex-1">
              <option value="">Move to…</option>
              {data.candidates
                .filter((c) => c.userId !== fromUserId)
                .map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <Button size="sm" onClick={move} loading={moving} disabled={!from || !to}>
              Move all
            </Button>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
      </div>
    </section>
  );
}
