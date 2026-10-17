'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, Users } from 'lucide-react';
import { api, Employee } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { useVentureOrg } from '@/lib/use-org';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Checkbox, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';
import { RoleBadge, StatusDot } from '@/components/ui/role-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EmployeeSheet } from '@/components/people/employee-sheet';
import { CreateEmployeeDialog } from '@/components/people/create-employee-dialog';

function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function EmployeesPage() {
  const { activeVenture } = useAuth();
  // Remount per venture so filters and the open drawer reset when the venture changes.
  return <EmployeesView key={activeVenture?.id ?? 'none'} />;
}

function EmployeesView() {
  const { activeVenture, role, isAdmin } = useAuth();
  const ventureId = activeVenture?.id;

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebounced(search);

  const org = useVentureOrg(ventureId);
  const people = useAsync(
    () => api.employees.list({ ventureId, search: debouncedSearch, includeUnassigned: isAdmin && includeUnassigned, limit: 200 }),
    [ventureId, debouncedSearch, includeUnassigned, isAdmin],
    !!ventureId
  );

  const rows = useMemo(() => {
    const list = people.data?.users ?? [];
    return list.filter((u) => {
      const m = u.ventures.find((v) => v.ventureId === ventureId);
      if (deptFilter && m?.departmentId !== deptFilter) return false;
      if (teamFilter === 'none' && (!m || m.teamId)) return false;
      if (teamFilter && teamFilter !== 'none' && m?.teamId !== teamFilter) return false;
      return true;
    });
  }, [people.data, ventureId, deptFilter, teamFilter]);

  const selected = people.data?.users.find((u) => u.id === selectedId) ?? null;
  const canCreate = isAdmin || (org.data?.departments.some((d) => d.canManage) ?? false);
  const teamsForFilter = (org.data?.teams ?? []).filter((t) => !deptFilter || t.departmentId === deptFilter);

  const upsert = (updated: Employee) =>
    people.setData((prev) => {
      if (!prev) return prev;
      const exists = prev.users.some((u) => u.id === updated.id);
      return {
        ...prev,
        users: exists ? prev.users.map((u) => (u.id === updated.id ? updated : u)) : [updated, ...prev.users],
        total: exists ? prev.total : prev.total + 1,
      };
    });

  return (
    <AppShell
      title="Employees"
      description={
        role === 'team_head'
          ? `People in your team in ${activeVenture?.name}`
          : `People working in ${activeVenture?.name ?? 'this venture'}`
      }
      allow={(a) => a.role !== null && a.role !== 'member'}
      wide
      actions={
        canCreate && org.data ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" /> Add employee
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 mb-4">
        <div className="relative flex-1 min-w-0 lg:max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="pl-8" />
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {(org.data?.departments.length ?? 0) > 1 && (
            <Select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setTeamFilter('');
              }}
              className="w-44"
            >
              <option value="">All departments</option>
              {org.data?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}
          <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="w-40">
            <option value="">All teams</option>
            <option value="none">No team</option>
            {teamsForFilter.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        {isAdmin && (
          <div className="lg:ml-auto">
            <Checkbox
              checked={includeUnassigned}
              onChange={setIncludeUnassigned}
              label="Show everyone"
              description="Include people outside this venture"
            />
          </div>
        )}
      </div>

      {people.error && <Alert>{people.error}</Alert>}

      {people.loading && !people.data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading people…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || deptFilter || teamFilter ? 'No one matches these filters' : 'No employees yet'}
          description={
            canCreate
              ? 'Add people to your department, then place them in teams and give them section access.'
              : 'People in your team will appear here.'
          }
          action={canCreate && org.data && !search ? { label: 'Add employee', onClick: () => setCreating(true) } : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-[#e4e4e7] bg-white shadow-2xs overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f0f0f2] bg-[#fafafa] text-[11px] font-medium text-[#71717a]">
                  <th className="px-4 py-2.5 font-medium">Person</th>
                  <th className="px-4 py-2.5 font-medium">Department</th>
                  <th className="px-4 py-2.5 font-medium">Team</th>
                  <th className="px-4 py-2.5 font-medium">Sections</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f2]">
                {rows.map((u) => {
                  const m = u.ventures.find((v) => v.ventureId === ventureId);
                  const role = u.isAdmin ? 'admin' : m?.isDepartmentHead ? 'department_head' : m?.isTeamHead ? 'team_head' : 'member';
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`cursor-pointer hover:bg-[#fafafa] transition-colors ${u.status !== 'active' ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={u.name} seed={u.id} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium text-[#09090b] truncate">{u.name}</span>
                              <RoleBadge role={role} />
                            </div>
                            <div className="text-[11px] text-[#71717a] truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#3f3f46]">{m?.departmentName ?? <span className="text-[#a1a1aa]">Not in venture</span>}</td>
                      <td className="px-4 py-3 text-xs text-[#3f3f46]">
                        {m ? m.teamName ?? <span className="text-[#a1a1aa]">No team</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {m?.isDepartmentHead ? (
                          <span className="text-[11px] text-violet-700">All in department</span>
                        ) : m && m.sections.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {m.sections.slice(0, 3).map((s) => (
                              <span key={s.id} className="text-[10px] rounded-md bg-[#f4f4f5] text-[#3f3f46] px-1.5 py-0.5">
                                {s.name}
                              </span>
                            ))}
                            {m.sections.length > 3 && <span className="text-[10px] text-[#71717a] px-1">+{m.sections.length - 3}</span>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#a1a1aa]">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusDot status={u.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rows.map((u) => {
              const m = u.ventures.find((v) => v.ventureId === ventureId);
              const role = u.isAdmin ? 'admin' : m?.isDepartmentHead ? 'department_head' : m?.isTeamHead ? 'team_head' : 'member';
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  className="w-full text-left flex items-center gap-3 rounded-xl border border-[#e4e4e7] bg-white p-3 cursor-pointer"
                >
                  <Avatar name={u.name} seed={u.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-[#09090b] truncate">{u.name}</span>
                      <RoleBadge role={role} />
                    </div>
                    <div className="text-[11px] text-[#71717a] truncate">
                      {m ? `${m.departmentName} · ${m.teamName ?? 'No team'}` : u.email}
                    </div>
                  </div>
                  <StatusDot status={u.status} />
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-[#a1a1aa] mt-3">
            Showing {rows.length} of {people.data?.total ?? rows.length}
          </p>
        </>
      )}

      {selected && org.data && activeVenture && (
        <EmployeeSheet
          key={selected.id}
          employee={selected}
          venture={activeVenture}
          org={org.data}
          onChanged={upsert}
          onClose={() => setSelectedId(null)}
        />
      )}

      {creating && org.data && activeVenture && (
        <CreateEmployeeDialog
          open
          venture={activeVenture}
          org={org.data}
          onClose={() => setCreating(false)}
          onCreated={upsert}
        />
      )}
    </AppShell>
  );
}
