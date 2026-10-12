'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { api, Venture, ApiError } from '@/lib/api';
import { isVentureSupported } from '@/lib/feature-registry';
import {
  Building2,
  FolderTree,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Users2,
  Terminal,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar } from '@/components/ui/filter-bar';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function VenturesPage() {

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
        {/* Page Header */}
        <PageHeader
          icon={<Building2 className="w-4 h-4" />}
          title="Ventures Directory"
          description="Active portfolio companies, business units, and venture brands operating under MeDa Partners OS."
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={reloadData}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
              <Link href="/employees">
                <Button size="sm">
                  <Users2 className="w-3.5 h-3.5" />
                  <span>Assign Employees</span>
                </Button>
              </Link>
            </>
          }
        />

        {/* Catalog Boundary Banner */}
        <div className="p-4 bg-white border border-[#e4e4e7] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-semibold text-[#09090b] flex items-center gap-1.5">
                Venture Catalog Authority
              </span>
              <p className="text-[#71717a] mt-0.5">
                Registering new ventures, editing metadata, or removing portfolio companies belongs exclusively to{' '}
                <strong className="text-[#09090b] font-medium">Dev Admin</strong>. Operational access assignments are managed in Employee Management.
              </p>
            </div>
          </div>

          <Link
            href="/dev"
            className="px-3 py-1.5 bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg text-xs font-medium text-[#09090b] transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>Open Dev Admin (/dev)</span>
            <ExternalLink className="w-3 h-3 text-[#71717a]" />
          </Link>
        </div>

        {/* Notification */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Filter Bar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search ventures by name or slug..."
          count={filteredVentures.length}
          totalCount={ventures.length}
          hasActiveFilters={Boolean(search)}
          onClearFilters={() => setSearch('')}
        />

        {/* Ventures Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717a]">
            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs font-mono">Loading ventures directory...</span>
          </div>
        ) : filteredVentures.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No ventures found"
            description={
              search
                ? 'No ventures match your active search keyword.'
                : 'Ventures are registered through Dev Admin at /dev.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVentures.map((v) => {
              const supported = isVentureSupported(v.slug);

              return (
                <Card key={v.id} hoverable className="flex flex-col justify-between">
                  <div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle>{v.name}</CardTitle>
                          <span className="text-[11px] font-mono text-[#71717a] block">
                            /{v.slug}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {supported ? (
                            <Badge variant="success">Template</Badge>
                          ) : (
                            <Badge variant="secondary">Catalog</Badge>
                          )}
                          <Badge
                            variant={v.status === 'active' ? 'venture' : 'secondary'}
                            dot={v.status === 'active'}
                          >
                            {v.status || 'active'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-[#a1a1aa]" /> Departments
                        </span>
                        <span className="font-semibold text-[#09090b]">
                          {v.departmentCount ?? 0}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <Users2 className="w-3.5 h-3.5 text-[#a1a1aa]" /> Personnel
                        </span>
                        <span className="font-semibold text-[#09090b]">
                          {v.employeeCount ?? 'Managed'}
                        </span>
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter>
                    <Link
                      href={`/${v.slug}`}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <span>Venture Hub</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <Link
                      href={`/departments?ventureId=${v.id}`}
                      className="text-[11px] font-medium text-[#71717a] hover:text-[#09090b] flex items-center gap-1 transition-colors"
                    >
                      <FolderTree className="w-3.5 h-3.5" />
                      <span>View Departments</span>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
