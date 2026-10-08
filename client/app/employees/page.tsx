'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import {
  api,
  EmployeeResponseItem,
  Venture,
  Team,
  ApiError,
} from '@/lib/api';
import {
  UserPlus,
  Search,
  KeyRound,
  UserX,
  UserCheck,
  Users,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Sliders,
  Building2,
  Trash2,
  Plus,
} from 'lucide-react';

export default function EmployeesPage() {
  const {
    user,
    activeVenture,
    activeTeam,
    isAdmin,
    ventures: userVentures,
  } = useAuth();

  const [employees, setEmployees] = useState<EmployeeResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVentureFilter, setSelectedVentureFilter] = useState<string>('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Available ventures & teams for dropdowns
  const [availableVentures, setAvailableVentures] = useState<Venture[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [managingUser, setManagingUser] = useState<EmployeeResponseItem | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<EmployeeResponseItem | null>(null);

  // Unified Manage Access Modal state
  const [activeVentureTab, setActiveVentureTab] = useState<string>('');
  const [confirmingRemoveVentureId, setConfirmingRemoveVentureId] = useState<string | null>(null);
  const [editMembershipTeamId, setEditMembershipTeamId] = useState<string>('');
  const [editMembershipSectionIds, setEditMembershipSectionIds] = useState<string[]>([]);
  const [newVentureForm, setNewVentureForm] = useState({
    ventureId: '',
    teamId: '',
    sectionIds: [] as string[],
  });

  // Create Modal form state
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    ventureId: '',
    teamId: '',
    sectionIds: [] as string[],
  });

  const [newPassword, setNewPassword] = useState('');

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load dropdown resources
  useEffect(() => {
    let isMounted = true;

    async function loadDropdowns() {
      try {
        const [vList, tList] = await Promise.all([
          api.ventures.list(),
          api.teams.list(),
        ]);
        if (isMounted) {
          if (isAdmin) {
            setAvailableVentures(vList);
            setAvailableTeams(tList);
          } else {
            const allowedVIds = new Set(userVentures.map((m) => m.venture.id));
            setAvailableVentures(vList.filter((v) => allowedVIds.has(v.id)));
            setAvailableTeams(tList.filter((t) => allowedVIds.has(t.ventureId)));
          }
        }
      } catch {
        // Background fetch error
      }
    }

    loadDropdowns();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, userVentures, activeVenture]);

  const reloadEmployees = useCallback(() => {
    setLoading(true);
    setRefreshCount((c) => c + 1);
  }, []);

  // Fetch employees list
  useEffect(() => {
    let isMounted = true;

    async function fetchList() {
      try {
        const params: { search?: string; ventureId?: string; teamId?: string } = {};
        if (search.trim()) params.search = search.trim();
        if (selectedVentureFilter) params.ventureId = selectedVentureFilter;
        if (selectedTeamFilter) params.teamId = selectedTeamFilter;

        const data = await api.employees.list(params);
        if (isMounted) {
          setEmployees(data.users);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to fetch employees');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchList();

    return () => {
      isMounted = false;
    };
  }, [search, selectedVentureFilter, selectedTeamFilter, refreshCount]);

  // Handle Create Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    try {
      const targetVentureId = createForm.ventureId || activeVenture?.id;
      const targetTeamId = createForm.teamId || activeTeam?.id;

      await api.employees.create({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        ventureId: targetVentureId,
        teamId: targetTeamId,
        sectionIds: createForm.sectionIds,
      });

      setSuccessMessage(`Employee "${createForm.name}" created successfully`);
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        ventureId: '',
        teamId: '',
        sectionIds: [],
      });
      reloadEmployees();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create employee');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async (emp: EmployeeResponseItem) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    setActionLoading(true);
    setError(null);

    try {
      await api.employees.updateStatus(emp.id, newStatus);
      setSuccessMessage(`Employee status updated to ${newStatus}`);
      reloadEmployees();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update status');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Open Unified Manage Access Modal
  const openManageModal = (emp: EmployeeResponseItem, preferredVentureId?: string) => {
    setManagingUser(emp);
    setConfirmingRemoveVentureId(null);

    let initialTab = '';
    if (preferredVentureId === 'new') {
      initialTab = 'new';
    } else if (preferredVentureId && emp.ventures.some((v) => v.ventureId === preferredVentureId)) {
      initialTab = preferredVentureId;
    } else if (emp.ventures.length > 0) {
      initialTab = emp.ventures[0].ventureId;
    } else {
      initialTab = 'new';
    }

    setActiveVentureTab(initialTab);

    if (initialTab !== 'new') {
      const mem = emp.ventures.find((v) => v.ventureId === initialTab);
      setEditMembershipTeamId(mem?.teamId || '');
      setEditMembershipSectionIds(mem?.sections.map((s) => s.id) || []);
    } else {
      const assignedIds = new Set(emp.ventures.map((v) => v.ventureId));
      const firstUnassigned = availableVentures.find((v) => !assignedIds.has(v.id));
      const firstTeam = availableTeams.find((t) => t.ventureId === firstUnassigned?.id);
      setNewVentureForm({
        ventureId: firstUnassigned?.id || '',
        teamId: firstTeam?.id || '',
        sectionIds: [],
      });
    }
  };

  const selectVentureTab = (vId: string) => {
    setActiveVentureTab(vId);
    setConfirmingRemoveVentureId(null);

    if (vId !== 'new' && managingUser) {
      const mem = managingUser.ventures.find((v) => v.ventureId === vId);
      setEditMembershipTeamId(mem?.teamId || '');
      setEditMembershipSectionIds(mem?.sections.map((s) => s.id) || []);
    } else if (managingUser) {
      const assignedIds = new Set(managingUser.ventures.map((v) => v.ventureId));
      const firstUnassigned = availableVentures.find((v) => !assignedIds.has(v.id));
      const firstTeam = availableTeams.find((t) => t.ventureId === firstUnassigned?.id);
      setNewVentureForm({
        ventureId: firstUnassigned?.id || '',
        teamId: firstTeam?.id || '',
        sectionIds: [],
      });
    }
  };

  // Handle Save Team Assignment in modal
  const handleSaveTeamInModal = async () => {
    if (!managingUser || !activeVentureTab) return;
    setActionLoading(true);
    setError(null);

    try {
      const updated = await api.employees.assignTeam(managingUser.id, {
        ventureId: activeVentureTab,
        teamId: editMembershipTeamId,
      });

      setManagingUser(updated);
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      const vName =
        updated.ventures.find((v) => v.ventureId === activeVentureTab)?.ventureName || 'venture';
      setSuccessMessage(`Updated team in ${vName} for ${updated.name}`);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to update team assignment');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Section Permissions in modal
  const handleSaveSectionsInModal = async () => {
    if (!managingUser || !activeVentureTab) return;
    setActionLoading(true);
    setError(null);

    try {
      const updated = await api.employees.assignSections(managingUser.id, {
        ventureId: activeVentureTab,
        sectionIds: editMembershipSectionIds,
      });

      setManagingUser(updated);
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      const vName =
        updated.ventures.find((v) => v.ventureId === activeVentureTab)?.ventureName || 'venture';
      setSuccessMessage(`Updated section access in ${vName} for ${updated.name}`);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to update section access');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save All Changes (both Team and Section Permissions) for the active venture
  const handleSaveAllVentureChanges = async () => {
    if (!managingUser || !activeVentureTab) return;
    const currentMem = managingUser.ventures.find((v) => v.ventureId === activeVentureTab);
    if (!currentMem) return;

    const teamChanged = editMembershipTeamId !== currentMem.teamId;
    const currentSectionSet = new Set(currentMem.sections.map((s) => s.id));
    const newSectionSet = new Set(editMembershipSectionIds);
    const sectionsChanged =
      currentSectionSet.size !== newSectionSet.size ||
      [...currentSectionSet].some((id) => !newSectionSet.has(id));

    if (!teamChanged && !sectionsChanged) return;

    setActionLoading(true);
    setError(null);

    try {
      let updated = managingUser;

      if (teamChanged) {
        updated = await api.employees.assignTeam(managingUser.id, {
          ventureId: activeVentureTab,
          teamId: editMembershipTeamId,
        });
      }

      if (sectionsChanged) {
        updated = await api.employees.assignSections(managingUser.id, {
          ventureId: activeVentureTab,
          sectionIds: editMembershipSectionIds,
        });
      }

      setManagingUser(updated);
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      const vName =
        updated.ventures.find((v) => v.ventureId === activeVentureTab)?.ventureName || 'venture';
      setSuccessMessage(`Successfully updated ${vName} team and access permissions for ${updated.name}`);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to save venture settings');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Remove Venture Assignment from User
  const handleRemoveVentureFromUser = async (ventureId: string) => {
    if (!managingUser) return;
    setActionLoading(true);
    setError(null);

    try {
      const updated = await api.employees.removeVenture(managingUser.id, ventureId);
      const removedVentureName =
        managingUser.ventures.find((v) => v.ventureId === ventureId)?.ventureName || 'venture';

      setManagingUser(updated);
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSuccessMessage(`Removed ${managingUser.name} from ${removedVentureName}`);
      setConfirmingRemoveVentureId(null);

      if (updated.ventures.length > 0) {
        selectVentureTab(updated.ventures[0].ventureId);
      } else {
        selectVentureTab('new');
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove from venture');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Assign to New Venture in modal
  const handleAssignNewVentureInModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingUser || !newVentureForm.ventureId || !newVentureForm.teamId) return;

    setActionLoading(true);
    setError(null);

    try {
      let updated = await api.employees.assignTeam(managingUser.id, {
        ventureId: newVentureForm.ventureId,
        teamId: newVentureForm.teamId,
      });

      if (newVentureForm.sectionIds.length > 0) {
        updated = await api.employees.assignSections(managingUser.id, {
          ventureId: newVentureForm.ventureId,
          sectionIds: newVentureForm.sectionIds,
        });
      }

      setManagingUser(updated);
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      const vName =
        updated.ventures.find((v) => v.ventureId === newVentureForm.ventureId)?.ventureName || 'venture';
      setSuccessMessage(`Assigned ${updated.name} to ${vName} successfully`);
      selectVentureTab(newVentureForm.ventureId);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign venture');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.employees.resetPassword(resetPasswordUser.id, newPassword);
      setSuccessMessage(`Password reset successfully for ${resetPasswordUser.name}`);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to reset password');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Sections enabled for the venture selected in create form
  const selectedCreateVentureId =
    createForm.ventureId || activeVenture?.id || availableVentures[0]?.id || '';
  const currentCreateVenture = availableVentures.find((v) => v.id === selectedCreateVentureId);
  const createVentureSections = currentCreateVenture?.sections || [];

  return (
    <AppShell
      requireEmployeeManagement={true}
      title="Employee Management"
      description="Manage personnel records, organizational team assignments, and section access within your scope."
    >
      <div className="space-y-6">
        {/* Scope Context Banner */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-center text-[#18181b] shrink-0">
              <Users className="w-5 h-5 text-[#09090b]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#09090b]">
                  {isAdmin ? 'System-Wide Employee Directory' : `${activeVenture?.name || 'Venture'} Directory`}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isAdmin
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isAdmin ? 'Full Authority' : `Scoped: ${activeTeam?.name || 'Team'}`}
                </span>
              </div>
              <p className="text-xs text-[#71717a] mt-0.5">
                {isAdmin
                  ? 'As an Administrator, you can view, create, and manage employee records across all ventures.'
                  : `You have Employee Management access for ${activeTeam?.name || 'your'} team in ${activeVenture?.name || 'this venture'}.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const defaultVId = activeVenture?.id || availableVentures[0]?.id || '';
              const defaultTeam = availableTeams.find((t) => t.ventureId === defaultVId);
              setCreateForm({
                name: '',
                email: '',
                password: '',
                ventureId: defaultVId,
                teamId: activeTeam?.ventureId === defaultVId ? activeTeam.id : defaultTeam?.id || '',
                sectionIds: [],
              });
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && availableVentures.length > 0 && (
              <select
                value={selectedVentureFilter}
                onChange={(e) => setSelectedVentureFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden text-[#18181b]"
              >
                <option value="">All Ventures</option>
                {availableVentures.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}

            {availableTeams.length > 0 && (
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden text-[#18181b]"
              >
                <option value="">All Teams</option>
                {availableTeams
                  .filter((t) => !selectedVentureFilter || t.ventureId === selectedVentureFilter)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            )}

            <button
              type="button"
              onClick={reloadEmployees}
              className="p-2 text-[#71717a] hover:text-[#09090b] hover:bg-white border border-transparent hover:border-[#e4e4e7] rounded-lg transition-all"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafafa] border-b border-[#e4e4e7] text-[#71717a] font-medium">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Venture Memberships</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f2]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#71717a]">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#09090b]" />
                        <span>Loading directory records...</span>
                      </div>
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#71717a]">
                      No employee records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[#fafafa] transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] flex items-center justify-center font-semibold text-[11px] text-[#18181b] shrink-0">
                            {emp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-medium text-[#09090b]">
                              <span>{emp.name}</span>
                              {emp.isAdmin && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-sm border border-blue-200 font-mono">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#71717a] font-mono">
                              {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Venture Memberships */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {emp.ventures.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => openManageModal(emp, 'new')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-600 hover:text-black bg-zinc-50 hover:bg-zinc-100 border border-dashed border-zinc-300 transition-all cursor-pointer"
                              title="Click to assign to a venture"
                            >
                              <Plus className="w-3 h-3 text-zinc-500" />
                              <span>Assign to Venture</span>
                            </button>
                          ) : (
                            <>
                              {emp.ventures.map((m) => (
                                <button
                                  key={m.ventureId}
                                  type="button"
                                  onClick={() => openManageModal(emp, m.ventureId)}
                                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#fafafa] hover:bg-white text-[11px] border border-[#e4e4e7] hover:border-[#a1a1aa] transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer"
                                  title={`Click to manage ${m.ventureName} team and access or remove`}
                                >
                                  <Building2 className="w-3 h-3 text-[#71717a] group-hover:text-black" />
                                  <span className="font-semibold text-[#18181b]">
                                    {m.ventureName}:
                                  </span>
                                  <span className="bg-[#f4f4f5] text-[#52525b] px-1.5 py-0.2 rounded-xs border border-[#e4e4e7] text-[10px]">
                                    {m.teamName}
                                  </span>
                                  <span className="text-[#a1a1aa] text-[10px]">
                                    ({m.sections.length} {m.sections.length === 1 ? 'sec' : 'secs'})
                                  </span>
                                </button>
                              ))}

                              {/* Quick + Add Venture button if employee isn't in all ventures */}
                              {availableVentures.some(
                                (v) => !emp.ventures.some((m) => m.ventureId === v.id)
                              ) && (
                                <button
                                  type="button"
                                  onClick={() => openManageModal(emp, 'new')}
                                  className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] text-[#71717a] hover:text-black hover:bg-zinc-100 border border-transparent hover:border-zinc-300 transition-all cursor-pointer"
                                  title="Assign another venture"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            emp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              emp.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'
                            }`}
                          />
                          {emp.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openManageModal(emp)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-[#09090b] hover:bg-black text-white rounded-md transition-all flex items-center gap-1.5 shadow-2xs"
                            title="Manage venture teams, sections, and remove from ventures"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Access & Teams</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setResetPasswordUser(emp)}
                            className="p-1 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] rounded-md transition-colors"
                            title="Reset password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {emp.id !== user?.id && !emp.isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(emp)}
                              className="p-1 text-[#71717a] hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title={emp.status === 'active' ? 'Deactivate user' : 'Activate user'}
                            >
                              {emp.status === 'active' ? (
                                <UserX className="w-3.5 h-3.5 text-red-500" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE EMPLOYEE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-md w-full p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-sm font-semibold text-[#09090b]">Add New Employee</h3>
                <p className="text-xs text-[#71717a]">
                  Create employee credentials and assign initial venture/team.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-[#71717a] hover:text-[#09090b] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul@meda.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black"
                />
              </div>

              {/* Venture & Team selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#18181b] mb-1">
                    Venture
                  </label>
                  <select
                    value={createForm.ventureId || activeVenture?.id || ''}
                    disabled={!isAdmin && availableVentures.length <= 1}
                    onChange={(e) => {
                      const newVId = e.target.value;
                      const newVenture = availableVentures.find((v) => v.id === newVId);
                      const validSecIds = new Set(newVenture?.sections?.map((s) => s.id) || []);
                      const defaultTeamForV = availableTeams.find((t) => t.ventureId === newVId);
                      setCreateForm({
                        ...createForm,
                        ventureId: newVId,
                        teamId: defaultTeamForV?.id || '',
                        sectionIds: createForm.sectionIds.filter((id) => validSecIds.has(id)),
                      });
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden disabled:bg-[#fafafa]"
                  >
                    {availableVentures.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181b] mb-1">
                    Team
                  </label>
                  <select
                    value={createForm.teamId || activeTeam?.id || ''}
                    disabled={!isAdmin}
                    onChange={(e) => setCreateForm({ ...createForm, teamId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden disabled:bg-[#fafafa]"
                  >
                    {isAdmin ? (
                      availableTeams
                        .filter((t) => t.ventureId === (createForm.ventureId || activeVenture?.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))
                    ) : (
                      <option value={activeTeam?.id}>{activeTeam?.name}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Initial Sections Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Initial Section Access
                  </label>
                  <span className="text-[10px] text-[#71717a]">
                    {currentCreateVenture ? `Enabled for ${currentCreateVenture.name}` : ''}
                  </span>
                </div>
                <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-lg max-h-36 overflow-y-auto space-y-2">
                  {createVentureSections.length === 0 ? (
                    <div className="text-xs text-[#71717a] py-2 text-center">
                      No sections are currently enabled for this venture.
                    </div>
                  ) : (
                    createVentureSections
                      .filter((s) => isAdmin || s.slug !== 'employees')
                      .map((s) => (
                        <label key={s.id} className="flex items-center justify-between text-xs text-[#18181b] cursor-pointer hover:bg-white p-1 rounded transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={createForm.sectionIds.includes(s.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreateForm({
                                    ...createForm,
                                    sectionIds: [...createForm.sectionIds, s.id],
                                  });
                                } else {
                                  setCreateForm({
                                    ...createForm,
                                    sectionIds: createForm.sectionIds.filter((id) => id !== s.id),
                                  });
                                }
                              }}
                              className="rounded-xs border-[#e4e4e7] text-black focus:ring-black"
                            />
                            <span className="capitalize font-medium">{s.name}</span>
                          </div>
                          <span className="text-[10px] text-[#71717a] font-mono">{s.route}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#52525b] hover:bg-[#f4f4f5] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIFIED MANAGE ACCESS & VENTURES MODAL */}
      {managingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-xl w-full p-6 shadow-xl animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#f0f0f2] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-center text-[#18181b] shrink-0 font-semibold text-sm">
                  {managingUser.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#09090b]">
                      {managingUser.name}
                    </h3>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        managingUser.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {managingUser.status}
                    </span>
                    {managingUser.isAdmin && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#71717a] font-mono mt-0.5">
                    {managingUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManagingUser(null);
                  setConfirmingRemoveVentureId(null);
                }}
                className="p-1.5 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Venture Tabs */}
            <div className="pt-3 pb-2 border-b border-[#f0f0f2] shrink-0 flex items-center gap-1.5 overflow-x-auto">
              {managingUser.ventures.map((m) => {
                const isActive = activeVentureTab === m.ventureId;
                return (
                  <button
                    key={m.ventureId}
                    type="button"
                    onClick={() => selectVentureTab(m.ventureId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 shrink-0 ${
                      isActive
                        ? 'bg-[#09090b] text-white shadow-xs'
                        : 'bg-[#fafafa] text-[#52525b] hover:bg-[#f4f4f5] border border-[#e4e4e7]'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{m.ventureName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-xs font-normal ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#e4e4e7] text-[#3f3f46]'
                      }`}
                    >
                      {m.teamName}
                    </span>
                  </button>
                );
              })}

              {/* Show "+ Assign Venture" tab if there are unassigned ventures */}
              {availableVentures.some(
                (v) => !managingUser.ventures.some((m) => m.ventureId === v.id)
              ) && (
                <button
                  type="button"
                  onClick={() => selectVentureTab('new')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                    activeVentureTab === 'new'
                      ? 'bg-[#09090b] text-white shadow-xs'
                      : 'bg-[#fafafa] text-[#52525b] hover:bg-[#f4f4f5] border border-dashed border-[#d4d4d8]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Venture</span>
                </button>
              )}
            </div>

            {/* Modal Body: Active Tab Content */}
            <div className="py-4 overflow-y-auto flex-1 space-y-4">
              {/* TAB CASE 1: Managing an Existing Venture */}
              {activeVentureTab !== 'new' && (
                (() => {
                  const currentMem = managingUser.ventures.find(
                    (v) => v.ventureId === activeVentureTab
                  );
                  if (!currentMem) {
                    return (
                      <div className="text-center py-8 text-xs text-[#71717a]">
                        Select a venture tab above to manage access.
                      </div>
                    );
                  }
                  const currentVentureData = availableVentures.find(
                    (v) => v.id === activeVentureTab
                  );
                  const ventureTeams = availableTeams.filter(
                    (t) => t.ventureId === activeVentureTab
                  );
                  const ventureSections = currentVentureData?.sections || [];

                  return (
                    <div className="space-y-4">
                      {/* Venture Header with Danger/Remove Action */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-zinc-50 border border-[#e4e4e7] rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white border border-[#e4e4e7] flex items-center justify-center text-zinc-900 shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-[#09090b] block">
                              {currentMem.ventureName}
                            </span>
                            <span className="text-[11px] text-[#71717a]">
                              Current team: <strong className="text-zinc-900">{currentMem.teamName}</strong> • {currentMem.sections.length} active {currentMem.sections.length === 1 ? 'section' : 'sections'}
                            </span>
                          </div>
                        </div>

                        {/* Remove from Venture action */}
                        {confirmingRemoveVentureId === activeVentureTab ? (
                          <div className="flex items-center gap-2 p-1.5 bg-red-50 border border-red-200 rounded-lg text-xs">
                            <span className="text-red-700 text-[11px] font-medium">Remove from {currentMem.ventureName}?</span>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleRemoveVentureFromUser(activeVentureTab)}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-medium transition-colors"
                            >
                              Yes, Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingRemoveVentureId(null)}
                              className="px-2 py-0.5 text-zinc-600 hover:text-zinc-900 text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingRemoveVentureId(activeVentureTab)}
                            className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                            title={`Remove ${managingUser.name} from ${currentMem.ventureName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove from Venture</span>
                          </button>
                        )}
                      </div>

                      {/* 1. Team Assignment in this venture */}
                      <div className="p-4 bg-white border border-[#e4e4e7] rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-xs font-semibold text-[#09090b]">
                              Team Assignment
                            </label>
                            <p className="text-[11px] text-[#71717a]">
                              Determines which department this employee belongs to in {currentMem.ventureName}.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <select
                            value={editMembershipTeamId}
                            disabled={!isAdmin}
                            onChange={(e) => setEditMembershipTeamId(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden disabled:bg-[#f4f4f5]"
                          >
                            {ventureTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          {isAdmin && (
                            <button
                              type="button"
                              disabled={actionLoading || editMembershipTeamId === currentMem.teamId}
                              onClick={handleSaveTeamInModal}
                              className="px-3 py-1.5 text-xs font-medium bg-[#09090b] text-white hover:bg-black disabled:opacity-40 rounded-lg transition-all flex items-center gap-1.5 shrink-0"
                            >
                              {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>Save Team</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 2. Section Access Permissions in this venture */}
                      <div className="p-4 bg-white border border-[#e4e4e7] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-xs font-semibold text-[#09090b]">
                              Section Access Permissions
                            </label>
                            <p className="text-[11px] text-[#71717a]">
                              Available workspaces enabled for {currentMem.ventureName}.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = ventureSections
                                  .filter((s) => isAdmin || s.slug !== 'employees')
                                  .map((s) => s.id);
                                setEditMembershipSectionIds(allIds);
                              }}
                              className="text-[11px] text-[#09090b] hover:underline"
                            >
                              Select All
                            </button>
                            <span className="text-[#d4d4d8]">|</span>
                            <button
                              type="button"
                              onClick={() => setEditMembershipSectionIds([])}
                              className="text-[11px] text-[#71717a] hover:text-[#09090b] hover:underline"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="p-2.5 bg-[#fafafa] border border-[#e4e4e7] rounded-lg max-h-48 overflow-y-auto space-y-1.5">
                          {ventureSections.length === 0 ? (
                            <div className="text-xs text-[#71717a] py-3 text-center">
                              No sections are currently enabled for this venture.
                            </div>
                          ) : (
                            ventureSections
                              .filter((s) => isAdmin || s.slug !== 'employees')
                              .map((s) => (
                                <label
                                  key={s.id}
                                  className="flex items-center justify-between text-xs text-[#18181b] cursor-pointer hover:bg-white p-1.5 rounded transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editMembershipSectionIds.includes(s.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setEditMembershipSectionIds([
                                            ...editMembershipSectionIds,
                                            s.id,
                                          ]);
                                        } else {
                                          setEditMembershipSectionIds(
                                            editMembershipSectionIds.filter((id) => id !== s.id)
                                          );
                                        }
                                      }}
                                      className="rounded-xs border-[#e4e4e7] text-black focus:ring-black"
                                    />
                                    <span className="capitalize font-medium">{s.name}</span>
                                  </div>
                                  <span className="text-[10px] text-[#71717a] font-mono">
                                    {s.route}
                                  </span>
                                </label>
                              ))
                          )}
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleSaveSectionsInModal}
                            className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white hover:bg-black rounded-lg transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>Save Section Access</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* TAB CASE 2: Assign to a New Venture */}
              {activeVentureTab === 'new' && (
                (() => {
                  const assignedIds = new Set(managingUser.ventures.map((v) => v.ventureId));
                  const unassignedVentures = availableVentures.filter(
                    (v) => !assignedIds.has(v.id)
                  );

                  if (unassignedVentures.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs text-[#71717a] bg-[#fafafa] border border-[#e4e4e7] rounded-xl">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <span className="font-semibold text-zinc-900 block text-sm">
                          Assigned to all active ventures
                        </span>
                        <p className="mt-1">
                          {managingUser.name} already belongs to all ventures registered in the system.
                        </p>
                      </div>
                    );
                  }

                  const selectedNewV = unassignedVentures.find(
                    (v) => v.id === newVentureForm.ventureId
                  );
                  const newVTeams = availableTeams.filter(
                    (t) => t.ventureId === newVentureForm.ventureId
                  );
                  const newVSecs = selectedNewV?.sections || [];

                  return (
                    <form onSubmit={handleAssignNewVentureInModal} className="space-y-4">
                      <div className="p-3 bg-zinc-50 border border-[#e4e4e7] rounded-xl text-xs text-zinc-600">
                        Assign <strong>{managingUser.name}</strong> to an additional venture, specify their team, and grant initial permissions.
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#18181b] mb-1">
                            Venture
                          </label>
                          <select
                            required
                            value={newVentureForm.ventureId}
                            onChange={(e) => {
                              const newVId = e.target.value;
                              const firstTeam = availableTeams.find((t) => t.ventureId === newVId);
                              setNewVentureForm({
                                ventureId: newVId,
                                teamId: firstTeam?.id || '',
                                sectionIds: [],
                              });
                            }}
                            className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden"
                          >
                            {unassignedVentures.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#18181b] mb-1">
                            Team
                          </label>
                          <select
                            required
                            value={newVentureForm.teamId}
                            onChange={(e) =>
                              setNewVentureForm({ ...newVentureForm, teamId: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden"
                          >
                            <option value="">Select Team</option>
                            {newVTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-[#18181b]">
                            Initial Section Access
                          </label>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = newVSecs
                                  .filter((s) => isAdmin || s.slug !== 'employees')
                                  .map((s) => s.id);
                                setNewVentureForm({ ...newVentureForm, sectionIds: allIds });
                              }}
                              className="text-[11px] text-[#09090b] hover:underline"
                            >
                              Select All
                            </button>
                            <span className="text-[#d4d4d8]">|</span>
                            <button
                              type="button"
                              onClick={() =>
                                setNewVentureForm({ ...newVentureForm, sectionIds: [] })
                              }
                              className="text-[11px] text-[#71717a] hover:text-[#09090b] hover:underline"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="p-2.5 bg-[#fafafa] border border-[#e4e4e7] rounded-lg max-h-40 overflow-y-auto space-y-1.5">
                          {newVSecs.length === 0 ? (
                            <div className="text-xs text-[#71717a] py-3 text-center">
                              No sections enabled for this venture.
                            </div>
                          ) : (
                            newVSecs
                              .filter((s) => isAdmin || s.slug !== 'employees')
                              .map((s) => (
                                <label
                                  key={s.id}
                                  className="flex items-center justify-between text-xs text-[#18181b] cursor-pointer hover:bg-white p-1.5 rounded transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={newVentureForm.sectionIds.includes(s.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setNewVentureForm({
                                            ...newVentureForm,
                                            sectionIds: [...newVentureForm.sectionIds, s.id],
                                          });
                                        } else {
                                          setNewVentureForm({
                                            ...newVentureForm,
                                            sectionIds: newVentureForm.sectionIds.filter(
                                              (id) => id !== s.id
                                            ),
                                          });
                                        }
                                      }}
                                      className="rounded-xs border-[#e4e4e7] text-black focus:ring-black"
                                    />
                                    <span className="capitalize font-medium">{s.name}</span>
                                  </div>
                                  <span className="text-[10px] text-[#71717a] font-mono">
                                    {s.route}
                                  </span>
                                </label>
                              ))
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end gap-2 border-t border-[#f0f0f2]">
                        <button
                          type="submit"
                          disabled={
                            actionLoading || !newVentureForm.ventureId || !newVentureForm.teamId
                          }
                          className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Assign Venture Membership</span>
                        </button>
                      </div>
                    </form>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#f0f0f2] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs">
                {activeVentureTab !== 'new' && managingUser && (() => {
                  const currentMem = managingUser.ventures.find((v) => v.ventureId === activeVentureTab);
                  if (!currentMem) return null;
                  const teamChanged = editMembershipTeamId !== currentMem.teamId;
                  const currentSecs = new Set(currentMem.sections.map((s) => s.id));
                  const newSecs = new Set(editMembershipSectionIds);
                  const secsChanged =
                    currentSecs.size !== newSecs.size ||
                    [...currentSecs].some((id) => !newSecs.has(id));
                  const hasUnsaved = teamChanged || secsChanged;

                  if (hasUnsaved) {
                    return (
                      <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Unsaved changes in {currentMem.ventureName}
                      </span>
                    );
                  }
                  return (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      All settings saved
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setManagingUser(null);
                    setConfirmingRemoveVentureId(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#52525b] hover:bg-[#f4f4f5] rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>

                {activeVentureTab !== 'new' && managingUser && (() => {
                  const currentMem = managingUser.ventures.find((v) => v.ventureId === activeVentureTab);
                  if (!currentMem) return null;
                  const teamChanged = editMembershipTeamId !== currentMem.teamId;
                  const currentSecs = new Set(currentMem.sections.map((s) => s.id));
                  const newSecs = new Set(editMembershipSectionIds);
                  const secsChanged =
                    currentSecs.size !== newSecs.size ||
                    [...currentSecs].some((id) => !newSecs.has(id));
                  const hasUnsaved = teamChanged || secsChanged;

                  return (
                    <button
                      type="button"
                      disabled={actionLoading || !hasUnsaved}
                      onClick={handleSaveAllVentureChanges}
                      className="px-4 py-1.5 text-xs font-medium bg-[#09090b] text-white hover:bg-black rounded-lg transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-40 cursor-pointer"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save All Changes</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-sm font-semibold text-[#09090b]">Reset Password</h3>
                <p className="text-xs text-[#71717a]">
                  For <strong className="text-[#09090b]">{resetPasswordUser.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="p-1 text-[#71717a] hover:text-[#09090b] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-3 py-1.5 text-xs text-[#52525b] hover:bg-[#f4f4f5] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || newPassword.length < 8}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Reset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
