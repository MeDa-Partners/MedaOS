'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Department, Venture, EmployeeResponseItem, ApiError } from '@/lib/api';
import {
  FolderTree,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Building2,
  Crown,
  Terminal,
  ExternalLink,
  Network,
} from 'lucide-react';
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from '@/components/ui/sheet';

export default function DepartmentsPage() {
  const { isAdmin, refreshUser } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVentureFilter, setSelectedVentureFilter] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Department Head Sheet State
  const [assignHeadDept, setAssignHeadDept] = useState<Department | null>(null);
  const [selectedHeadUserId, setSelectedHeadUserId] = useState<string>('');

  // Auto-dismiss notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const reloadData = useCallback(() => {
    setLoading(true);
    setRefreshCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const [dList, vList, uRes] = await Promise.all([
          api.departments.list(selectedVentureFilter || undefined),
          api.ventures.list(),
          api.employees.list({ limit: 200 }),
        ]);

        if (isMounted) {
          setDepartments(dList);
          setVentures(vList);
          setEmployees(uRes.users);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load departments');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [selectedVentureFilter, refreshCount]);

  const handleAssignHeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignHeadDept) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.departments.assignHead(
        assignHeadDept.id,
        selectedHeadUserId || null
      );

      setSuccessMessage(
        `Department Head assignment for "${assignHeadDept.name}" updated successfully.`
      );
      setAssignHeadDept(null);
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to appoint Department Head');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDepartments = departments.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.slug.toLowerCase().includes(search.toLowerCase()) ||
      d.ventureName.toLowerCase().includes(search.toLowerCase()) ||
      (d.headUser?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.headUserName || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <AppShell
      icon={<FolderTree className="w-3.5 h-3.5" />}
      title="Departments Directory"
      description="Organizational divisions structured across ventures"
      badge={
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f4f4f5] text-[#71717a] border border-[#e4e4e7]">
          {departments.length}
        </span>
      }
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={reloadData}
            disabled={loading}
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/teams">
            <Button size="sm">
              <Network className="w-3.5 h-3.5" />
              <span>Configure Teams</span>
            </Button>
          </Link>
        </>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Boundary Notice Banner */}
        <div className="p-4 bg-white border border-[#e4e4e7] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-semibold text-[#09090b] flex items-center gap-1.5">
                Catalog Architecture Boundary
              </span>
              <p className="text-[#71717a] mt-0.5">
                Creating, modifying metadata, or deleting departments belongs exclusively to{' '}
                <strong className="text-[#09090b] font-medium">Dev Admin</strong>. Operational leadership assignments and team configurations are managed here.
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

        {/* Notifications */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <div className="flex-1 font-medium">{successMessage}</div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Unified Filter Bar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search departments, venture, head..."
          count={filteredDepartments.length}
          totalCount={departments.length}
          hasActiveFilters={Boolean(selectedVentureFilter || search)}
          onClearFilters={() => {
            setSearch('');
            setSelectedVentureFilter('');
          }}
        >
          <FilterSelect
            icon={<Building2 className="w-3.5 h-3.5" />}
            value={selectedVentureFilter}
            onChange={(e) => setSelectedVentureFilter(e.target.value)}
          >
            <option value="">All Ventures</option>
            {ventures.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </FilterSelect>
        </FilterBar>

        {/* Department Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs font-mono">Loading departments catalog...</span>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title="No departments found"
            description={
              search || selectedVentureFilter
                ? 'No departments match your active search or venture filter.'
                : 'Departments are registered through Dev Admin at /dev.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept) => {
              const headName = dept.headUser?.name || dept.headUserName;
              const headEmail = dept.headUser?.email || dept.headUserEmail;

              return (
                <Card key={dept.id} hoverable className="flex flex-col justify-between">
                  <div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle>{dept.name}</CardTitle>
                          <span className="text-[11px] font-mono text-[#71717a] block">
                            slug: {dept.slug}
                          </span>
                        </div>
                        <Badge
                          variant={dept.status === 'active' ? 'success' : 'secondary'}
                          dot={dept.status === 'active'}
                        >
                          {dept.status}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Venture */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#a1a1aa]" /> Venture
                        </span>
                        <span className="font-medium text-[#09090b]">{dept.ventureName}</span>
                      </div>

                      {/* Head */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" /> Department Head
                        </span>
                        <div className="text-right">
                          {headName ? (
                            <div>
                              <span className="font-medium text-[#09090b]">{headName}</span>
                              {headEmail && (
                                <span className="block text-[10px] font-mono text-[#71717a]">
                                  {headEmail}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#a1a1aa] italic font-normal">Unassigned</span>
                          )}
                        </div>
                      </div>

                      {/* Count Metrics Box */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#f4f4f5] text-center">
                        <div className="p-2.5 bg-[#fafafa] rounded-lg border border-[#e4e4e7]">
                          <div className="text-[10px] text-[#71717a] uppercase font-mono tracking-wider">
                            Teams
                          </div>
                          <div className="text-base font-bold text-[#09090b] mt-0.5">
                            {dept.teamCount}
                          </div>
                        </div>
                        <div className="p-2.5 bg-[#fafafa] rounded-lg border border-[#e4e4e7]">
                          <div className="text-[10px] text-[#71717a] uppercase font-mono tracking-wider">
                            Sections
                          </div>
                          <div className="text-base font-bold text-[#09090b] mt-0.5">
                            {dept.sectionCount}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter>
                    <Link
                      href={`/teams?departmentId=${dept.id}`}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <Network className="w-3 h-3" />
                      <span>View Teams</span>
                    </Link>

                    {isAdmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedHeadUserId(dept.headUserId || dept.headUser?.id || '');
                          setAssignHeadDept(dept);
                        }}
                      >
                        <Crown className="w-3 h-3 text-amber-500" />
                        <span>{headName ? 'Reassign Head' : 'Appoint Head'}</span>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Appoint / Reassign Department Head Sheet */}
      <Sheet
        open={Boolean(assignHeadDept)}
        onOpenChange={(open) => !open && setAssignHeadDept(null)}
      >
        <SheetContent side="right">
          {assignHeadDept && (
            <form onSubmit={handleAssignHeadSubmit} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Appoint Department Head</SheetTitle>
                    <SheetDescription>
                      Designate an operational head for{' '}
                      <strong className="text-[#09090b]">{assignHeadDept.name}</strong> ({assignHeadDept.ventureName}).
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                {/* Current Head Banner */}
                <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-xs space-y-1">
                  <span className="text-[11px] text-[#71717a] uppercase font-mono block">
                    Current Head Status
                  </span>
                  <div className="font-medium text-[#09090b] flex items-center gap-1.5">
                    {assignHeadDept.headUser?.name || assignHeadDept.headUserName ? (
                      <>
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                        <span>
                          {assignHeadDept.headUser?.name || assignHeadDept.headUserName}
                        </span>
                        <span className="text-[#71717a] font-normal">
                          ({assignHeadDept.headUser?.email || assignHeadDept.headUserEmail})
                        </span>
                      </>
                    ) : (
                      <span className="text-[#a1a1aa] italic">Currently unassigned</span>
                    )}
                  </div>
                </div>

                {(() => {
                  const currentHeadId =
                    assignHeadDept.headUserId || assignHeadDept.headUser?.id;
                  const eligibleEmployees = employees.filter(
                    (emp) =>
                      emp.status === 'active' &&
                      (emp.ventures.some((v) => v.departmentId === assignHeadDept.id) ||
                        (currentHeadId && emp.id === currentHeadId))
                  );

                  return (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-[#18181b]">
                        Designate Head of Department
                      </label>
                      {eligibleEmployees.length === 0 ? (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs leading-relaxed">
                          No active employees are currently assigned to this department. Please assign employees to this department first in{' '}
                          <Link href="/employees" className="underline font-semibold">
                            Employees Management
                          </Link>{' '}
                          before appointing a head.
                        </div>
                      ) : (
                        <select
                          value={selectedHeadUserId}
                          onChange={(e) => setSelectedHeadUserId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                        >
                          <option value="">None (Remove / Vacate current head)</option>
                          {eligibleEmployees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({emp.email})
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-[11px] text-[#71717a] leading-relaxed">
                        Department Heads automatically receive permissions to view and oversee employee venture access in their department.
                      </p>
                    </div>
                  );
                })()}
              </SheetBody>

              <SheetFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAssignHeadDept(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={actionLoading}
                >
                  Confirm Appointment
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
