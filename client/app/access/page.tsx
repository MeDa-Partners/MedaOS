'use client';

import { useMemo, useState } from 'react';
import { Crown, Loader2, Search, ShieldCheck } from 'lucide-react';
import { api, Employee, errorMessage, Section } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { useVentureOrg } from '@/lib/use-org';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { Input } from '@/components/ui/input';
import { Alert, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';

export default function AccessPage() {
  const { activeVenture, teamsLed, user } = useAuth();
  const toast = useToast();
  const ventureId = activeVenture?.id;
  const org = useVentureOrg(ventureId);

  // Departments where the caller can hand out access: ones they run, or that contain a team they lead.
  const departments = useMemo(() => {
    if (!org.data) return [];
    const ledTeamDepts = new Set(org.data.teams.filter((t) => teamsLed.includes(t.id)).map((t) => t.departmentId));
    return org.data.departments.filter((d) => d.canManage || ledTeamDepts.has(d.id));
  }, [org.data, teamsLed]);

  const [pickedDepartmentId, setDepartmentId] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  const departmentId = departments.some((d) => d.id === pickedDepartmentId)
    ? pickedDepartmentId
    : departments[0]?.id ?? '';

  const people = useAsync(
    () => api.employees.list({ ventureId, departmentId, limit: 200 }),
    [ventureId, departmentId],
    !!ventureId && !!departmentId
  );

  const sections: Section[] = useMemo(
    () => (org.data?.sections ?? []).filter((s) => s.departmentId === departmentId),
    [org.data, departmentId]
  );
  const teams = (org.data?.teams ?? []).filter((t) => t.departmentId === departmentId);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (people.data?.users ?? [])
      .map((u) => ({ user: u, m: u.ventures.find((v) => v.departmentId === departmentId) }))
      .filter(({ user: u, m }) => {
        if (!m) return false;
        if (teamFilter === 'none' && m.teamId) return false;
        if (teamFilter && teamFilter !== 'none' && m.teamId !== teamFilter) return false;
        return !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
      });
  }, [people.data, departmentId, teamFilter, search]);

  const replace = (updated: Employee) =>
    people.setData((prev) => (prev ? { ...prev, users: prev.users.map((u) => (u.id === updated.id ? updated : u)) } : prev));

  const toggle = async (employee: Employee, section: Section, next: boolean) => {
    const key = `${employee.id}:${section.id}`;
    setPending(key);
    try {
      replace(
        next
          ? await api.employees.grantSection(employee.id, section.id)
          : await api.employees.revokeSection(employee.id, section.id)
      );
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setPending(null);
    }
  };

  const department = departments.find((d) => d.id === departmentId);
  const isTeamHeadView = !!department && !department.canManage;

  return (
    <AppShell
      title="Section access"
      description="Access is given per person. Tick a box to let someone open that section."
      allow={(a) => a.role !== null && a.role !== 'member'}
      wide
    >
      {org.loading && !org.data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing to manage here"
          description={`You don’t head a department or a team in ${activeVenture?.name ?? 'this venture'}.`}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center gap-2.5 mb-4">
            {departments.length > 1 && (
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="md:w-52">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
            {!isTeamHeadView && teams.length > 0 && (
              <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="md:w-44">
                <option value="">All teams</option>
                <option value="none">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="relative md:w-64">
              <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a person" className="pl-8" />
            </div>
          </div>

          {isTeamHeadView && (
            <div className="mb-4">
              <Alert tone="info">
                You’re seeing your team. You can give or remove the sections you have access to yourself. Greyed-out
                boxes are managed by the head of {department?.name}.
              </Alert>
            </div>
          )}

          {people.error && <Alert>{people.error}</Alert>}

          {sections.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={`${department?.name} has no sections yet`}
              description="Sections are added to departments in the developer console once they’re built."
            />
          ) : people.loading && !people.data ? (
            <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#71717a]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading people…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No one to show" description="No people match the current filters." />
          ) : (
            <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-2xs overflow-x-auto">
              <table className="text-left border-separate border-spacing-0 min-w-full">
                <thead>
                  <tr className="text-[11px] text-[#71717a]">
                    <th className="sticky left-0 z-10 bg-[#fafafa] border-b border-[#f0f0f2] px-4 py-2.5 font-medium min-w-56">Person</th>
                    {sections.map((s) => (
                      <th key={s.id} className="bg-[#fafafa] border-b border-[#f0f0f2] px-3 py-2.5 font-medium text-center whitespace-nowrap">
                        <div className="text-[#09090b]">{s.name}</div>
                        {s.status !== 'active' && <div className="text-[10px] font-normal text-[#a1a1aa]">disabled</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ user: u, m }) => {
                    const membership = m!;
                    const granted = new Set(membership.sections.map((s) => s.id));
                    const grantable = membership.capabilities.grantableSectionIds;
                    const isSelf = u.id === user?.id;
                    return (
                      <tr key={u.id} className="group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#fafafa] border-b border-[#f0f0f2] px-4 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={u.name} seed={u.id} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-[#09090b] truncate">
                                {u.name}
                                {isSelf && <span className="text-[#a1a1aa] font-normal"> (you)</span>}
                              </div>
                              <div className="text-[10px] text-[#71717a] truncate">{membership.teamName ?? 'No team'}</div>
                            </div>
                          </div>
                        </td>
                        {sections.map((s) => {
                          if (membership.isDepartmentHead) {
                            return (
                              <td key={s.id} className="border-b border-[#f0f0f2] text-center group-hover:bg-[#fafafa]" title="Department heads can open every section">
                                <Crown className="w-3.5 h-3.5 text-violet-500 inline" />
                              </td>
                            );
                          }
                          const editable =
                            membership.capabilities.canManageSections && (grantable === null || grantable.includes(s.id));
                          const key = `${u.id}:${s.id}`;
                          return (
                            <td key={s.id} className="border-b border-[#f0f0f2] text-center group-hover:bg-[#fafafa] px-3 py-2.5">
                              {pending === key ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#71717a] inline" />
                              ) : (
                                <input
                                  type="checkbox"
                                  aria-label={`${s.name} for ${u.name}`}
                                  checked={granted.has(s.id)}
                                  disabled={!editable || pending !== null}
                                  title={editable ? undefined : isSelf ? 'You can’t change your own access' : 'Managed by the department head'}
                                  onChange={(e) => toggle(u, s, e.target.checked)}
                                  className="w-4 h-4 rounded-[5px] accent-[#09090b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-35"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
