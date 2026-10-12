'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Team, Department, Venture, EmployeeResponseItem, ApiError } from '@/lib/api';
import {
  Network,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Building2,
  FolderTree,
  Crown,
  Edit2,
  Users2,
} from 'lucide-react';

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function TeamsPage() {
  const { user, isAdmin, isDepartmentHead, refreshUser } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVentureFilter, setSelectedVentureFilter] = useState('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [assignHeadTeam, setAssignHeadTeam] = useState<Team | null>(null);
  const [selectedHeadUserId, setSelectedHeadUserId] = useState('');

  // Create Form state
  const [createForm, setCreateForm] = useState({
    ventureId: '',
    departmentId: '',
    name: '',
    slug: '',
    headUserId: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Edit Form state
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    headUserId: '',
    status: 'active' as 'active' | 'inactive',
  });

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
        const [tList, dList, vList, uRes] = await Promise.all([
          api.teams.list({
            departmentId: selectedDepartmentFilter || undefined,
            ventureId: selectedVentureFilter || undefined,
          }),
          api.departments.list(selectedVentureFilter || undefined),
          api.ventures.list(),
          api.employees.list({ limit: 200 }),
        ]);

        if (isMounted) {
          setTeams(tList);
          setDepartments(dList);
          setVentures(vList);
          setEmployees(uRes.users);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load teams');
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
  }, [selectedVentureFilter, selectedDepartmentFilter, refreshCount]);

  // Handle Create Team
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.departmentId) {
      setError('Please select a department for the team');
      return;
    }
    if (!createForm.name.trim()) {
      setError('Team name is required');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await api.teams.create({
        departmentId: createForm.departmentId,
        name: createForm.name.trim(),
        slug: createForm.slug.trim() || undefined,
        headUserId: createForm.headUserId || null,
        status: createForm.status,
      });

      setSuccessMessage(`Team "${createForm.name}" created successfully.`);
      setIsCreateOpen(false);
      setCreateForm({
        ventureId: '',
        departmentId: '',
        name: '',
        slug: '',
        headUserId: '',
        status: 'active',
      });
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to create team');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Team
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    if (!editForm.name.trim()) {
      setError('Team name is required');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await api.teams.update(editingTeam.id, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || undefined,
        headUserId: editForm.headUserId || null,
        status: editForm.status,
      });

      setSuccessMessage(`Team "${editForm.name}" updated successfully.`);
      setEditingTeam(null);
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to update team');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Assign Team Head
  const handleAssignHeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignHeadTeam) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.teams.assignHead(assignHeadTeam.id, selectedHeadUserId || null);
      setSuccessMessage('Team Head updated successfully.');
      setAssignHeadTeam(null);
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to update Team Head');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter departments for create form based on selected venture
  const createFormDepartments = createForm.ventureId
    ? departments.filter((d) => d.ventureId === createForm.ventureId)
    : departments;

  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.departmentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.ventureName || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.headUser?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e4e7]">
          <div>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-[#18181b]" />
              <h1 className="text-xl font-bold text-[#09090b]">Teams</h1>
            </div>
            <p className="text-xs text-[#71717a] mt-1">
              Teams belong to specific departments within a venture. Each team has one designated Team Head.
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

            {(isAdmin || isDepartmentHead) && (
              <button
                onClick={() => {
                  setError(null);
                  setIsCreateOpen(true);
                }}
                className="px-3.5 py-2 bg-[#09090b] hover:bg-[#27272a] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Team</span>
              </button>
            )}
          </div>
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
              placeholder="Search teams, department, venture..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedVentureFilter}
              onChange={(e) => {
                setSelectedVentureFilter(e.target.value);
                setSelectedDepartmentFilter('');
              }}
              className="px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md text-[#09090b] focus:outline-none focus:ring-1 focus:ring-[#09090b]"
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
              className="px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md text-[#09090b] focus:outline-none focus:ring-1 focus:ring-[#09090b]"
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

        {/* Team Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Loading teams...</span>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="py-16 text-center bg-white border border-[#e4e4e7] rounded-xl p-8 shadow-xs">
            <Network className="w-10 h-10 text-[#a1a1aa] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-[#09090b]">No teams found</h3>
            <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">
              {search || selectedVentureFilter || selectedDepartmentFilter
                ? 'Try adjusting your filters or search term.'
                : 'Create your first team under a department to assign employees.'}
            </p>
            {(isAdmin || isDepartmentHead) && !search && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 px-3.5 py-2 bg-[#09090b] hover:bg-[#27272a] text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Team</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team) => {
              const isHeadOfTeam = team.headUserId === user?.id;
              const isDeptHeadOfThis = departments.some(
                (d) => d.id === team.departmentId && d.headUserId === user?.id
              );
              const canManage = isAdmin || isDeptHeadOfThis || isHeadOfTeam;

              return (
                <div
                  key={team.id}
                  className="bg-white border border-[#e4e4e7] rounded-xl p-5 shadow-xs hover:border-[#d4d4d8] transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Venture & Department Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#71717a] bg-[#f4f4f5] px-2 py-0.5 rounded-md border border-[#e4e4e7]">
                        <Building2 className="w-3 h-3 text-[#18181b]" />
                        <span className="truncate max-w-[100px]">{team.ventureName}</span>
                        <span className="text-[#a1a1aa]">/</span>
                        <FolderTree className="w-3 h-3 text-[#18181b]" />
                        <span className="truncate max-w-[100px] font-semibold text-[#09090b]">
                          {team.departmentName}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full capitalize ${
                          team.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        }`}
                      >
                        {team.status}
                      </span>
                    </div>

                    {/* Team Name & Slug */}
                    <h2 className="text-base font-semibold text-[#09090b]">{team.name}</h2>
                    <p className="text-[11px] font-mono text-[#71717a] mt-0.5">/{team.slug}</p>

                    {/* Team Head */}
                    {(() => {
                      const head =
                        team.headUser ||
                        (team.headUserId && team.headUserName
                          ? {
                              id: team.headUserId,
                              name: team.headUserName,
                              email: team.headUserEmail || '',
                            }
                          : null);

                      return (
                        <div className="mt-3.5 pt-3.5 border-t border-[#f0f0f2]">
                          <div className="text-[10px] uppercase font-mono tracking-wider text-[#a1a1aa] mb-1">
                            Team Head
                          </div>
                          {head ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#18181b] text-white text-[10px] font-semibold flex items-center justify-center">
                                  {head.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-[#09090b] flex items-center gap-1">
                                    {head.name}
                                    <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                  </div>
                                  <div className="text-[10px] text-[#71717a]">{head.email}</div>
                                </div>
                              </div>
                              {(isAdmin || isDeptHeadOfThis) && (
                                <button
                                  onClick={() => {
                                    setAssignHeadTeam(team);
                                    setSelectedHeadUserId(team.headUserId || '');
                                  }}
                                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  Replace
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[#a1a1aa] italic">No head appointed</span>
                              {(isAdmin || isDeptHeadOfThis) && (
                                <button
                                  onClick={() => {
                                    setAssignHeadTeam(team);
                                    setSelectedHeadUserId(team.headUserId || '');
                                  }}
                                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  Assign
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Metrics & Actions */}
                  <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-xs text-[#71717a]">
                    <div className="flex items-center gap-1.5" title="Members">
                      <Users2 className="w-3.5 h-3.5" />
                      <span className="font-medium text-[#09090b]">{team.memberCount || 0}</span>
                      <span className="text-[10px]">members</span>
                    </div>

                    {canManage && (
                      <button
                        onClick={() => {
                          setEditingTeam(team);
                          setEditForm({
                            name: team.name,
                            slug: team.slug,
                            headUserId: team.headUserId || '',
                            status: team.status || 'active',
                          });
                        }}
                        className="p-1.5 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] rounded-md transition-colors"
                        title="Edit Team"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-md w-full shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">Create Team</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Venture *
                </label>
                <select
                  required
                  value={createForm.ventureId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      ventureId: e.target.value,
                      departmentId: '',
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                >
                  <option value="">Select a Venture...</option>
                  {ventures.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Department *
                </label>
                <select
                  required
                  value={createForm.departmentId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, departmentId: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                >
                  <option value="">Select a Department...</option>
                  {createFormDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.ventureName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NBD, Order Verification, Calling"
                  value={createForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCreateForm((prev) => ({
                      ...prev,
                      name,
                      slug: toSlug(name),
                    }));
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g. nbd"
                  value={createForm.slug}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      slug: toSlug(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                />
              </div>

              <div className="bg-[#f4f4f5] border border-[#e4e4e7] rounded-md p-2.5 text-[11px] text-[#71717a] flex items-center gap-2">
                <Crown className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  Team Heads are designated from active team members after creating the team and assigning employees.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
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
                  <span>Create Team</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-md w-full shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">
                Edit Team: {editingTeam.name}
              </h3>
              <button
                onClick={() => setEditingTeam(null)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={editForm.slug}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Team Head
                </label>
                <select
                  value={editForm.headUserId}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, headUserId: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                >
                  <option value="">None</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      status: e.target.value as 'active' | 'inactive',
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
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
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appoint / Replace Head Modal */}
      {assignHeadTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">
                Appoint Team Head
              </h3>
              <button
                onClick={() => setAssignHeadTeam(null)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignHeadSubmit} className="space-y-4 pt-4">
              <p className="text-xs text-[#71717a]">
                Select an employee to designate as the Team Head of{' '}
                <span className="font-semibold text-[#09090b]">{assignHeadTeam.name}</span>.
              </p>

              {/* Current Head Banner */}
              <div className="p-2.5 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg text-xs flex items-center justify-between">
                <span className="text-[#71717a]">Current Head:</span>
                <span className="font-medium text-[#09090b]">
                  {assignHeadTeam.headUser?.name || assignHeadTeam.headUserName ? (
                    <span className="flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      {assignHeadTeam.headUser?.name || assignHeadTeam.headUserName}
                    </span>
                  ) : (
                    <span className="text-[#a1a1aa] italic">No head appointed</span>
                  )}
                </span>
              </div>

              {(() => {
                const currentHeadId = assignHeadTeam.headUserId || assignHeadTeam.headUser?.id;
                const eligibleEmployees = employees.filter(
                  (emp) =>
                    emp.status === 'active' &&
                    (emp.ventures.some((v) => v.teamId === assignHeadTeam.id) ||
                      (currentHeadId && emp.id === currentHeadId))
                );
                return (
                  <div>
                    <label className="block text-xs font-medium text-[#18181b] mb-1">
                      Designated Head
                    </label>
                    {eligibleEmployees.length === 0 ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-xs">
                        No active employees are currently assigned to this team. Please assign employees to this team first before appointing a head.
                      </div>
                    ) : (
                      <select
                        value={selectedHeadUserId}
                        onChange={(e) => setSelectedHeadUserId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
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
                  onClick={() => setAssignHeadTeam(null)}
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
