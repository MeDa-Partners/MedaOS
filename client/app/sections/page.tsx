'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Section, Department, Venture, ApiError } from '@/lib/api';
import { isSectionImplemented } from '@/lib/feature-registry';
import {
  Layers,
  Search,
  AlertCircle,
  RefreshCw,
  Building2,
  FolderTree,
  ExternalLink,
  Users2,
  Terminal,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default function SectionsPage() {
  const { user, isAdmin, isDepartmentHead, refreshUser } = useAuth();

  const [sections, setSections] = useState<Section[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVentureFilter, setSelectedVentureFilter] = useState('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Notifications
  const [error, setError] = useState<string | null>(null);

  const reloadData = useCallback(() => {
    setLoading(true);
    setRefreshCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const [sList, dList, vList] = await Promise.all([
          api.sections.list({
            departmentId: selectedDepartmentFilter || undefined,
            ventureId: selectedVentureFilter || undefined,
          }),
          api.departments.list(selectedVentureFilter || undefined),
          api.ventures.list(),
        ]);

        if (isMounted) {
          setSections(sList);
          setDepartments(dList);
          setVentures(vList);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load sections catalog');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = true;
    };
  }, [selectedVentureFilter, selectedDepartmentFilter, refreshCount]);

  const filteredSections = sections.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase()) ||
      (s.departmentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.ventureName || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e4e7]">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#18181b]" />
              <h1 className="text-xl font-bold text-[#09090b]">Sections Directory</h1>
            </div>
            <p className="text-xs text-[#71717a] mt-1">
              Browse registered application sections and permission resources. Assign permissions to users via Employee Management.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={reloadData}
              disabled={loading}
              className="p-2 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/employees"
              className="px-3.5 py-2 bg-[#09090b] hover:bg-[#27272a] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Users2 className="w-4 h-4" />
              <span>Assign Section Permissions</span>
            </Link>
          </div>
        </div>

        {/* Dev Admin Responsibility Banner */}
        <div className="p-4 bg-[#fafafa] border border-[#e4e4e7] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-semibold text-[#09090b] flex items-center gap-1.5">
                Catalog Architecture Boundary
              </span>
              <p className="text-[#71717a] mt-0.5">
                Creating, updating, and removing application sections belongs exclusively to <span className="font-medium text-[#09090b]">Dev Admin</span>. Regular administrators manage employee access and section grants.
              </p>
            </div>
          </div>

          <Link
            href="/dev"
            className="px-3 py-1.5 bg-white hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg text-xs font-medium text-[#09090b] transition-colors shrink-0 flex items-center gap-1"
          >
            <span>Open Dev Admin (/dev)</span>
            <ExternalLink className="w-3 h-3 text-[#71717a]" />
          </Link>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-[#e4e4e7] rounded-xl shadow-2xs">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections by name, slug, department, or venture..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#09090b]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedVentureFilter}
              onChange={(e) => {
                setSelectedVentureFilter(e.target.value);
                setSelectedDepartmentFilter('');
              }}
              className="text-xs px-3 py-1.5 bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-[#18181b] focus:outline-hidden"
            >
              <option value="">All Ventures</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <select
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-[#18181b] focus:outline-hidden"
            >
              <option value="">All Departments</option>
              {departments
                .filter((d) => !selectedVentureFilter || d.ventureId === selectedVentureFilter)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.ventureName})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Sections Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#71717a]">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#09090b]" />
            <span>Loading sections directory...</span>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#71717a] bg-white border border-[#e4e4e7] rounded-xl">
            <span>No sections match your filter criteria.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSections.map((sec) => {
              const isImplemented = isSectionImplemented(sec.slug);

              return (
                <div
                  key={sec.id}
                  className="bg-white border border-[#e4e4e7] hover:border-[#d4d4d8] rounded-xl p-5 shadow-2xs transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#09090b]">{sec.name}</h3>
                        <span className="text-[11px] font-mono text-[#71717a]">/{sec.slug}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isImplemented ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Code Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Catalog Only
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            sec.status === 'active'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                          }`}
                        >
                          {sec.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-[#52525b] pt-1 border-t border-[#f0f0f2]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#a1a1aa] flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" /> Venture:
                        </span>
                        <span className="font-medium text-[#18181b]">{sec.ventureName || 'Venture'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#a1a1aa] flex items-center gap-1">
                          <FolderTree className="w-3.5 h-3.5" /> Department:
                        </span>
                        <span className="font-medium text-[#18181b]">{sec.departmentName || 'Department'}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[#a1a1aa]">Application Route:</span>
                        <span className="font-mono text-[11px] text-[#09090b] bg-[#f4f4f5] px-1.5 py-0.5 rounded">
                          {sec.route}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-xs">
                    <Link
                      href={sec.route}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>Open Live Workspace</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <Link
                      href={`/employees?sectionId=${sec.id}`}
                      className="text-[11px] font-medium text-[#71717a] hover:text-[#09090b] flex items-center gap-1"
                    >
                      <Users2 className="w-3.5 h-3.5" />
                      <span>Manage Access</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
