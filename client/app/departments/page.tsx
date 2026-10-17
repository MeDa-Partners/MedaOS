'use client';

import { useState } from 'react';
import { Crown, FolderTree, Layers, Loader2, Network, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { useVentureOrg } from '@/lib/use-org';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { Alert, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#52525b]">
      <Icon className="w-3.5 h-3.5 text-[#a1a1aa]" />
      <span className="font-semibold text-[#09090b]">{value}</span> {label}
    </div>
  );
}

export default function DepartmentsPage() {
  const { activeVenture, isAdmin } = useAuth();
  const toast = useToast();
  const ventureId = activeVenture?.id;
  const org = useVentureOrg(ventureId);
  const people = useAsync(() => api.employees.list({ ventureId, limit: 200 }), [ventureId], !!ventureId && isAdmin);
  const [saving, setSaving] = useState<string | null>(null);

  const assignHead = async (departmentId: string, headUserId: string | null) => {
    setSaving(departmentId);
    try {
      const updated = await api.departments.assignHead(departmentId, headUserId);
      org.setData((prev) =>
        prev ? { ...prev, departments: prev.departments.map((d) => (d.id === updated.id ? updated : d)) } : prev
      );
      toast(headUserId ? `${updated.headUser?.name} now heads ${updated.name}` : `${updated.name} has no head now`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppShell
      title="Departments"
      description={
        isAdmin
          ? 'Appoint a head for each department. Departments and sections are created in the developer console.'
          : 'The departments you belong to'
      }
      allow={(a) => a.isAdmin || a.role === 'department_head'}
    >
      {org.error && <Alert>{org.error}</Alert>}
      {org.loading && !org.data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading departments…
        </div>
      ) : (org.data?.departments.length ?? 0) === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No departments yet"
          description="Departments are created in the developer console (/dev) under the venture."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {org.data!.departments.map((d) => {
            const members = (people.data?.users ?? []).filter((u) =>
              u.ventures.some((v) => v.departmentId === d.id) && u.status === 'active'
            );
            const sections = org.data!.sections.filter((s) => s.departmentId === d.id);
            return (
              <div key={d.id} className="rounded-xl border border-[#e4e4e7] bg-white p-5 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#09090b]">{d.name}</h2>
                    <p className="text-[11px] font-mono text-[#a1a1aa] mt-0.5">{d.slug}</p>
                  </div>
                  {d.status !== 'active' && (
                    <span className="text-[10px] rounded-md bg-[#f4f4f5] text-[#71717a] px-1.5 py-0.5">inactive</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4">
                  <Stat icon={Users} value={d.memberCount} label="people" />
                  <Stat icon={Network} value={d.teamCount} label="teams" />
                  <Stat icon={Layers} value={d.sectionCount} label="sections" />
                </div>

                <div className="mt-5 pt-4 border-t border-[#f0f0f2]">
                  <div className="text-[11px] font-medium text-[#71717a] mb-2 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-violet-500" /> Department head
                  </div>
                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={d.headUserId ?? ''}
                        disabled={saving === d.id || people.loading}
                        onChange={(e) => assignHead(d.id, e.target.value || null)}
                        className="flex-1"
                      >
                        <option value="">No department head</option>
                        {members.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </Select>
                      {saving === d.id && <Loader2 className="w-4 h-4 animate-spin text-[#71717a]" />}
                    </div>
                  ) : d.headUser ? (
                    <div className="flex items-center gap-2 text-xs">
                      <Avatar name={d.headUser.name} seed={d.headUser.id} size="sm" />
                      <span className="font-medium text-[#09090b]">{d.headUser.name}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-[#a1a1aa]">Not appointed</p>
                  )}
                  {isAdmin && members.length === 0 && !people.loading && (
                    <p className="text-[11px] text-[#71717a] mt-2">
                      Add someone to {d.name} from Employees first; a head must be a member of the department.
                    </p>
                  )}
                </div>

                {sections.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {sections.map((s) => (
                      <span key={s.id} className="text-[11px] rounded-md bg-[#f4f4f5] text-[#3f3f46] px-2 py-0.5">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
