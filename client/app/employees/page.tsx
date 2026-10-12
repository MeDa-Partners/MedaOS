'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import {
  api,
  EmployeeResponseItem,
  Venture,
  Department,
  Team,
  Section,
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
  Pencil,
  Crown,
  FolderTree,
  Network,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export default function EmployeesPage() {
  const { isAdmin, departmentsLed, refreshUser, allVentures, allSections } = useAuth();

  const [employees, setEmployees] = useState<EmployeeResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVentureFilter, setSelectedVentureFilter] = useState('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Dropdown resources
  const [availableVentures, setAvailableVentures] = useState<Venture[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<Department[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [managingUser, setManagingUser] = useState<EmployeeResponseItem | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<EmployeeResponseItem | null>(null);
  const [editingUser, setEditingUser] = useState<EmployeeResponseItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [newPassword, setNewPassword] = useState('');

  // Create Modal Form state
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    ventureId: '',
    departmentId: '',
    teamId: '',
    sectionIds: [] as string[],
    status: 'active' as 'active' | 'inactive',
  });

  // Manage Membership Form state
  const [membershipForm, setMembershipForm] = useState({
    ventureId: '',
    departmentId: '',
    teamId: '',
    sectionIds: [] as string[],
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

  const [dropdownRefreshKey, setDropdownRefreshKey] = useState(0);

  const reloadDropdowns = useCallback(() => {
    setDropdownRefreshKey((k) => k + 1);
  }, []);

  // Preload dropdown catalogs with resilient individual fetching and auth-context fallbacks
  useEffect(() => {
    let isMounted = true;

    async function fetchDropdownCatalogs() {
      try {
        const [vRes, dRes, tRes, sRes] = await Promise.allSettled([
          allVentures && allVentures.length > 0 ? Promise.resolve(allVentures) : api.ventures.list(),
          api.departments.list(),
          api.teams.list(),
          allSections && allSections.length > 0 ? Promise.resolve(allSections) : api.sections.list(),
        ]);

        if (!isMounted) return;

        if (vRes.status === 'fulfilled' && Array.isArray(vRes.value) && vRes.value.length > 0) {
          setAvailableVentures(vRes.value);
        } else if (allVentures && allVentures.length > 0) {
          setAvailableVentures(allVentures);
        }

        if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) {
          setAvailableDepartments(dRes.value);
        }

        if (tRes.status === 'fulfilled' && Array.isArray(tRes.value)) {
          setAvailableTeams(tRes.value);
        }

        if (sRes.status === 'fulfilled' && Array.isArray(sRes.value)) {
          setAvailableSections(sRes.value);
        } else if (allSections && allSections.length > 0) {
          setAvailableSections(allSections);
        }
      } catch {
        if (isMounted && allVentures && allVentures.length > 0) {
          setAvailableVentures(allVentures);
        }
      }
    }

    fetchDropdownCatalogs();

    return () => {
      isMounted = false;
    };
  }, [dropdownRefreshKey, allVentures, allSections]);

  // Fetch employee list (Strictly ordered: first created on top)
  useEffect(() => {
    let isMounted = true;

    async function fetchEmployees() {
      try {
        const res = await api.employees.list({
          search: search || undefined,
          ventureId: selectedVentureFilter || undefined,
          departmentId: selectedDepartmentFilter || undefined,
          teamId: selectedTeamFilter || undefined,
          limit: 100,
        });

        if (isMounted) {
          setEmployees(res.users);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load employees');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchEmployees();

    return () => {
      isMounted = false;
    };
  }, [search, selectedVentureFilter, selectedDepartmentFilter, selectedTeamFilter, refreshCount]);

  // Handle Create User Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      setError('Name, email, and password are required');
      return;
    }

    if (createForm.ventureId && (!createForm.departmentId || !createForm.teamId)) {
      setError('If assigning a venture, both department and team must be selected');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await api.employees.create({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        ventureId: createForm.ventureId || undefined,
        departmentId: createForm.departmentId || undefined,
        teamId: createForm.teamId || undefined,
        sectionIds: createForm.sectionIds,
        status: createForm.status,
      });

      setSuccessMessage(`Employee "${createForm.name}" created successfully.`);
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        ventureId: '',
        departmentId: '',
        teamId: '',
        sectionIds: [],
        status: 'active',
      });
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to create employee');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit User Details
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.employees.update(editingUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
      });

      setSuccessMessage(`Employee details updated successfully.`);
      setEditingUser(null);
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to update employee');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async (employee: EmployeeResponseItem) => {
    const nextStatus = employee.status === 'active' ? 'inactive' : 'active';
    setActionLoading(true);
    try {
      await api.employees.updateStatus(employee.id, nextStatus);
      setSuccessMessage(`Employee status updated to ${nextStatus}.`);
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to change status');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.employees.resetPassword(resetPasswordUser.id, newPassword);
      setSuccessMessage(`Password reset successfully for ${resetPasswordUser.name}.`);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Assign Membership Submit
  const handleMembershipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingUser) return;
    if (!membershipForm.ventureId || !membershipForm.departmentId || !membershipForm.teamId) {
      setError('Venture, Department, and Team are all required for membership');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      // 1. Assign membership (Venture + Dept + Team)
      await api.employees.assignMembership(managingUser.id, {
        ventureId: membershipForm.ventureId,
        departmentId: membershipForm.departmentId,
        teamId: membershipForm.teamId,
      });

      // 2. Assign sections for this venture
      await api.employees.assignSections(managingUser.id, {
        ventureId: membershipForm.ventureId,
        sectionIds: membershipForm.sectionIds,
      });

      setSuccessMessage(`Organizational membership and section access updated for ${managingUser.name}.`);
      setManagingUser(null);
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign membership');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Remove Membership from a Venture
  const handleRemoveMembership = async (ventureId: string) => {
    if (!managingUser) return;
    if (!confirm('Are you sure you want to remove this employee from this venture?')) return;

    setActionLoading(true);
    try {
      await api.employees.removeMembership(managingUser.id, ventureId);
      setSuccessMessage(`Removed from venture successfully.`);
      setManagingUser(null);
      reloadData();
      refreshUser();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove from venture');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter departments & teams for form cascading selects
  const createDepts = createForm.ventureId
    ? availableDepartments.filter((d) => d.ventureId === createForm.ventureId)
    : availableDepartments;

  const createTeams = createForm.departmentId
    ? availableTeams.filter((t) => t.departmentId === createForm.departmentId)
    : [];

  const createSections = createForm.departmentId
    ? availableSections.filter((s) => s.departmentId === createForm.departmentId)
    : [];

  const manageDepts = membershipForm.ventureId
    ? availableDepartments.filter((d) => d.ventureId === membershipForm.ventureId)
    : availableDepartments;

  const manageTeams = membershipForm.departmentId
    ? availableTeams.filter((t) => t.departmentId === membershipForm.departmentId)
    : [];

  const manageSections = membershipForm.departmentId
    ? availableSections.filter((s) => s.departmentId === membershipForm.departmentId)
    : [];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e4e7]">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#18181b]" />
              <h1 className="text-xl font-bold text-[#09090b]">Employee Management</h1>
            </div>
            <p className="text-xs text-[#71717a] mt-1">
              Manage accounts, venture assignments, departments, teams, and section-level access.
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

            <button
              onClick={() => {
                setError(null);
                // Pre-fill department if user is a department head
                let prefillVenture = '';
                let prefillDept = '';
                if (!isAdmin && departmentsLed.length > 0) {
                  const myDept = availableDepartments.find((d) => d.id === departmentsLed[0]);
                  if (myDept) {
                    prefillVenture = myDept.ventureId;
                    prefillDept = myDept.id;
                  }
                }
                setCreateForm({
                  name: '',
                  email: '',
                  password: '',
                  ventureId: prefillVenture,
                  departmentId: prefillDept,
                  teamId: '',
                  sectionIds: [],
                  status: 'active',
                });
                setIsCreateOpen(true);
              }}
              className="px-3.5 py-2 bg-[#09090b] hover:bg-[#27272a] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
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
              placeholder="Search by name, email..."
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
                setSelectedTeamFilter('');
              }}
              className="px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md text-[#09090b] focus:outline-none focus:ring-1 focus:ring-[#09090b]"
            >
              <option value="">All Ventures</option>
              {availableVentures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <select
              value={selectedDepartmentFilter}
              onChange={(e) => {
                setSelectedDepartmentFilter(e.target.value);
                setSelectedTeamFilter('');
              }}
              className="px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md text-[#09090b] focus:outline-none focus:ring-1 focus:ring-[#09090b]"
            >
              <option value="">All Departments</option>
              {availableDepartments
                .filter((d) => !selectedVentureFilter || d.ventureId === selectedVentureFilter)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.ventureName})
                  </option>
                ))}
            </select>

            <select
              value={selectedTeamFilter}
              onChange={(e) => setSelectedTeamFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md text-[#09090b] focus:outline-none focus:ring-1 focus:ring-[#09090b]"
            >
              <option value="">All Teams</option>
              {availableTeams
                .filter(
                  (t) =>
                    !selectedDepartmentFilter || t.departmentId === selectedDepartmentFilter
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Employee List Table */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs">Loading employees...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-16 text-center bg-white border border-[#e4e4e7] rounded-xl p-8 shadow-xs">
            <Users className="w-10 h-10 text-[#a1a1aa] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-[#09090b]">No employees found</h3>
            <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">
              {search || selectedVentureFilter || selectedDepartmentFilter || selectedTeamFilter
                ? 'Try adjusting your search filters.'
                : 'Create your first employee account to grant organizational access.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#e4e4e7] rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e4e4e7] bg-[#fafafa] text-[#71717a] font-mono uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Organizational Memberships</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f2]">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[#fafafa] transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#18181b] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                            {emp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-[#09090b] flex items-center gap-1.5">
                              <span>{emp.name}</span>
                              {emp.isAdmin && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-mono">
                                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                                  Global Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#71717a]">{emp.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono capitalize ${
                            emp.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>

                      {/* Memberships: Venture -> Department -> Team -> Sections */}
                      <td className="py-3.5 px-4 align-top">
                        {emp.isAdmin ? (
                          <div className="text-[11px] text-[#71717a] italic">
                            System-wide Global Administrator (Access across all ventures)
                          </div>
                        ) : emp.ventures.length === 0 ? (
                          <span className="text-[11px] text-[#a1a1aa] italic">
                            No ventures assigned
                          </span>
                        ) : (
                          <div className="space-y-2 max-w-md">
                            {emp.ventures.map((v) => (
                              <div
                                key={v.ventureId}
                                className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg p-2.5 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2 font-medium text-[#09090b]">
                                  <div className="flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3 text-[#71717a]" />
                                    <span>{v.ventureName}</span>
                                  </div>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#52525b]">
                                  <span className="flex items-center gap-1">
                                    <FolderTree className="w-3 h-3 text-[#71717a]" />
                                    <span className="font-medium text-[#09090b]">{v.departmentName}</span>
                                    {v.isDepartmentHead && (
                                      <span title="Department Head">
                                        <Crown className="w-3 h-3 text-amber-500 inline" />
                                      </span>
                                    )}
                                  </span>

                                  <span className="text-[#d4d4d8]">•</span>

                                  <span className="flex items-center gap-1">
                                    <Network className="w-3 h-3 text-[#71717a]" />
                                    <span>{v.teamName}</span>
                                    {v.isTeamHead && (
                                      <span title="Team Head">
                                        <Crown className="w-3 h-3 text-blue-500 inline" />
                                      </span>
                                    )}
                                  </span>
                                </div>

                                {/* Assigned Sections */}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {v.sections.length === 0 ? (
                                    <span className="text-[10px] text-[#a1a1aa] italic">
                                      No sections assigned
                                    </span>
                                  ) : (
                                    v.sections.map((sec) => (
                                      <span
                                        key={sec.id}
                                        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#e4e4e7] rounded text-[#09090b]"
                                      >
                                        <Layers className="w-2.5 h-2.5 text-[#71717a]" />
                                        {sec.name}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manage Access Button */}
                          {!emp.isAdmin && (
                            <button
                              onClick={() => {
                                setManagingUser(emp);
                                if (availableVentures.length === 0) {
                                  reloadDropdowns();
                                }
                                const firstMembership = emp.ventures[0];
                                setMembershipForm({
                                  ventureId: firstMembership?.ventureId || '',
                                  departmentId: firstMembership?.departmentId || '',
                                  teamId: firstMembership?.teamId || '',
                                  sectionIds: firstMembership?.sections.map((s) => s.id) || [],
                                });
                              }}
                              className="px-2.5 py-1 text-xs bg-white hover:bg-[#f4f4f5] text-[#09090b] border border-[#e4e4e7] rounded-md transition-colors flex items-center gap-1 font-medium shadow-2xs"
                              title="Manage Membership & Sections"
                            >
                              <Sliders className="w-3 h-3 text-[#71717a]" />
                              <span>Access</span>
                            </button>
                          )}

                          {/* Edit Details */}
                          <button
                            onClick={() => {
                              setEditingUser(emp);
                              setEditForm({ name: emp.name, email: emp.email });
                            }}
                            className="p-1.5 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] border border-transparent hover:border-[#e4e4e7] rounded-md transition-colors"
                            title="Edit Name & Email"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setResetPasswordUser(emp);
                              setNewPassword('');
                            }}
                            className="p-1.5 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] border border-transparent hover:border-[#e4e4e7] rounded-md transition-colors"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          {!emp.isAdmin && (
                            <button
                              onClick={() => handleToggleStatus(emp)}
                              className={`p-1.5 border border-transparent hover:border-[#e4e4e7] rounded-md transition-colors ${
                                emp.status === 'active'
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={emp.status === 'active' ? 'Deactivate user' : 'Activate user'}
                            >
                              {emp.status === 'active' ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Employee Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-lg w-full shadow-xl p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">Add Employee Account</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#18181b] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunil Mehta"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#18181b] mb-1">
                    Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="sunil@meda.com"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                />
              </div>

              <div className="pt-2 border-t border-[#f0f0f2]">
                <div className="text-xs font-semibold text-[#09090b] mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#71717a]" />
                  <span>Organizational Assignment (Optional at creation)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Venture */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#71717a] mb-1">
                      Venture
                    </label>
                    <select
                      value={createForm.ventureId}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          ventureId: e.target.value,
                          departmentId: '',
                          teamId: '',
                          sectionIds: [],
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                    >
                      <option value="">None</option>
                      {(availableVentures.length > 0 ? availableVentures : allVentures).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#71717a] mb-1">
                      Department
                    </label>
                    <select
                      value={createForm.departmentId}
                      disabled={!createForm.ventureId}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          departmentId: e.target.value,
                          teamId: '',
                          sectionIds: [],
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b] disabled:opacity-50"
                    >
                      <option value="">Select Dept...</option>
                      {createDepts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Team */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#71717a] mb-1">
                      Team
                    </label>
                    <select
                      value={createForm.teamId}
                      disabled={!createForm.departmentId}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, teamId: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b] disabled:opacity-50"
                    >
                      <option value="">Select Team...</option>
                      {createTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section checkboxes for chosen department */}
                {createForm.departmentId && createSections.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-[#f0f0f2]">
                    <label className="block text-[11px] font-medium text-[#71717a] mb-1.5">
                      Assigned Sections in this Department:
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-[#fafafa] rounded-md border border-[#e4e4e7]">
                      {createSections.map((sec) => {
                        const checked = createForm.sectionIds.includes(sec.id);
                        return (
                          <label
                            key={sec.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreateForm((prev) => ({
                                    ...prev,
                                    sectionIds: [...prev.sectionIds, sec.id],
                                  }));
                                } else {
                                  setCreateForm((prev) => ({
                                    ...prev,
                                    sectionIds: prev.sectionIds.filter((id) => id !== sec.id),
                                  }));
                                }
                              }}
                              className="rounded border-[#d4d4d8] text-[#09090b] focus:ring-0"
                            />
                            <span className="truncate">{sec.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f0f0f2]">
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
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">Edit Employee Details</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Full Name
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
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
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
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full shadow-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">
                Reset Password: {resetPasswordUser.name}
              </h3>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
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
                  <span>Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Access & Membership Modal */}
      {managingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-lg w-full shadow-xl p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-sm font-semibold text-[#09090b]">
                  Manage Membership & Access: {managingUser.name}
                </h3>
                <span className="text-[11px] text-[#71717a]">{managingUser.email}</span>
              </div>
              <button
                onClick={() => setManagingUser(null)}
                className="text-[#71717a] hover:text-[#09090b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing Memberships list */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-[#09090b] mb-2">
                Current Venture Assignments:
              </div>
              {managingUser.ventures.length === 0 ? (
                <div className="text-xs text-[#a1a1aa] italic bg-[#fafafa] p-3 rounded-lg border border-[#e4e4e7]">
                  No venture assignments currently configured.
                </div>
              ) : (
                <div className="space-y-2">
                  {managingUser.ventures.map((mv) => (
                    <div
                      key={mv.ventureId}
                      className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg p-3 text-xs flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-[#09090b] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#18181b]" />
                          <span>{mv.ventureName}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-[#52525b] flex items-center gap-2">
                          <span>Dept: {mv.departmentName}</span>
                          <span className="text-[#d4d4d8]">•</span>
                          <span>Team: {mv.teamName}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {mv.sections.map((s) => (
                            <span
                              key={s.id}
                              className="text-[10px] font-mono px-1.5 py-0.2 bg-white border border-[#e4e4e7] rounded text-[#09090b]"
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveMembership(mv.ventureId)}
                        className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                        title="Remove from this venture"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to Assign or Update Membership */}
            <form onSubmit={handleMembershipSubmit} className="mt-6 pt-4 border-t border-[#f0f0f2] space-y-4">
              <div className="text-xs font-semibold text-[#09090b]">
                Assign / Update Membership & Sections:
              </div>

              {/* Venture Select */}
              <div>
                <label className="block text-[11px] font-medium text-[#18181b] mb-1">
                  Venture *
                </label>
                <select
                  required
                  value={membershipForm.ventureId}
                  onChange={(e) => {
                    const vid = e.target.value;
                    const existingM = managingUser.ventures.find((v) => v.ventureId === vid);
                    setMembershipForm({
                      ventureId: vid,
                      departmentId: existingM ? existingM.departmentId : '',
                      teamId: existingM ? existingM.teamId : '',
                      sectionIds: existingM ? existingM.sections.map((s) => s.id) : [],
                    });
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b]"
                >
                  <option value="">Select a Venture...</option>
                  {(availableVentures.length > 0 ? availableVentures : allVentures).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Select */}
              <div>
                <label className="block text-[11px] font-medium text-[#18181b] mb-1">
                  Department *
                </label>
                <select
                  required
                  disabled={!membershipForm.ventureId}
                  value={membershipForm.departmentId}
                  onChange={(e) =>
                    setMembershipForm((prev) => ({
                      ...prev,
                      departmentId: e.target.value,
                      teamId: '',
                      sectionIds: [],
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b] disabled:opacity-50"
                >
                  <option value="">Select a Department...</option>
                  {manageDepts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Select */}
              <div>
                <label className="block text-[11px] font-medium text-[#18181b] mb-1">
                  Team in Department *
                </label>
                <select
                  required
                  disabled={!membershipForm.departmentId}
                  value={membershipForm.teamId}
                  onChange={(e) =>
                    setMembershipForm((prev) => ({ ...prev, teamId: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#e4e4e7] rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#09090b] disabled:opacity-50"
                >
                  <option value="">Select a Team...</option>
                  {manageTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Checkboxes */}
              {membershipForm.departmentId && (
                <div>
                  <label className="block text-[11px] font-medium text-[#18181b] mb-1.5">
                    Assigned Sections in this Department:
                  </label>
                  {manageSections.length === 0 ? (
                    <div className="text-xs text-[#a1a1aa] italic p-2 bg-[#fafafa] rounded border border-[#e4e4e7]">
                      No sections created under this department yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-[#fafafa] rounded-md border border-[#e4e4e7]">
                      {manageSections.map((sec) => {
                        const checked = membershipForm.sectionIds.includes(sec.id);
                        return (
                          <label
                            key={sec.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMembershipForm((prev) => ({
                                    ...prev,
                                    sectionIds: [...prev.sectionIds, sec.id],
                                  }));
                                } else {
                                  setMembershipForm((prev) => ({
                                    ...prev,
                                    sectionIds: prev.sectionIds.filter((id) => id !== sec.id),
                                  }));
                                }
                              }}
                              className="rounded border-[#d4d4d8] text-[#09090b] focus:ring-0"
                            />
                            <span className="truncate">{sec.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setManagingUser(null)}
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
                  <span>Save Access</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
