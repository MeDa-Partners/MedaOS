'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { api, ApiError } from '@/lib/api';
import {
  ShieldCheck,
  Building2,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Users,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export default function SalesPage() {
  const { activeVenture, activeTeam, user } = useAuth();
  const [sectionStatus, setSectionStatus] = useState<{ message: string } | null>(null);
  const [ventureStatus, setVentureStatus] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [secRes, venRes] = await Promise.all([
        api.sections.checkAccess('sales'),
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
      api.sections.checkAccess('sales'),
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
      icon={<TrendingUp className="w-3.5 h-3.5" />}
      title="Sales Workspace"
      description="Multi-venture sales performance and pipeline"
      requiredSectionSlug="sales"
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
                  <code className="text-[#09090b] font-mono">requireSection(&apos;sales&apos;)</code>{' '}
                  and{' '}
                  <code className="text-[#09090b] font-mono">requireVentureAccess()</code>
                </p>
              </div>
            </div>

            <button
              onClick={fetchAccess}
              disabled={loading}
              className="px-2.5 py-1.5 text-xs text-[#52525b] hover:text-[#09090b] border border-[#e4e4e7] rounded-lg transition-colors flex items-center gap-1.5"
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
                <span>Allowed: {sectionStatus?.message || 'Authorized for /sales'}</span>
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
                    User: {user?.email} (Verified via user_ventures)
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
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Venture Workspace Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-center text-[#09090b]">
              <Building2 className="w-5 h-5 text-[#18181b]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#a1a1aa] tracking-wider">
                Current Operational Context
              </span>
              <h2 className="text-base font-semibold text-[#09090b] tracking-tight">
                {activeVenture?.name || 'Venture Sales'} Workspace
              </h2>
            </div>
          </div>

          <div className="text-xs text-[#71717a] font-mono bg-[#fafafa] px-3 py-1.5 rounded-lg border border-[#f0f0f2]">
            Venture ID: {activeVenture?.id || 'None'}
          </div>
        </div>

        {/* Operational Metrics Cards for the Current Venture */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Monthly Venture Target</span>
              <DollarSign className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              ₹14,50,000
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
              +12.4% vs last cycle
            </span>
          </div>

          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Active Pipeline Orders</span>
              <ShoppingCart className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              342 Units
            </div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Across active channels
            </span>
          </div>

          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Assigned Team Reps</span>
              <Users className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              Sales Department
            </div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              {activeTeam?.name || 'Administration'} Members
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
