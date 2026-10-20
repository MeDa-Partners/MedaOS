'use client';

import { useEffect, useState } from 'react';
import { Loader2, PackageSearch, Search, TriangleAlert } from 'lucide-react';
import { api, OrderScope, OrderView } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/empty-state';
import { OrderDrawer, DrawerTab } from './order-drawer';
import { DELAY_CLASS, STAGE_LABEL, STAGE_VARIANT, VIEW_LABEL, formatAmount, formatDateTime, formatDelay } from './format';

export interface OrderWorkspaceConfig {
  /** Which screen this is. The server decides its tabs, sorting and what may be edited. */
  scope: OrderScope;
  /** Saved-view tab selected on open. */
  defaultView: OrderView;
}

function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * The shared order list (TeleCRM layout): saved-view tabs → search → table → drawer with
 * Prev / Next. Configured per section: orders (read-only), verification and portal (work queues,
 * soonest deadline first).
 */
export function OrderWorkspace({ ventureId, config }: { ventureId: string; config: OrderWorkspaceConfig }) {
  const { scope } = config;
  const [view, setView] = useState<OrderView>(config.defaultView);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('primary');
  const debouncedSearch = useDebounced(search.trim());

  const list = useAsync(
    () => api.orders.list(ventureId, { scope, view, search: debouncedSearch || undefined, limit: 200 }),
    [ventureId, scope, view, debouncedSearch]
  );
  const views = list.data?.views ?? [config.defaultView];
  const isQueue = scope !== 'orders';
  const health = useAsync(() => api.sync.health(ventureId), [ventureId]);

  const rows = list.data?.orders ?? [];
  const selectedIndex = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1;
  const goTo = (index: number) => {
    const row = rows[index];
    if (row) setSelectedId(row.id);
  };

  return (
    <div>
      {health.data?.stale && <SyncBanner health={health.data} />}

      <div className="flex gap-1 overflow-x-auto border-b border-[#e4e4e7] mb-4 -mx-1 px-1">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`shrink-0 px-3 py-2 text-xs font-medium -mb-px border-b-2 cursor-pointer flex items-center gap-1.5 ${
              view === v ? 'border-[#09090b] text-[#09090b]' : 'border-transparent text-[#71717a] hover:text-[#09090b]'
            }`}
          >
            {VIEW_LABEL[v]}
            {list.data && (
              <span className="text-[10px] rounded-full bg-[#f4f4f5] text-[#52525b] px-1.5 py-px tabular-nums">
                {list.data.counts[v]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative mb-4 lg:max-w-sm">
        <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Task-ID, order no., name or phone"
          className="pl-8"
        />
      </div>

      {list.error && (
        <div className="mb-4">
          <Alert>{list.error}</Alert>
        </div>
      )}

      {!list.data && list.loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-xs text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading orders…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={search ? 'No matching orders' : 'No orders here'}
          description={
            search
              ? 'Try a different Task-ID, order number, name or phone.'
              : 'COD orders from Shopify appear here as soon as the sync picks them up.'
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-[#e4e4e7] bg-white shadow-2xs overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f0f0f2] bg-[#fafafa] text-[11px] font-medium text-[#71717a]">
                  <th className="px-4 py-2.5 font-medium">Task-ID</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Stage</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">{isQueue ? 'Due' : 'Arrived'}</th>
                  <th className="px-4 py-2.5 font-medium">Delay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f2]">
                {rows.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`cursor-pointer transition-colors ${o.id === selectedId ? 'bg-[#f4f4f5]' : 'hover:bg-[#fafafa]'}`}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-[#3f3f46] whitespace-nowrap">{o.taskId ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium text-[#09090b] truncate max-w-48">{o.customerName || 'Unknown'}</div>
                      <div className="text-[11px] text-[#71717a]">#{o.orderNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3f3f46]">
                      <div className="truncate max-w-64" title={o.products ?? ''}>
                        {o.products || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#09090b] text-right tabular-nums whitespace-nowrap">
                      {formatAmount(o.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={STAGE_VARIANT[o.stage]} dot>
                          {STAGE_LABEL[o.stage]}
                        </Badge>
                        {o.followUpRequired && !o.followUpDone && <Badge variant="warning">Follow-up</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3f3f46]">
                      {o.assigneeName ?? <span className="text-[#a1a1aa]">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#3f3f46] whitespace-nowrap">{formatDateTime(isQueue ? o.plannedAt : o.orderDate)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatDelay(o.delayMinutes) && o.delayStatus ? (
                        <span
                          className={`${DELAY_CLASS[o.delayStatus]} font-medium`}
                          title={o.delayStatus === 'overdue' ? 'Open and past its deadline' : 'Finished after its deadline'}
                        >
                          {formatDelay(o.delayMinutes)}
                        </span>
                      ) : (
                        <span className="text-[#a1a1aa]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedId(o.id)}
                className="w-full text-left rounded-xl border border-[#e4e4e7] bg-white p-3 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-[#71717a]">{o.taskId ?? '—'}</span>
                  <Badge variant={STAGE_VARIANT[o.stage]} dot>
                    {STAGE_LABEL[o.stage]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[13px] font-medium text-[#09090b] truncate">{o.customerName || 'Unknown'}</span>
                  <span className="text-xs text-[#09090b] tabular-nums">{formatAmount(o.totalAmount)}</span>
                </div>
                <div className="text-[11px] text-[#71717a] truncate">{o.products}</div>
                <div className="text-[11px] text-[#71717a] mt-1 flex items-center justify-between gap-2">
                  <span>{o.assigneeName ?? 'Unassigned'}</span>
                  {formatDelay(o.delayMinutes) && o.delayStatus ? (
                    <span className={`${DELAY_CLASS[o.delayStatus]} font-medium`}>
                      {o.delayStatus === 'overdue' ? 'Overdue' : 'Late'} {formatDelay(o.delayMinutes)}
                    </span>
                  ) : (
                    <span>{isQueue ? `Due ${formatDateTime(o.plannedAt)}` : formatDateTime(o.orderDate)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-[#a1a1aa] mt-3">
            Showing {rows.length} of {list.data?.counts[view] ?? rows.length}
          </p>
        </>
      )}

      {selectedId && (
        <OrderDrawer
          ventureId={ventureId}
          orderId={selectedId}
          position={{ index: Math.max(selectedIndex, 0), total: Math.max(rows.length, 1) }}
          tab={drawerTab}
          onTabChange={setDrawerTab}
          onPrev={() => goTo(selectedIndex - 1)}
          onNext={() => goTo(selectedIndex + 1)}
          onClose={() => setSelectedId(null)}
          scope={scope}
          onChanged={list.reload}
        />
      )}
    </div>
  );
}

function SyncBanner({ health }: { health: { configured: boolean; scheduleEnabled: boolean; lastSuccessAt: string | null; lastError: string | null } }) {
  const reason = !health.configured
    ? 'Shopify is not configured on the server.'
    : !health.scheduleEnabled
      ? 'The automatic Shopify sync is switched off on the server.'
      : `No successful Shopify sync since ${health.lastSuccessAt ? formatDateTime(health.lastSuccessAt) : 'it was set up'}.`;
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
      <TriangleAlert className="w-4 h-4 shrink-0 mt-px" />
      <div>
        <div className="font-semibold">Orders may be out of date</div>
        <div className="mt-0.5">
          {reason} New COD orders will not appear until it runs again.
          {health.lastError && <span className="block mt-1 font-mono text-[11px] text-red-700 break-all">Last error: {health.lastError}</span>}
        </div>
      </div>
    </div>
  );
}
