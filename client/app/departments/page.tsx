'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Department, Venture, EmployeeResponseItem, ApiError } from '@/lib/api';
import {
  Building2,
  FolderTree,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Layers,
  Network,
  Crown,
  Terminal,
  ExternalLink,
  Users2,
} from 'lucide-react';
import Link from 'next/link';

export default function DepartmentsPage() {
  const { user, isAdmin, refreshUser } = useAuth();

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

  // Department Head Modal (Operational leadership appointment allowed for Global Admin)
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
      (d.headUser?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e4e7]">
          <div>
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-[#18181b]" />
              <h1 className="text-xl font-bold text-[#09090b]">Departments Directory</h1>
            </div>
            <p className="text-xs text-[#71717a] mt-1">
              Organizational divisions within ventures. Global Administrators can appoint and reassign Department Heads.
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
              href="/teams"
              className="px-3.5 py-2 bg-[#09090b] hover:bg-[#27272a] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Network className="w-4 h-4" />
              <span>Configure Teams</span>
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
                Department Structure & Catalog Boundary
              </span>
              <p className="text-[#71717a] mt-0.5">
                Creating, modifying metadata, or deleting departments belongs exclusively to <span className="font-medium text-[#09090b]">Dev Admin</span>. Operational Department Head assignments and team configurations are managed here.
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

        {/* Notifications */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <div className="flex-1 font-medium">{successMessage}</div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#e4e4e7] shadow-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#a1a1aa]" />
            <input
              type="text"
              placeholder="Search departments, venture, head..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#09090b]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedVentureFilter}
              onChange={(e) => setSelectedVentureFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b]"
            >
              <option value="">All Ventures</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Department Grid / List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Loading departments...</span>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="py-16 text-center bg-white border border-[#e4e4e7] rounded-xl p-8 shadow-xs">
            <FolderTree className="w-10 h-10 text-[#a1a1aa] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-[#09090b]">No departments found</h3>
            <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">
              Departments are registered through Dev Admin at <span className="font-mono">/dev</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept) => {
              return (
                <div
                  key={dept.id}
                  className="bg-white border border-[#e4e4e7] rounded-xl p-5 shadow-2xs hover:border-[#d4d4d8] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#09090b]">{dept.name}</h3>
                        <span className="text-[11px] font-mono text-[#71717a]">slug: {dept.slug}</span>
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          dept.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        }`}
                      >
                        {dept.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#52525b] pt-1 border-t border-[#f0f0f2]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#a1a1aa] flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" /> Venture:
                        </span>
                        <span className="font-medium text-[#18181b]">{dept.ventureName}</span>
                      </div>

                      {(() => {
                        const head =
                          dept.headUser ||
                          (dept.headUserId && dept.headUserName
                            ? {
                                id: dept.headUserId,
                                name: dept.headUserName,
                                email: dept.headUserEmail || '',
                              }
                            : null);

                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-[#a1a1aa] flex items-center gap-1">
                              <Crown className="w-3.5 h-3.5 text-amber-500" /> Dept Head:
                            </span>
                            <span className="font-medium text-[#18181b]">
                              {head ? (
                                <span className="flex items-center gap-1">
                                  {head.name}
                                </span>
                              ) : (
                                <span className="text-[#a1a1aa] italic">Unassigned</span>
                              )}
                            </span>
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#f0f0f2] text-center">
                        <div className="p-2 bg-[#fafafa] rounded-lg border border-[#e4e4e7]">
                          <div className="text-[10px] text-[#a1a1aa] uppercase font-mono">Teams</div>
                          <div className="text-base font-bold text-[#09090b]">{dept.teamCount}</div>
                        </div>
                        <div className="p-2 bg-[#fafafa] rounded-lg border border-[#e4e4e7]">
                          <div className="text-[10px] text-[#a1a1aa] uppercase font-mono">Sections</div>
                          <div className="text-base font-bold text-[#09090b]">{dept.sectionCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-xs">
                    <Link
                      href={`/teams?departmentId=${dept.id}`}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Network className="w-3 h-3" />
                      <span>View Teams</span>
                    </Link>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setSelectedHeadUserId(dept.headUserId || '');
                          setAssignHeadDept(dept);
                        }}
                        className="px-2.5 py-1 text-[11px] bg-[#fafafa] hover:bg-[#f4f4f5] text-[#09090b] border border-[#e4e4e7] rounded-md transition-colors flex items-center gap-1 font-medium"
                      >
                        <Crown className="w-3 h-3 text-amber-600" />
                        <span>{dept.headUserId ? 'Reassign Head' : 'Appoint Head'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign / Replace Head Modal */}
      {assignHeadDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">
                Appoint Department Head
              </h3>
              <button
                onClick={() => setAssignHeadDept(null)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignHeadSubmit} className="space-y-4 pt-4">
              <p className="text-xs text-[#71717a]">
                Select an existing user to designate as the Department Head of{' '}
                <span className="font-semibold text-[#09090b]">{assignHeadDept.name}</span>.
              </p>

              {/* Current Head Banner */}
              <div className="p-2.5 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg text-xs flex items-center justify-between">
                <span className="text-[#71717a]">Current Head:</span>
                <span className="font-medium text-[#09090b]">
                  {assignHeadDept.headUser?.name || assignHeadDept.headUserName ? (
                    <span className="flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      {assignHeadDept.headUser?.name || assignHeadDept.headUserName}
                    </span>
                  ) : (
                    <span className="text-[#a1a1aa] italic">Unassigned</span>
                  )}
                </span>
              </div>

              {(() => {
                const currentHeadId = assignHeadDept.headUserId || assignHeadDept.headUser?.id;
                const eligibleEmployees = employees.filter(
                  (emp) =>
                    emp.status === 'active' &&
                    (emp.ventures.some((v) => v.departmentId === assignHeadDept.id) ||
                      (currentHeadId && emp.id === currentHeadId))
                );
                return (
                  <div>
                    <label className="block text-xs font-medium text-[#18181b] mb-1">
                      Designated Head
                    </label>
                    {eligibleEmployees.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs">
                        No active employees are currently assigned to this department. Please assign employees to this department first before appointing a head.
                      </div>
                    ) : (
                      <select
                        value={selectedHeadUserId}
                        onChange={(e) => setSelectedHeadUserId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#09090b]"
                      >
                        <option value="">None (Remove current head)</option>
                        {eligibleEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setAssignHeadDept(null)}
                  className="px-3 py-1.5 text-xs text-[#71717a] hover:bg-[#f4f4f5] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 bg-[#09090b] hover:bg-[#27272a] text-white text-xs font-medium rounded-md shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Confirm Appointment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
