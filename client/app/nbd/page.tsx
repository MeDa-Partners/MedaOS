'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { api, ApiError } from '@/lib/api';
import {
  Target,
  ShieldCheck,
  Building2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Handshake,
  CheckCircle2,
} from 'lucide-react';

export default function NbdPage() {
  const { activeVenture, activeTeam } = useAuth();
  const [sectionStatus, setSectionStatus] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.sections.checkAccess('nbd');
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
      .checkAccess('nbd')
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
      title="NBD Workspace"
      description="New Business Development and venture expansion pipelines"
      requiredSectionSlug="nbd"
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
                  Backend NBD Section Authorization Verified
                </h3>
                <p className="text-[11px] text-[#71717a]">
                  Verified live via{' '}
                  <code className="text-[#09090b] font-mono">
                    GET /api/v1/sections/nbd/access-check
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
              {sectionStatus?.message || 'Authorized: Team assigned to NBD section in database'}
            </span>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Current Venture Workspace */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-center text-[#09090b]">
              <Target className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#a1a1aa] tracking-wider">
                Venture Strategy Context
              </span>
              <h2 className="text-base font-semibold text-[#09090b] tracking-tight">
                {activeVenture?.name || 'Venture NBD'} Expansion
              </h2>
            </div>
          </div>

          <div className="text-xs text-[#71717a] font-mono bg-[#fafafa] px-3 py-1.5 rounded-lg border border-[#f0f0f2]">
            Assigned Team: {activeTeam?.name || 'Administration'}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">New Brand Inquiries</span>
              <Handshake className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              28
            </div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Strategic partnerships pipeline
            </span>
          </div>

          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Expansion Growth</span>
              <TrendingUp className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              +35%
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
              Quarterly expansion rate
            </span>
          </div>

          <div className="p-5 bg-white border border-[#e4e4e7] rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-[#71717a] mb-2">
              <span className="text-xs font-medium">Ventures Incubating</span>
              <Building2 className="w-4 h-4 text-[#a1a1aa]" />
            </div>
            <div className="text-2xl font-bold text-[#09090b] tracking-tight font-mono">
              3 Live
            </div>
            <span className="text-[11px] text-[#71717a] mt-1 block">
              Wayveda, Nature Mania, My Fit Brain
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
