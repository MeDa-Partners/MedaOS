'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, ApiError, setActiveVentureHeader } from '@/lib/api';
import {
  Building2,
  FolderTree,
  Network,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Lock,
  TrendingUp,
  Briefcase,
  Activity,
  FileCheck,
} from 'lucide-react';

interface SectionPageProps {
  params: Promise<{
    ventureSlug: string;
    sectionSlug: string;
  }>;
}

export default function VentureSectionPage({ params }: SectionPageProps) {
  const resolvedParams = use(params);
  const { ventureSlug, sectionSlug } = resolvedParams;

  const {
    isAdmin,
    activeVenture,
    activeDepartment,
    activeTeam,
    ventures,
    allVentures,
    setActiveVentureId,
  } = useAuth();

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync active venture in context if needed
  useEffect(() => {
    const matchedVenture = (allVentures.length > 0 ? allVentures : ventures.map((m) => m.venture)).find(
      (v) => v.slug === ventureSlug
    );
    if (matchedVenture && activeVenture?.id !== matchedVenture.id) {
      setActiveVentureId(matchedVenture.id);
    }
  }, [ventureSlug, allVentures, ventures, activeVenture?.id, setActiveVentureId]);

  // Check section access on backend
  useEffect(() => {
    let isCancelled = false;

    async function checkAccess() {
      try {
        const targetVenture = (allVentures.length > 0 ? allVentures : ventures.map((m) => m.venture)).find(
          (v) => v.slug === ventureSlug
        );
        if (targetVenture) {
          setActiveVentureHeader(targetVenture.id);
        }

        await api.sections.checkAccess(sectionSlug);
        if (!isCancelled) {
          setError(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError('Failed to verify section access');
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    checkAccess();

    return () => {
      isCancelled = true;
    };
  }, [ventureSlug, sectionSlug, allVentures, ventures]);

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const targetVenture = (allVentures.length > 0 ? allVentures : ventures.map((m) => m.venture)).find(
        (v) => v.slug === ventureSlug
      );
      if (targetVenture) {
        setActiveVentureHeader(targetVenture.id);
      }

      await api.sections.checkAccess(sectionSlug);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to verify section access');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTitle = (slug: string) =>
    slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const title = formatTitle(sectionSlug);
  const ventureName = formatTitle(ventureSlug);

  return (
    <AppShell
      icon={<Layers className="w-3.5 h-3.5" />}
      title={`${title} Workspace`}
      description={`Scoped to ${ventureName}`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#71717a]">
          <Link href={`/${ventureSlug}`} className="hover:text-[#09090b] flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>{ventureName}</span>
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#09090b] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            <span>{title}</span>
          </span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-8 h-8 animate-spin text-[#09090b] mb-3" />
            <span className="text-sm font-medium text-[#09090b]">Verifying Section Access...</span>
            <span className="text-xs text-[#71717a] mt-1">
              Checking organizational membership, department enablement, and permissions
            </span>
          </div>
        ) : error ? (
          /* Access Denied State */
          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm my-12">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-[#09090b]">Access Restricted</h2>
            <p className="text-xs text-[#71717a] mt-2 leading-relaxed">{error}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-xs font-medium bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg text-[#09090b] transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={handleRetry}
                className="px-4 py-2 text-xs font-medium bg-[#09090b] hover:bg-[#27272a] text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : (
          /* Operational Feature Workspace */
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white border border-[#e4e4e7] rounded-xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#09090b] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-[#09090b]">{title}</h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      Active
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#71717a]">
                    <span className="flex items-center gap-1 font-medium text-[#18181b]">
                      <Building2 className="w-3.5 h-3.5 text-[#71717a]" />
                      {ventureName}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">/{ventureSlug}/{sectionSlug}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 bg-[#f4f4f5] px-3 py-1.5 rounded-lg border border-[#e4e4e7] text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-[#09090b] font-medium">Authorized by MeDaOS Policy</span>
              </div>
            </div>

            {/* Scope / Authorization Context Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs">
                <div className="text-[10px] font-mono uppercase text-[#a1a1aa] tracking-wider mb-1">
                  Active Venture
                </div>
                <div className="text-sm font-semibold text-[#09090b] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#71717a]" />
                  <span>{activeVenture?.name || ventureName}</span>
                </div>
                <div className="text-[11px] text-[#71717a] mt-1 font-mono">/{ventureSlug}</div>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs">
                <div className="text-[10px] font-mono uppercase text-[#a1a1aa] tracking-wider mb-1">
                  Assigned Department
                </div>
                <div className="text-sm font-semibold text-[#09090b] flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-[#71717a]" />
                  <span>{activeDepartment?.name || 'Department Managed'}</span>
                </div>
                <div className="text-[11px] text-[#71717a] mt-1">Section Owner Scope</div>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs">
                <div className="text-[10px] font-mono uppercase text-[#a1a1aa] tracking-wider mb-1">
                  Operating Team
                </div>
                <div className="text-sm font-semibold text-[#09090b] flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-[#71717a]" />
                  <span>{isAdmin ? 'Global Administration' : activeTeam?.name || 'Authorized Member'}</span>
                </div>
                <div className="text-[11px] text-[#71717a] mt-1">Data Access Boundary</div>
              </div>
            </div>

            {/* Operational Workspace Demo Area */}
            <div className="bg-white border border-[#e4e4e7] rounded-xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f2]">
                <div>
                  <h2 className="text-sm font-bold text-[#09090b]">
                    {ventureName} — {title} Operational Console
                  </h2>
                  <p className="text-xs text-[#71717a] mt-0.5">
                    Live operational records scoped to {ventureName} and authorized user permissions.
                  </p>
                </div>

                <button
                  onClick={handleRetry}
                  className="px-3 py-1.5 text-xs text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Records</span>
                </button>
              </div>

              {/* Sample Metrics / Operational Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-[#fafafa] rounded-xl border border-[#e4e4e7]">
                  <div className="text-[11px] text-[#71717a] font-medium">Active Tasks</div>
                  <div className="text-2xl font-bold text-[#09090b] mt-1">24</div>
                  <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>In progress today</span>
                  </div>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-xl border border-[#e4e4e7]">
                  <div className="text-[11px] text-[#71717a] font-medium">Pending Verification</div>
                  <div className="text-2xl font-bold text-[#09090b] mt-1">7</div>
                  <div className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Requires team review</span>
                  </div>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-xl border border-[#e4e4e7]">
                  <div className="text-[11px] text-[#71717a] font-medium">Completed Deliverables</div>
                  <div className="text-2xl font-bold text-[#09090b] mt-1">142</div>
                  <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <FileCheck className="w-3 h-3" />
                    <span>This calendar month</span>
                  </div>
                </div>

                <div className="p-4 bg-[#fafafa] rounded-xl border border-[#e4e4e7]">
                  <div className="text-[11px] text-[#71717a] font-medium">Security Scope</div>
                  <div className="text-2xl font-bold text-[#09090b] mt-1">100%</div>
                  <div className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Strict venture isolation</span>
                  </div>
                </div>
              </div>

              {/* Workflow Status Info */}
              <div className="p-4 bg-[#fafafa] rounded-xl border border-[#e4e4e7] text-xs text-[#52525b] space-y-1">
                <div className="font-semibold text-[#09090b] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>MeDaOS Access Guarantee</span>
                </div>
                <p>
                  This operational view is isolated to the <span className="font-medium text-[#09090b]">{ventureName}</span> venture.
                  Direct API calls outside authorized department boundaries are automatically rejected by the server with HTTP 403 Forbidden.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
