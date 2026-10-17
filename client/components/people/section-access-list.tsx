'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { api, Employee, EmployeeMembership, errorMessage, Section } from '@/lib/api';
import { Checkbox } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';

/**
 * Per-user section toggles for one department. Respects the server's capability flags:
 * team heads only see their own sections as toggleable.
 */
export function SectionAccessList({
  employee,
  membership,
  sections,
  onChanged,
}: {
  employee: Employee;
  membership: EmployeeMembership;
  sections: Section[];
  onChanged: (updated: Employee) => void;
}) {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const deptSections = sections.filter((s) => s.departmentId === membership.departmentId);
  const granted = new Set(membership.sections.map((s) => s.id));
  const { canManageSections, grantableSectionIds } = membership.capabilities;
  const grantable = grantableSectionIds === null ? null : new Set(grantableSectionIds);

  if (membership.isDepartmentHead) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2.5 text-xs text-violet-900">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        As head of {membership.departmentName}, {employee.name.split(' ')[0]} can open every section of the department.
      </div>
    );
  }

  if (deptSections.length === 0) {
    return <p className="text-xs text-[#71717a]">{membership.departmentName} has no sections yet.</p>;
  }

  const toggle = async (section: Section, next: boolean) => {
    setPending(section.id);
    try {
      const updated = next
        ? await api.employees.grantSection(employee.id, section.id)
        : await api.employees.revokeSection(employee.id, section.id);
      onChanged(updated);
      toast(`${next ? 'Gave' : 'Removed'} ${section.name} ${next ? 'to' : 'from'} ${employee.name}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-2">
      {canManageSections && grantable && (
        <p className="text-[11px] text-[#71717a] leading-relaxed">
          As a team head you can give or remove only the sections you have yourself. Others are managed by the
          department head.
        </p>
      )}
      <div className="rounded-xl border border-[#e4e4e7] divide-y divide-[#f0f0f2]">
        {deptSections.map((s) => {
          const editable = canManageSections && (grantable === null || grantable.has(s.id));
          return (
            <div key={s.id} className="px-1 py-0.5">
              <Checkbox
                checked={granted.has(s.id)}
                disabled={!editable || pending !== null}
                onChange={(next) => toggle(s, next)}
                title={editable ? undefined : 'You can’t change this section for this person'}
                label={
                  <span className="flex items-center gap-2">
                    {s.name}
                    {s.status !== 'active' && (
                      <span className="text-[10px] font-normal text-[#71717a] bg-[#f4f4f5] rounded px-1">Disabled</span>
                    )}
                  </span>
                }
                description={s.route}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
