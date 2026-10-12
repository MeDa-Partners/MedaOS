'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Team, Department, Venture, EmployeeResponseItem, ApiError } from '@/lib/api';
import {
  Network,
  Plus,
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
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  // Sheets
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
      (t.headUser?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.headUserName || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <AppShell
      icon={<Network className="w-3.5 h-3.5" />}
      title="Teams Directory"
      description="Operational teams structured within departments"
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
          {(isAdmin || isDepartmentHead) && (
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Team</span>
            </Button>
          )}
        </>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">

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
          searchPlaceholder="Search teams, department, venture, head..."
          count={filteredTeams.length}
          totalCount={teams.length}
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

        {/* Teams Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs font-mono">Loading teams directory...</span>
          </div>
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No teams found"
            description={
              search || selectedVentureFilter || selectedDepartmentFilter
                ? 'No teams match your search or selected filters.'
                : 'Create your first team to start assigning operational personnel.'
            }
            action={
              (isAdmin || isDepartmentHead)
                ? {
                    label: 'Create Team',
                    onClick: () => setIsCreateOpen(true),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team) => {
              const headName = team.headUser?.name || team.headUserName;
              const headEmail = team.headUser?.email || team.headUserEmail;
              const isDeptHeadOfThis =
                isDepartmentHead &&
                departments.some(
                  (d) => d.id === team.departmentId && d.headUserId === user?.id
                );
              const canManage = isAdmin || isDeptHeadOfThis;

              return (
                <Card key={team.id} hoverable className="flex flex-col justify-between">
                  <div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle>{team.name}</CardTitle>
                          <span className="text-[11px] font-mono text-[#71717a] block">
                            /{team.slug}
                          </span>
                        </div>
                        <Badge
                          variant={team.status === 'active' ? 'success' : 'secondary'}
                          dot={team.status === 'active'}
                        >
                          {team.status}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Venture */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#a1a1aa]" /> Venture
                        </span>
                        <span className="font-medium text-[#09090b]">{team.ventureName}</span>
                      </div>

                      {/* Department */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717a] flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-[#a1a1aa]" /> Department
                        </span>
                        <span className="font-medium text-[#09090b]">{team.departmentName}</span>
                      </div>

                      {/* Team Head */}
                      <div className="pt-2 border-t border-[#f4f4f5]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-[#71717a] uppercase font-mono tracking-wider flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-500" /> Team Head
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignHeadTeam(team);
                                setSelectedHeadUserId(team.headUserId || team.headUser?.id || '');
                              }}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                            >
                              {headName ? 'Replace' : 'Assign'}
                            </button>
                          )}
                        </div>

                        {headName ? (
                          <div className="p-2 bg-[#fafafa] border border-[#e4e4e7] rounded-lg flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-[#09090b] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {headName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-[#09090b] truncate">
                                {headName}
                              </div>
                              {headEmail && (
                                <div className="text-[10px] text-[#71717a] truncate font-mono">
                                  {headEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 bg-[#fafafa] border border-dashed border-[#e4e4e7] rounded-lg text-center text-xs text-[#a1a1aa] italic">
                            No head appointed
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter>
                    <div className="flex items-center gap-1.5 text-xs text-[#71717a]">
                      <Users2 className="w-3.5 h-3.5" />
                      <span className="font-semibold text-[#09090b]">{team.memberCount || 0}</span>
                      <span className="text-[11px]">members</span>
                    </div>

                    {canManage && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingTeam(team);
                          setEditForm({
                            name: team.name,
                            slug: team.slug,
                            headUserId: team.headUserId || team.headUser?.id || '',
                            status: team.status || 'active',
                          });
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Team Sheet */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent side="right">
          <form onSubmit={handleCreateSubmit} className="flex flex-col h-full">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                  <Network className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle>Create Team</SheetTitle>
                  <SheetDescription>
                    Configure a new operational team within an active venture department.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
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
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                >
                  <option value="">Select a Venture...</option>
                  {ventures.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Department *
                </label>
                <select
                  required
                  value={createForm.departmentId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, departmentId: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                >
                  <option value="">Select a Department...</option>
                  {createFormDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.ventureName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Team Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Inbound Sales, Dispatch, Calling"
                  value={createForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCreateForm((prev) => ({
                      ...prev,
                      name,
                      slug: toSlug(name),
                    }));
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Slug (URL identifier)
                </label>
                <Input
                  placeholder="e.g. inbound-sales"
                  value={createForm.slug}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      slug: toSlug(e.target.value),
                    }))
                  }
                  className="font-mono"
                />
              </div>

              <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-xs text-[#71717a] flex items-start gap-2.5">
                <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Team Heads are designated from active team members after creating the team and assigning employees.
                </span>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={actionLoading}
              >
                Create Team
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Team Sheet */}
      <Sheet open={Boolean(editingTeam)} onOpenChange={(open) => !open && setEditingTeam(null)}>
        <SheetContent side="right">
          {editingTeam && (
            <form onSubmit={handleEditSubmit} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Edit Team: {editingTeam.name}</SheetTitle>
                    <SheetDescription>
                      Update team metadata and lifecycle status.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Team Name *
                  </label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Slug
                  </label>
                  <Input
                    value={editForm.slug}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))
                    }
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
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
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingTeam(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={actionLoading}
                >
                  Save Changes
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Appoint / Replace Team Head Sheet */}
      <Sheet
        open={Boolean(assignHeadTeam)}
        onOpenChange={(open) => !open && setAssignHeadTeam(null)}
      >
        <SheetContent side="right">
          {assignHeadTeam && (
            <form onSubmit={handleAssignHeadSubmit} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Appoint Team Head</SheetTitle>
                    <SheetDescription>
                      Designate an active member to lead{' '}
                      <strong className="text-[#09090b]">{assignHeadTeam.name}</strong>.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                {/* Current Head Status */}
                <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-xs space-y-1">
                  <span className="text-[11px] text-[#71717a] uppercase font-mono block">
                    Current Head Status
                  </span>
                  <div className="font-medium text-[#09090b] flex items-center gap-1.5">
                    {assignHeadTeam.headUser?.name || assignHeadTeam.headUserName ? (
                      <>
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                        <span>{assignHeadTeam.headUser?.name || assignHeadTeam.headUserName}</span>
                        <span className="text-[#71717a] font-normal">
                          ({assignHeadTeam.headUser?.email || assignHeadTeam.headUserEmail})
                        </span>
                      </>
                    ) : (
                      <span className="text-[#a1a1aa] italic">Currently unappointed</span>
                    )}
                  </div>
                </div>

                {(() => {
                  const currentHeadId =
                    assignHeadTeam.headUserId || assignHeadTeam.headUser?.id;
                  const eligibleEmployees = employees.filter(
                    (emp) =>
                      emp.status === 'active' &&
                      (emp.ventures.some((v) => v.teamId === assignHeadTeam.id) ||
                        (currentHeadId && emp.id === currentHeadId))
                  );

                  return (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-[#18181b]">
                        Designate Head of Team
                      </label>
                      {eligibleEmployees.length === 0 ? (
                        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs leading-relaxed">
                          No active employees are currently assigned to this team. Please assign employees to this team first in{' '}
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
                    </div>
                  );
                })()}
              </SheetBody>

              <SheetFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAssignHeadTeam(null)}
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
