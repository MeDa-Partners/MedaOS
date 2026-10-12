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
import { FilterBar, FilterSelect } from '@/components/ui/filter-bar';
import { Card } from '@/components/ui/card';
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

  // Sheets
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

  // Preload dropdown catalogs
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

        if (vRes.status === 'fulfilled') setAvailableVentures(vRes.value);
        if (dRes.status === 'fulfilled') setAvailableDepartments(dRes.value);
        if (tRes.status === 'fulfilled') setAvailableTeams(tRes.value);
        if (sRes.status === 'fulfilled') setAvailableSections(sRes.value);
      } catch {
        // Fallback gracefully
      }
    }

    fetchDropdownCatalogs();

    return () => {
      isMounted = false;
    };
  }, [allVentures, allSections, dropdownRefreshKey]);

  // Load employee list
  useEffect(() => {
    let isMounted = true;

    async function fetchEmployees() {
      try {
        const res = await api.employees.list({
          ventureId: selectedVentureFilter || undefined,
          departmentId: selectedDepartmentFilter || undefined,
          teamId: selectedTeamFilter || undefined,
          search: search || undefined,
          limit: 200,
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

    const timer = setTimeout(() => {
      fetchEmployees();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    selectedVentureFilter,
    selectedDepartmentFilter,
    selectedTeamFilter,
    search,
    refreshCount,
  ]);

  // Handle Create Employee
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      setError('Name, email, and initial password are required');
      return;
    }

    if (createForm.password.length < 8) {
      setError('Initial password must be at least 8 characters long');
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
      await api.employees.assignMembership(managingUser.id, {
        ventureId: membershipForm.ventureId,
        departmentId: membershipForm.departmentId,
        teamId: membershipForm.teamId,
      });

      await api.employees.assignSections(managingUser.id, {
        ventureId: membershipForm.ventureId,
        sectionIds: membershipForm.sectionIds,
      });

      setSuccessMessage(
        `Organizational membership and section access updated for ${managingUser.name}.`
      );
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
    <AppShell
      icon={<Users className="w-3.5 h-3.5" />}
      title="Employees Directory"
      description="Manage user credentials, multi-venture memberships, and section permissions"
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
          <Button
            size="sm"
            onClick={() => {
              setError(null);
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
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </Button>
        </>
      }
      requireEmployeeManagement
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
          searchPlaceholder="Search employees by name, email..."
          count={employees.length}
          hasActiveFilters={Boolean(
            selectedVentureFilter || selectedDepartmentFilter || selectedTeamFilter || search
          )}
          onClearFilters={() => {
            setSearch('');
            setSelectedVentureFilter('');
            setSelectedDepartmentFilter('');
            setSelectedTeamFilter('');
          }}
        >
          <FilterSelect
            icon={<Building2 className="w-3.5 h-3.5" />}
            value={selectedVentureFilter}
            onChange={(e) => {
              setSelectedVentureFilter(e.target.value);
              setSelectedDepartmentFilter('');
              setSelectedTeamFilter('');
            }}
          >
            <option value="">All Ventures</option>
            {availableVentures.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            icon={<FolderTree className="w-3.5 h-3.5" />}
            value={selectedDepartmentFilter}
            onChange={(e) => {
              setSelectedDepartmentFilter(e.target.value);
              setSelectedTeamFilter('');
            }}
          >
            <option value="">All Departments</option>
            {availableDepartments
              .filter((d) => !selectedVentureFilter || d.ventureId === selectedVentureFilter)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ventureName})
                </option>
              ))}
          </FilterSelect>

          <FilterSelect
            icon={<Network className="w-3.5 h-3.5" />}
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
          >
            <option value="">All Teams</option>
            {availableTeams
              .filter((t) => !selectedDepartmentFilter || t.departmentId === selectedDepartmentFilter)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </FilterSelect>
        </FilterBar>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717a]">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-xs font-mono">Loading employee roster...</span>
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            description={
              search || selectedVentureFilter || selectedDepartmentFilter || selectedTeamFilter
                ? 'No employees match your search query or selected organizational filters.'
                : 'Get started by creating your first employee account.'
            }
            action={{
              label: 'Add Employee',
              onClick: () => setIsCreateOpen(true),
            }}
          />
        ) : (
          <>
            {/* Desktop View: Clean Hairline Table */}
            <div className="hidden md:block bg-white border border-[#e4e4e7] rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e4e4e7] bg-[#fafafa] text-[#71717a] font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4 font-medium">Employee</th>
                      <th className="py-3 px-4 font-medium">Status & Authority</th>
                      <th className="py-3 px-4 font-medium">Ventures & Teams</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f2]">
                    {employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="hover:bg-[#fafafa]/80 transition-colors"
                      >
                        {/* Employee Identity */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#09090b] truncate">
                                {emp.name}
                              </div>
                              <div className="text-[11px] text-[#71717a] font-mono truncate">
                                {emp.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status & Authority */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="flex flex-col gap-1.5 items-start">
                            <Badge
                              variant={emp.status === 'active' ? 'success' : 'secondary'}
                              dot={emp.status === 'active'}
                            >
                              {emp.status}
                            </Badge>
                            {emp.isAdmin && (
                              <Badge variant="default" className="text-[10px]">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                Global Admin
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Ventures & Reporting Structure */}
                        <td className="py-3.5 px-4 align-top">
                          {emp.isAdmin ? (
                            <div className="text-xs text-[#71717a] flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Global Administrator access across all ventures & sections</span>
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
                            {!emp.isAdmin && (
                              <Button
                                variant="secondary"
                                size="sm"
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
                                title="Manage Membership & Sections"
                              >
                                <Sliders className="w-3 h-3 text-[#71717a]" />
                                <span>Access</span>
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingUser(emp);
                                setEditForm({ name: emp.name, email: emp.email });
                              }}
                              title="Edit Details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setResetPasswordUser(emp);
                                setNewPassword('');
                              }}
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>

                            {!emp.isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleStatus(emp)}
                                className={
                                  emp.status === 'active'
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }
                                title={emp.status === 'active' ? 'Deactivate' : 'Activate'}
                              >
                                {emp.status === 'active' ? (
                                  <UserX className="w-3.5 h-3.5" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View: Clean Card Stack */}
            <div className="md:hidden space-y-3">
              {employees.map((emp) => (
                <Card key={emp.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#09090b]">{emp.name}</div>
                        <div className="text-[11px] text-[#71717a] font-mono">{emp.email}</div>
                      </div>
                    </div>
                    <Badge
                      variant={emp.status === 'active' ? 'success' : 'secondary'}
                      dot={emp.status === 'active'}
                    >
                      {emp.status}
                    </Badge>
                  </div>

                  {/* Ventures in Card */}
                  <div className="pt-2 border-t border-[#f0f0f2] space-y-1.5">
                    {emp.isAdmin ? (
                      <Badge variant="default" className="text-[10px]">
                        Global Administrator
                      </Badge>
                    ) : emp.ventures.length === 0 ? (
                      <span className="text-[11px] text-[#a1a1aa] italic">No ventures assigned</span>
                    ) : (
                      emp.ventures.map((v) => (
                        <div
                          key={v.ventureId}
                          className="p-2 bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-xs"
                        >
                          <div className="font-semibold text-[#09090b]">{v.ventureName}</div>
                          <div className="text-[11px] text-[#71717a] mt-0.5">
                            {v.departmentName} • {v.teamName}
                          </div>
                          {v.sections.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {v.sections.map((s) => (
                                <span
                                  key={s.id}
                                  className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#e4e4e7] rounded text-[#09090b]"
                                >
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Actions in Card */}
                  <div className="pt-2 border-t border-[#f0f0f2] flex items-center justify-between gap-1 flex-wrap">
                    {!emp.isAdmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setManagingUser(emp);
                          if (availableVentures.length === 0) reloadDropdowns();
                          const firstMembership = emp.ventures[0];
                          setMembershipForm({
                            ventureId: firstMembership?.ventureId || '',
                            departmentId: firstMembership?.departmentId || '',
                            teamId: firstMembership?.teamId || '',
                            sectionIds: firstMembership?.sections.map((s) => s.id) || [],
                          });
                        }}
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Manage Access</span>
                      </Button>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingUser(emp);
                          setEditForm({ name: emp.name, email: emp.email });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setResetPasswordUser(emp);
                          setNewPassword('');
                        }}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                      {!emp.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(emp)}
                          className={emp.status === 'active' ? 'text-red-600' : 'text-emerald-600'}
                        >
                          {emp.status === 'active' ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sheet 1: Create Employee */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent side="right">
          <form onSubmit={handleCreateSubmit} className="flex flex-col h-full">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle>Add Employee Account</SheetTitle>
                  <SheetDescription>
                    Create credentials and optionally assign initial venture placement.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Full Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Varun Sharma"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Email Address *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. varun@medapartners.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Initial Password *
                </label>
                <Input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>

              {/* Placement box */}
              <div className="pt-3 border-t border-[#f0f0f2] space-y-3">
                <span className="text-xs font-semibold text-[#09090b] block">
                  Initial Organizational Placement (Optional)
                </span>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[#71717a]">
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
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                  >
                    <option value="">None (Assign later)</option>
                    {(availableVentures.length > 0 ? availableVentures : allVentures).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[#71717a]">
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
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer disabled:bg-[#f4f4f5] disabled:cursor-not-allowed"
                  >
                    <option value="">Select Department...</option>
                    {createDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[#71717a]">
                    Team
                  </label>
                  <select
                    value={createForm.teamId}
                    disabled={!createForm.departmentId}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, teamId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer disabled:bg-[#f4f4f5] disabled:cursor-not-allowed"
                  >
                    <option value="">Select Team...</option>
                    {createTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section checkboxes for chosen department */}
                {createForm.departmentId && createSections.length > 0 && (
                  <div className="pt-2 border-t border-[#f0f0f2] space-y-1.5">
                    <label className="block text-[11px] font-medium text-[#71717a]">
                      Assigned Sections in this Department:
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-[#fafafa] rounded-lg border border-[#e4e4e7]">
                      {createSections.map((sec) => {
                        const checked = createForm.sectionIds.includes(sec.id);
                        return (
                          <label
                            key={sec.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-white rounded-md cursor-pointer text-xs"
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
                              className="rounded border-[#d4d4d8] text-[#09090b]"
                            />
                            <span className="truncate">{sec.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                Create Account
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Sheet 2: Edit Employee Details */}
      <Sheet open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <SheetContent side="right">
          {editingUser && (
            <form onSubmit={handleEditSubmit} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Edit Employee Details</SheetTitle>
                    <SheetDescription>
                      Update identity name and email for {editingUser.name}.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Full Name *
                  </label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </SheetBody>

              <SheetFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingUser(null)}
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

      {/* Sheet 3: Reset Password */}
      <Sheet open={Boolean(resetPasswordUser)} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <SheetContent side="right">
          {resetPasswordUser && (
            <form onSubmit={handleResetPassword} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Reset Password</SheetTitle>
                    <SheetDescription>
                      Issue a new security password for {resetPasswordUser.name}.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    New Password *
                  </label>
                  <Input
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="text-[11px] text-[#71717a]">
                    The employee will be required to sign in with this new password.
                  </p>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setResetPasswordUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={actionLoading}
                >
                  Confirm Reset
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet 4: Manage Venture Membership & Access */}
      <Sheet open={Boolean(managingUser)} onOpenChange={(open) => !open && setManagingUser(null)}>
        <SheetContent side="right" className="sm:max-w-xl">
          {managingUser && (
            <div className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Manage Access: {managingUser.name}</SheetTitle>
                    <SheetDescription>{managingUser.email}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-6">
                {/* Current Memberships list */}
                <div>
                  <div className="text-xs font-semibold text-[#09090b] mb-2 flex items-center justify-between">
                    <span>Active Venture Memberships</span>
                    <span className="text-[11px] font-mono text-[#71717a]">
                      {managingUser.ventures.length} assigned
                    </span>
                  </div>

                  {managingUser.ventures.length === 0 ? (
                    <div className="text-xs text-[#a1a1aa] italic bg-[#fafafa] p-3.5 rounded-xl border border-[#e4e4e7]">
                      No venture assignments configured yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {managingUser.ventures.map((mv) => (
                        <div
                          key={mv.ventureId}
                          className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-3.5 text-xs flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="font-semibold text-[#09090b] flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-[#18181b]" />
                              <span>{mv.ventureName}</span>
                            </div>
                            <div className="text-[11px] text-[#52525b] flex items-center gap-2">
                              <span>Dept: {mv.departmentName}</span>
                              <span className="text-[#d4d4d8]">•</span>
                              <span>Team: {mv.teamName}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {mv.sections.map((s) => (
                                <span
                                  key={s.id}
                                  className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#e4e4e7] rounded text-[#09090b]"
                                >
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMembership(mv.ventureId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Remove venture membership"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form to Assign or Update Membership */}
                <form
                  onSubmit={handleMembershipSubmit}
                  className="pt-5 border-t border-[#f0f0f2] space-y-4"
                >
                  <div className="text-xs font-semibold text-[#09090b]">
                    Assign / Update Venture & Section Access
                  </div>

                  {/* Venture Select */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#18181b]">
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
                      className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
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
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#18181b]">
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
                      className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer disabled:bg-[#f4f4f5] disabled:cursor-not-allowed"
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
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#18181b]">
                      Team *
                    </label>
                    <select
                      required
                      disabled={!membershipForm.departmentId}
                      value={membershipForm.teamId}
                      onChange={(e) =>
                        setMembershipForm((prev) => ({ ...prev, teamId: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer disabled:bg-[#f4f4f5] disabled:cursor-not-allowed"
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
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-[#18181b]">
                        Assigned Sections in this Department:
                      </label>
                      {manageSections.length === 0 ? (
                        <div className="text-xs text-[#a1a1aa] italic p-3 bg-[#fafafa] rounded-xl border border-[#e4e4e7]">
                          No sections created under this department yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-[#fafafa] rounded-xl border border-[#e4e4e7]">
                          {manageSections.map((sec) => {
                            const checked = membershipForm.sectionIds.includes(sec.id);
                            return (
                              <label
                                key={sec.id}
                                className="flex items-center gap-2 p-1.5 hover:bg-white rounded-md cursor-pointer text-xs"
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
                                  className="rounded border-[#d4d4d8] text-[#09090b]"
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
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setManagingUser(null)}
                    >
                      Close
                    </Button>
                    <Button
                      type="submit"
                      loading={actionLoading}
                    >
                      Save Membership & Access
                    </Button>
                  </div>
                </form>
              </SheetBody>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
