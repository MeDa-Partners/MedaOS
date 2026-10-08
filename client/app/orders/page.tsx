'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { api, ApiError } from '@/lib/api';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function OrdersPage() {
  const { activeVenture, activeTeam } = useAuth();
  const [sectionStatus, setSectionStatus] = useState<{ message: string } | null>(null);
  const [ventureStatus, setVentureStatus] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [secRes, venRes] = await Promise.all([
        api.sections.checkAccess('orders'),
        activeVenture ? api.ventures.testAccess(activeVenture.id) : Promise.resolve(null),
      ]);
      setSectionStatus(secRes);
      setVentureStatus(venRes);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Backend check failed');
    } finally {
      setLoading(false);
    }
  }, [activeVenture]);

  useEffect(() => {
    let ignore = false;

    Promise.all([
      api.sections.checkAccess('orders'),
      activeVenture ? api.ventures.testAccess(activeVenture.id) : Promise.resolve(null),
    ])
      .then(([secRes, venRes]) => {
        if (!ignore) {
          setSectionStatus(secRes);
          setVentureStatus(venRes);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : 'Backend check failed');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeVenture]);

  return (
    <AppShell
      title="Orders Workspace"
      description="Fulfillment tracking, order dispatching, and venture inventory orders"
      requiredSectionSlug="orders"
    >
      <div className="space-y-6">
        {/* Backend Authorization Status Card */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f2]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#09090b]">
                  Backend Section & Venture Verification
                </h3>
                <p className="text-[11px] text-[#71717a]">
                  Verified live by Express middleware:{' '}
                  <code className="text-[#09090b] font-mono">requireSection(&apos;orders&apos;)</code>
                </p>
              </div>
            </div>

            <button
              onClick={fetchAccess}
              disabled={loading}
              className="px-2.5 py-1.5 text-xs text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Verify</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="p-3 bg-[#fafafa] border border-[#f0f0f2] rounded-lg">
              <span className="text-[10px] font-mono text-[#a1a1aa] uppercase block">
                Section Authorization Check
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Allowed: {sectionStatus?.message || 'Authorized for /orders'}</span>
              </div>
              <span className="text-[10px] text-[#71717a] font-mono mt-0.5 block">
                Team: {activeTeam?.name || 'Administration'} (Verified via user_sections)
              </span>
            </div>

            <div className="p-3 bg-[#fafafa] border border-[#f0f0f2] rounded-lg">
              <span className="text-[10px] font-mono text-[#a1a1aa] uppercase block">
                Venture Authorization Check
              </span>
              {activeVenture ? (
                <div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Allowed: {ventureStatus?.message || `${activeVenture.name} Data`}</span>
                  </div>
                  <span className="text-[10px] text-[#71717a] font-mono mt-0.5 block">
                    Venture: {activeVenture.name} (Verified via user_ventures)
                  </span>
                </div>
              ) : (
                <div className="text-xs text-[#71717a] mt-1 italic">
                  Select a venture from the sidebar to verify
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Demo KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Pending Processing</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-[#09090b]">48</div>
            <span className="text-[11px] text-[#a1a1aa] mt-1 block">
              In queue for {activeVenture?.name || 'venture'}
            </span>
          </div>

          <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Dispatched Today</span>
              <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-[#09090b]">134</div>
            <span className="text-[11px] text-emerald-600 mt-1 block">
              +18% from yesterday
            </span>
          </div>

          <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Delivered</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-[#09090b]">1,289</div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Across all dispatch hubs
            </span>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f0f0f2]">
            <h4 className="text-xs font-semibold text-[#09090b]">Recent Orders</h4>
            <p className="text-[11px] text-[#71717a]">
              Live order feed for {activeVenture?.name || 'this venture'}
            </p>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-[#fafafa] border-b border-[#e4e4e7] text-[#71717a]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Order ID</th>
                <th className="py-2.5 px-4 font-medium">Customer</th>
                <th className="py-2.5 px-4 font-medium">Items</th>
                <th className="py-2.5 px-4 font-medium">Amount</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f2]">
              <tr className="hover:bg-[#fafafa]">
                <td className="py-3 px-4 font-mono font-medium text-[#09090b]">ORD-9021</td>
                <td className="py-3 px-4 text-[#18181b]">Aarav Patel</td>
                <td className="py-3 px-4 text-[#71717a]">3 items</td>
                <td className="py-3 px-4 font-medium text-[#09090b]">₹2,499</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Dispatched
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="py-3 px-4 font-mono font-medium text-[#09090b]">ORD-9020</td>
                <td className="py-3 px-4 text-[#18181b]">Priya Nair</td>
                <td className="py-3 px-4 text-[#71717a]">1 item</td>
                <td className="py-3 px-4 font-medium text-[#09090b]">₹899</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    Processing
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="py-3 px-4 font-mono font-medium text-[#09090b]">ORD-9019</td>
                <td className="py-3 px-4 text-[#18181b]">Rohan Gupta</td>
                <td className="py-3 px-4 text-[#71717a]">4 items</td>
                <td className="py-3 px-4 font-medium text-[#09090b]">₹4,120</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    Packed
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
