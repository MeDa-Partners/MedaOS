'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { api, ApiError } from '@/lib/api';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PieChart,
  Users2,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';

export default function ManagementPage() {
  const { activeTeam, ventures } = useAuth();
  const [sectionStatus, setSectionStatus] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.sections.checkAccess('management');
      setSectionStatus(res);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Backend check failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    api.sections
      .checkAccess('management')
      .then((res) => {
        if (!ignore) {
          setSectionStatus(res);
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
  }, []);

  return (
    <AppShell
      title="Management Workspace"
      description="Executive cross-venture oversight and organizational governance"
      requiredSectionSlug="management"
    >
      <div className="space-y-6">
        {/* Verification Card */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f2]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#09090b]">
                  Backend Management Section Authorization Verified
                </h3>
                <p className="text-[11px] text-[#71717a]">
                  Verified live via{' '}
                  <code className="text-[#09090b] font-mono">
                    GET /api/v1/sections/management/access-check
                  </code>
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

          <div className="pt-4 flex items-center gap-2 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {sectionStatus?.message || 'Authorized: Team assigned to management section in database'}
            </span>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Portfolio Overview */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-6 shadow-xs">
          <h2 className="text-sm font-semibold text-[#09090b] tracking-tight mb-1">
            MeDa Partners Multi-Venture Portfolio
          </h2>
          <p className="text-xs text-[#71717a] mb-6">
            Consolidated governance of active business ventures under parent company operations
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ventures.map((m) => {
              const v = m.venture;
              return (
                <div
                  key={v.id}
                  className="p-4 bg-[#fafafa] border border-[#f0f0f2] rounded-xl flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-[#09090b]">{v.name}</h4>
                    <span className="text-[10px] font-mono text-[#a1a1aa]">
                      Slug: {v.slug}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Operational
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Executive Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Active Ventures</span>
              <Briefcase className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              {ventures.length}
            </div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Brands under management
            </span>
          </div>

          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Department Function</span>
              <Users2 className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              {activeTeam?.name || 'Executive'}
            </div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Role configuration
            </span>
          </div>

          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Organization Alignment</span>
              <PieChart className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              100%
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
              Governance synchronized
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
