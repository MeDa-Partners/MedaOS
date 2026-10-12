'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Venture, Department, Team, Section, ApiError, setActiveVentureHeader } from '@/lib/api';
import {
  Building2,
  FolderTree,
  Network,
  Layers,
  ArrowRight,
  Loader2,
  Crown,
} from 'lucide-react';

interface VenturePageProps {
  params: Promise<{
    ventureSlug: string;
  }>;
}

export default function VentureDashboardPage({ params }: VenturePageProps) {
  const resolvedParams = use(params);
  const { ventureSlug } = resolvedParams;

  const { setActiveVentureId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [venture, setVenture] = useState<Venture | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadVentureData() {
      setLoading(true);
      setError(null);
      try {
        const vList = await api.ventures.list();
        const matched = vList.find((v) => v.slug === ventureSlug);

        if (!matched) {
          setError(`Venture "${ventureSlug}" not found`);
          setLoading(false);
          return;
        }

        if (isMounted) {
          setVenture(matched);
          setActiveVentureHeader(matched.id);
          setActiveVentureId(matched.id);

          const [dList, tList, sList] = await Promise.all([
            api.departments.list(matched.id),
            api.teams.list({ ventureId: matched.id }),
            api.sections.list({ ventureId: matched.id }),
          ]);

          if (isMounted) {
            setDepartments(dList);
            setTeams(tList);
            setSections(sList);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load venture dashboard');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadVentureData();

    return () => {
      isMounted = false;
    };
  }, [ventureSlug, setActiveVentureId]);

  const formatTitle = (slug: string) =>
    slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const ventureName = venture?.name || formatTitle(ventureSlug);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#71717a]">
          <Link href="/" className="hover:text-[#09090b]">
            Overview
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#09090b] flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>{ventureName}</span>
          </span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-7 h-7 animate-spin text-[#09090b] mb-2" />
            <span className="text-xs">Loading {ventureName} dashboard...</span>
          </div>
        ) : error ? (
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-md mx-auto shadow-xs my-10">
            <h3 className="text-sm font-bold text-[#09090b]">Unable to load venture</h3>
            <p className="text-xs text-[#71717a] mt-1">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block px-4 py-2 bg-[#09090b] text-white text-xs font-medium rounded-lg"
            >
              Return to Overview
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Venture Header */}
            <div className="bg-white border border-[#e4e4e7] rounded-xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#09090b] text-white font-bold text-sm flex items-center justify-center shadow-xs">
                  {ventureName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-[#09090b]">{ventureName}</h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                      {venture?.status || 'active'}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717a] mt-0.5 font-mono">
                    /{ventureSlug} • MeDa Partners Operating Venture
                  </p>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="flex items-center gap-4 text-xs text-[#71717a]">
                <div className="flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-[#18181b]" />
                  <span className="font-semibold text-[#09090b]">{departments.length}</span>
                  <span>departments</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-[#18181b]" />
                  <span className="font-semibold text-[#09090b]">{teams.length}</span>
                  <span>teams</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#18181b]" />
                  <span className="font-semibold text-[#09090b]">{sections.length}</span>
                  <span>sections</span>
                </div>
              </div>
            </div>

            {/* Departments Hierarchy & Section Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#09090b] uppercase font-mono tracking-wider">
                  Departments & Workflows
                </h2>
              </div>

              {departments.length === 0 ? (
                <div className="p-8 text-center bg-white border border-[#e4e4e7] rounded-xl text-xs text-[#71717a]">
                  No departments created under this venture yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {departments.map((dept) => {
                    const deptSections = sections.filter((s) => s.departmentId === dept.id);
                    const deptTeams = teams.filter((t) => t.departmentId === dept.id);

                    return (
                      <div
                        key={dept.id}
                        className="bg-white border border-[#e4e4e7] rounded-xl p-5 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          {/* Department Title & Head */}
                          <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
                            <div className="flex items-center gap-2">
                              <FolderTree className="w-4 h-4 text-[#18181b]" />
                              <h3 className="text-sm font-bold text-[#09090b]">{dept.name}</h3>
                            </div>
                            {dept.headUser && (
                              <div className="flex items-center gap-1 text-[11px] text-[#71717a]">
                                <Crown className="w-3 h-3 text-amber-500" />
                                <span className="font-medium text-[#09090b]">
                                  {dept.headUser.name}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Teams under this department */}
                          <div className="mt-3">
                            <div className="text-[10px] font-mono uppercase text-[#a1a1aa] tracking-wider mb-1.5">
                              Teams ({deptTeams.length})
                            </div>
                            {deptTeams.length === 0 ? (
                              <span className="text-[11px] text-[#a1a1aa] italic">
                                No teams created yet
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {deptTeams.map((t) => (
                                  <span
                                    key={t.id}
                                    className="text-[11px] px-2 py-0.5 bg-[#fafafa] border border-[#e4e4e7] rounded-md text-[#18181b] flex items-center gap-1"
                                  >
                                    <Network className="w-3 h-3 text-[#71717a]" />
                                    <span>{t.name}</span>
                                    {t.headUserName && (
                                      <span title={`Head: ${t.headUserName}`}>
                                        <Crown className="w-2.5 h-2.5 text-blue-500" />
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Operational Sections */}
                          <div className="mt-4">
                            <div className="text-[10px] font-mono uppercase text-[#a1a1aa] tracking-wider mb-2">
                              Operational Sections ({deptSections.length})
                            </div>
                            {deptSections.length === 0 ? (
                              <span className="text-[11px] text-[#a1a1aa] italic">
                                No sections enabled
                              </span>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {deptSections.map((sec) => (
                                  <Link
                                    key={sec.id}
                                    href={`/${ventureSlug}/${sec.slug}`}
                                    className="p-2.5 bg-[#fafafa] hover:bg-white border border-[#e4e4e7] hover:border-[#09090b] rounded-lg transition-all group flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <Layers className="w-3.5 h-3.5 text-[#71717a] group-hover:text-[#09090b]" />
                                      <span className="font-medium text-[#09090b] truncate">
                                        {sec.name}
                                      </span>
                                    </div>
                                    <ArrowRight className="w-3.5 h-3.5 text-[#a1a1aa] group-hover:text-[#09090b] transition-transform group-hover:translate-x-0.5 shrink-0" />
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
