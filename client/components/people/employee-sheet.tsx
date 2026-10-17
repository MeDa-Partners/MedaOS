'use client';

import { ReactNode, useState } from 'react';
import { KeyRound, Power, UserMinus } from 'lucide-react';
import { api, Employee, errorMessage } from '@/lib/api';
import { VentureOrg } from '@/lib/use-org';
import { useAuth } from '@/context/auth-context';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Select, Alert } from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/dialog';
import { RoleBadge, StatusDot } from '@/components/ui/role-badge';
import { useToast } from '@/components/ui/toast';
import { SectionAccessList } from './section-access-list';
import { generatePassword } from './password';

function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="py-5 first:pt-0 border-b border-[#f0f0f2] last:border-b-0">
      <h3 className="text-xs font-semibold text-[#09090b] uppercase tracking-wide">{title}</h3>
      {description && <p className="text-[11px] text-[#71717a] mt-0.5 mb-3">{description}</p>}
      <div className={description ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

type Confirm = 'remove' | 'status' | null;

export function EmployeeSheet({
  employee,
  venture,
  org,
  onChanged,
  onClose,
}: {
  employee: Employee | null;
  venture: { id: string; name: string };
  org: VentureOrg;
  onChanged: (updated: Employee) => void;
  onClose: () => void;
}) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const membership = employee?.ventures.find((v) => v.ventureId === venture.id) ?? null;

  const [deptId, setDeptId] = useState(membership?.departmentId ?? '');
  const [teamId, setTeamId] = useState(membership?.teamId ?? '');
  const [name, setName] = useState(employee?.name ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);

  if (!employee) return null;

  const run = async (key: string, action: () => Promise<Employee | null>, success: string) => {
    setBusy(key);
    try {
      const updated = await action();
      if (updated) onChanged(updated);
      toast(success);
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const caps = membership?.capabilities;
  const canPlace = isAdmin || !!caps?.canChangeTeam;
  const teamsInDept = org.teams.filter((t) => t.departmentId === deptId && (t.status === 'active' || t.id === teamId));
  const placementDirty = deptId !== (membership?.departmentId ?? '') || teamId !== (membership?.teamId ?? '');
  const movingDepartments = !!membership && deptId !== membership.departmentId;
  const accountDirty = name.trim() !== employee.name || email.trim().toLowerCase() !== employee.email;
  const role = employee.isAdmin
    ? 'admin'
    : membership?.isDepartmentHead
    ? 'department_head'
    : membership?.isTeamHead
    ? 'team_head'
    : 'member';

  const savePlacement = () => {
    if (!deptId) {
      setPlacementError('Choose a department.');
      return;
    }
    setPlacementError(null);
    run(
      'placement',
      () => api.employees.setMembership(employee.id, { departmentId: deptId, teamId: teamId || null }),
      membership ? 'Placement updated' : `${employee.name} added to ${venture.name}`
    );
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-3 pr-8">
            <Avatar name={employee.name} seed={employee.id} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold tracking-tight text-[#09090b] truncate">{employee.name}</h2>
                <RoleBadge role={role} />
              </div>
              <p className="text-xs text-[#71717a] truncate">{employee.email}</p>
              <div className="mt-1">
                <StatusDot status={employee.status} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <SheetBody>
          <Block
            title={`Placement in ${venture.name}`}
            description={
              membership
                ? 'One department per venture. A team is optional.'
                : 'This person is not part of this venture yet.'
            }
          >
            {canPlace && (membership || isAdmin) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Department">
                    <Select
                      value={deptId}
                      disabled={!isAdmin}
                      onChange={(e) => {
                        setDeptId(e.target.value);
                        setTeamId('');
                      }}
                    >
                      <option value="">Select department…</option>
                      {org.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Team">
                    <Select value={teamId} disabled={!deptId} onChange={(e) => setTeamId(e.target.value)}>
                      <option value="">No team</option>
                      {teamsInDept.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.status !== 'active' ? ' (inactive)' : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {movingDepartments && (
                  <Alert tone="warning">
                    Moving to another department removes {employee.name.split(' ')[0]}’s section access and any head role
                    in {membership?.departmentName}.
                  </Alert>
                )}
                {placementError && <Alert>{placementError}</Alert>}
                {placementDirty && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeptId(membership?.departmentId ?? '');
                        setTeamId(membership?.teamId ?? '');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" loading={busy === 'placement'} onClick={savePlacement}>
                      {membership ? 'Save placement' : `Add to ${venture.name}`}
                    </Button>
                  </div>
                )}
              </div>
            ) : membership ? (
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-[#71717a]">Department</dt>
                  <dd className="font-medium text-[#09090b] mt-0.5">{membership.departmentName}</dd>
                </div>
                <div>
                  <dt className="text-[#71717a]">Team</dt>
                  <dd className="font-medium text-[#09090b] mt-0.5">{membership.teamName ?? 'No team'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-[#71717a]">Only an administrator can add this person to {venture.name}.</p>
            )}
          </Block>

          {membership && (
            <Block title="Section access" description="Access is given to people, not teams.">
              <SectionAccessList employee={employee} membership={membership} sections={org.sections} onChanged={onChanged} />
            </Block>
          )}

          {employee.canEditAccount && (
            <Block title="Account">
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full name">
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                </div>
                {accountDirty && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      loading={busy === 'account'}
                      disabled={!name.trim() || !email.trim()}
                      onClick={() =>
                        run('account', () => api.employees.update(employee.id, { name: name.trim(), email: email.trim() }), 'Details saved')
                      }
                    >
                      Save details
                    </Button>
                  </div>
                )}

                <Field label="Reset password" hint="They will be signed out everywhere and must use the new password.">
                  <div className="flex gap-2">
                    <Input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min. 8 characters)"
                      className="font-mono"
                    />
                    <Button variant="secondary" type="button" onClick={() => setNewPassword(generatePassword())}>
                      Generate
                    </Button>
                    <Button
                      type="button"
                      disabled={newPassword.length < 8}
                      loading={busy === 'password'}
                      onClick={() =>
                        run(
                          'password',
                          async () => {
                            await api.employees.resetPassword(employee.id, newPassword);
                            await navigator.clipboard?.writeText(newPassword).catch(() => {});
                            return null;
                          },
                          'Password reset and copied. Share it with them securely.'
                        )
                      }
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset
                    </Button>
                  </div>
                </Field>
              </div>
            </Block>
          )}

          {(employee.canEditAccount || caps?.canRemove) && (
            <Block title="Danger zone">
              <div className="flex flex-wrap gap-2">
                {employee.canEditAccount && (
                  <Button variant="secondary" size="sm" onClick={() => setConfirm('status')}>
                    <Power className="w-3.5 h-3.5" />
                    {employee.status === 'active' ? 'Deactivate account' : 'Reactivate account'}
                  </Button>
                )}
                {membership && caps?.canRemove && (
                  <Button variant="secondary" size="sm" className="text-red-600!" onClick={() => setConfirm('remove')}>
                    <UserMinus className="w-3.5 h-3.5" /> Remove from {membership.departmentName}
                  </Button>
                )}
              </div>
            </Block>
          )}

          {isAdmin && employee.ventures.filter((v) => v.ventureId !== venture.id).length > 0 && (
            <Block title="Other ventures">
              <ul className="space-y-1.5">
                {employee.ventures
                  .filter((v) => v.ventureId !== venture.id)
                  .map((v) => (
                    <li key={v.ventureId} className="flex items-center justify-between text-xs rounded-lg bg-[#fafafa] border border-[#f0f0f2] px-3 py-2">
                      <span className="font-medium text-[#09090b]">{v.ventureName}</span>
                      <span className="text-[#71717a]">
                        {v.departmentName}
                        {v.teamName ? ` · ${v.teamName}` : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            </Block>
          )}
        </SheetBody>
      </SheetContent>

      <ConfirmDialog
        open={confirm === 'status'}
        title={employee.status === 'active' ? `Deactivate ${employee.name}?` : `Reactivate ${employee.name}?`}
        description={
          employee.status === 'active'
            ? 'They will be signed out immediately and can’t log in. Any department or team head role is removed.'
            : 'They will be able to sign in again with their current password.'
        }
        confirmLabel={employee.status === 'active' ? 'Deactivate' : 'Reactivate'}
        destructive={employee.status === 'active'}
        loading={busy === 'status'}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await run(
            'status',
            () => api.employees.setStatus(employee.id, employee.status === 'active' ? 'inactive' : 'active'),
            employee.status === 'active' ? 'Account deactivated' : 'Account reactivated'
          );
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        title={`Remove ${employee.name} from ${membership?.departmentName}?`}
        description={`They lose access to every ${venture.name} section from this department. Their account stays active.`}
        confirmLabel="Remove"
        destructive
        loading={busy === 'remove'}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await run('remove', () => api.employees.removeMembership(employee.id, venture.id), 'Removed from department');
          setConfirm(null);
        }}
      />
    </Sheet>
  );
}
