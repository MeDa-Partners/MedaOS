'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Venture, ApiError } from '@/lib/api';
import { isVentureSupported } from '@/lib/feature-registry';
import {
  Building2,
  FolderTree,
  Search,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Users2,
  Terminal,
  ShieldCheck,
} from 'lucide-react';

export default function VenturesPage() {
  const { refreshUser } = useAuth();

  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Notifications
  const [error, setError] = useState<string | null>(null);

  const reloadData = useCallback(() => {
    setLoading(true);
    setRefreshCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchVenturesData() {
      try {
        const vList = await api.ventures.list();
        if (isMounted) {
          setVentures(vList);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load ventures directory');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchVenturesData();

    return () => {
      isMounted = false;
    };
  }, [refreshCount]);

  const filteredVentures = ventures.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e4e7]">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#18181b]" />
              <h1 className="text-xl font-bold text-[#09090b]">Ventures Directory</h1>
            </div>
            <p className="text-xs text-[#71717a] mt-1">
              Active venture companies and portfolio brands operating under MeDa Partners OS.
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
              <span>Assign Employees</span>
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
                Venture Catalog Authority
              </span>
              <p className="text-[#71717a] mt-0.5">
                Registering new ventures, editing metadata, or removing portfolio companies belongs exclusively to <span className="font-medium text-[#09090b]">Dev Admin</span>. Operational employee assignments are managed in Employee Management.
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

        {/* Notification */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a1a1aa]" />
          <input
            type="text"
            placeholder="Search ventures by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#09090b]"
          />
        </div>

        {/* Ventures Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#71717a]">
            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Loading ventures...</span>
          </div>
        ) : filteredVentures.length === 0 ? (
          <div className="py-16 text-center bg-white border border-[#e4e4e7] rounded-xl p-8 shadow-xs">
            <Building2 className="w-10 h-10 text-[#a1a1aa] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-[#09090b]">No ventures found</h3>
            <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">
              Ventures are registered through Dev Admin at <span className="font-mono">/dev</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVentures.map((v) => {
              const supported = isVentureSupported(v.slug);

              return (
                <div
                  key={v.id}
                  className="bg-white border border-[#e4e4e7] rounded-xl p-5 shadow-2xs hover:border-[#d4d4d8] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#09090b]">{v.name}</h3>
                        <span className="text-[11px] font-mono text-[#71717a]">/{v.slug}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {supported ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Template
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                            Catalog
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            v.status === 'active'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                          }`}
                        >
                          {v.status || 'active'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#52525b] pt-1 border-t border-[#f0f0f2]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#a1a1aa] flex items-center gap-1">
                          <FolderTree className="w-3.5 h-3.5" /> Departments:
                        </span>
                        <span className="font-medium text-[#18181b]">{v.departmentCount ?? 0}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[#a1a1aa] flex items-center gap-1">
                          <Users2 className="w-3.5 h-3.5" /> Assigned Personnel:
                        </span>
                        <span className="font-medium text-[#18181b]">
                          {(v as any).employeeCount ?? 'Managed'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-xs">
                    <Link
                      href={`/${v.slug}`}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>Venture Dashboard</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <Link
                      href={`/departments?ventureId=${v.id}`}
                      className="text-[11px] font-medium text-[#71717a] hover:text-[#09090b] flex items-center gap-1"
                    >
                      <FolderTree className="w-3.5 h-3.5" />
                      <span>View Departments</span>
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
