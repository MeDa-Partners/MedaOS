'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { api, Section, Department, Venture, ApiError } from '@/lib/api';
import { isSectionImplemented } from '@/lib/feature-registry';
import {
  Layers,
  AlertCircle,
  RefreshCw,
  Building2,
  FolderTree,
  ExternalLink,
  Users2,
} from 'lucide-react';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function SectionsPage() {

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
    <AppShell
      icon={<Layers className="w-3.5 h-3.5" />}
      title="Sections Directory"
      description="Browse registered functional sections and access boundaries"
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
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/employees">
            <Button size="sm">
              <Users2 className="w-3.5 h-3.5" />
              <span>Assign Section Permissions</span>
            </Button>
          </Link>
        </>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Error notification */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Unified Filter Toolbar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search sections by name, slug, department, or venture..."
          count={filteredSections.length}
          totalCount={sections.length}
          hasActiveFilters={Boolean(selectedVentureFilter || selectedDepartmentFilter || search)}
          onClearFilters={() => {
            setSearch('');
            setSelectedVentureFilter('');
            setSelectedDepartmentFilter('');
          }}
        >
          <FilterSelect
            icon={<Building2 className="w-3.5 h-3.5" />}
            value={selectedVentureFilter}
            onChange={(e) => {
              setSelectedVentureFilter(e.target.value);
              setSelectedDepartmentFilter('');
            }}
          >
            <option value="">All Ventures</option>
            {ventures.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            icon={<FolderTree className="w-3.5 h-3.5" />}
            value={selectedDepartmentFilter}
            onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments
              .filter((d) => !selectedVentureFilter || d.ventureId === selectedVentureFilter)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {selectedVentureFilter ? '' : `(${d.ventureName})`}
                </option>
              ))}
          </FilterSelect>
        </FilterBar>

        {/* Sections Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717a]">
            <RefreshCw className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs font-mono">Loading sections directory...</span>
          </div>
        ) : filteredSections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No sections found"
            description={
              search || selectedVentureFilter || selectedDepartmentFilter
                ? 'No sections match your search or filter options.'
                : 'No sections configured in this venture.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSections.map((sec) => {
              const isImplemented = isSectionImplemented(sec.slug);

              return (
                <Card key={sec.id} hoverable className="flex flex-col justify-between">
                  <div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle>{sec.name}</CardTitle>
                          <span className="text-[11px] font-mono text-[#71717a] block">
                            /{sec.slug}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isImplemented ? (
                            <Badge variant="success">Code Ready</Badge>
                          ) : (
                            <Badge variant="warning">Catalog Only</Badge>
                          )}
                          <Badge
                            variant={sec.status === 'active' ? 'venture' : 'secondary'}
                            dot={sec.status === 'active'}
                          >
                            {sec.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#a1a1aa]" /> Venture
                        </span>
                        <span className="font-semibold text-[#09090b]">
                          {sec.ventureName || 'Global'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-[#a1a1aa]" /> Department
                        </span>
                        <span className="font-semibold text-[#09090b]">
                          {sec.departmentName || 'General'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#f4f4f5]">
                        <span className="text-[#71717a]">Route</span>
                        <span className="font-mono text-[11px] text-[#09090b] bg-[#fafafa] border border-[#e4e4e7] px-2 py-0.5 rounded-md">
                          {sec.route}
                        </span>
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter>
                    <Link
                      href={sec.route}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <span>Open Live Route</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <Link
                      href={`/employees?sectionId=${sec.id}`}
                      className="text-[11px] font-medium text-[#71717a] hover:text-[#09090b] flex items-center gap-1 transition-colors"
                    >
                      <Users2 className="w-3.5 h-3.5" />
                      <span>Manage Access</span>
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
