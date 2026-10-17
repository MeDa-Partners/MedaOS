'use client';

import { useState } from 'react';
import { Loader2, Star, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { api, errorMessage, Team } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Field, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/dialog';
import { StatusDot } from '@/components/ui/role-badge';
import { useToast } from '@/components/ui/toast';

export function TeamSheet({
  teamId,
  ventureId,
  onChanged,
  onDeleted,
  onClose,
}: {
  teamId: string;
  ventureId: string;
  onChanged: (team: Team) => void;
  onDeleted: (teamId: string) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const team = useAsync(() => api.teams.get(teamId), [teamId]);
  const t = team.data;
  const canManage = !!t?.canManage;

  // Department roster, to add people to this team (department heads/admins only).
  const roster = useAsync(
    () => api.employees.list({ ventureId, departmentId: t!.departmentId, limit: 200 }),
    [ventureId, t?.departmentId],
    canManage && !!t
  );

  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? t?.name ?? '';
  const [addId, setAddId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const candidates = (roster.data?.users ?? [])
    .map((u) => ({ u, m: u.ventures.find((v) => v.departmentId === t?.departmentId) }))
    .filter(({ m, u }) => m && m.teamId !== teamId && u.status === 'active');

  const apply = (updated: Team) => {
    team.setData(updated);
    onChanged(updated);
  };

  const act = async (key: string, fn: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast(success);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const reloadTeam = async () => {
    const fresh = await api.teams.get(teamId);
    apply(fresh);
    roster.reload();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <div className="pr-8">
            <p className="text-[11px] text-[#71717a]">{t?.departmentName ?? 'Team'}</p>
            <h2 className="text-base font-semibold tracking-tight text-[#09090b]">{t?.name ?? 'Loading…'}</h2>
          </div>
        </SheetHeader>
        <SheetBody>
          {team.error && <Alert>{team.error}</Alert>}
          {!t ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-4 h-4 animate-spin text-[#71717a]" />
            </div>
          ) : (
            <div className="space-y-6">
              {canManage && (
                <div className="space-y-3">
                  <Field label="Team name">
                    <div className="flex gap-2">
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                      {name.trim() && name.trim() !== t.name && (
                        <Button
                          loading={busy === 'rename'}
                          onClick={() =>
                            act(
                              'rename',
                              async () => {
                                apply(await api.teams.update(t.id, { name: name.trim() }));
                                setName(null);
                              },
                              'Team renamed'
                            )
                          }
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </Field>
                  <Field label="Team head" hint="Team heads give their team access to the sections they have themselves.">
                    <Select
                      value={t.headUserId ?? ''}
                      disabled={busy !== null}
                      onChange={(e) =>
                        act(
                          'head',
                          async () => apply(await api.teams.assignHead(t.id, e.target.value || null)),
                          e.target.value ? 'Team head appointed' : 'Team head removed'
                        )
                      }
                    >
                      <option value="">No team head</option>
                      {(t.members ?? [])
                        .filter((m) => m.status === 'active')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#09090b]">
                    Members <span className="text-[#a1a1aa] font-normal">({t.members?.length ?? 0})</span>
                  </h3>
                </div>

                {canManage && (
                  <div className="flex gap-2 mb-3">
                    <Select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1" disabled={roster.loading}>
                      <option value="">{roster.loading ? 'Loading department…' : 'Add someone from the department…'}</option>
                      {candidates.map(({ u, m }) => (
                        <option key={u.id} value={u.id}>
                          {u.name} {m?.teamName ? `(now in ${m.teamName})` : '(no team)'}
                        </option>
                      ))}
                    </Select>
                    <Button
                      disabled={!addId}
                      loading={busy === 'add'}
                      onClick={() =>
                        act(
                          'add',
                          async () => {
                            await api.employees.setMembership(addId, { departmentId: t.departmentId, teamId: t.id });
                            setAddId('');
                            await reloadTeam();
                          },
                          'Added to team'
                        )
                      }
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </Button>
                  </div>
                )}

                {(t.members ?? []).length === 0 ? (
                  <p className="text-xs text-[#71717a] rounded-lg border border-dashed border-[#e4e4e7] px-3 py-6 text-center">
                    No one is in this team yet.
                  </p>
                ) : (
                  <ul className="rounded-xl border border-[#e4e4e7] divide-y divide-[#f0f0f2]">
                    {(t.members ?? []).map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar name={m.name} seed={m.id} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[#09090b]">
                            <span className="truncate">{m.name}</span>
                            {m.isTeamHead && <Star className="w-3 h-3 text-sky-600 fill-sky-600 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-[#71717a] truncate">{m.email}</div>
                        </div>
                        {m.status !== 'active' && <StatusDot status={m.status} />}
                        {canManage && (
                          <button
                            type="button"
                            title="Remove from team (stays in department)"
                            disabled={busy !== null}
                            onClick={() =>
                              act(
                                `rm-${m.id}`,
                                async () => {
                                  await api.employees.setMembership(m.id, { departmentId: t.departmentId, teamId: null });
                                  await reloadTeam();
                                },
                                `${m.name} removed from ${t.name}`
                              )
                            }
                            className="p-1.5 rounded-md text-[#a1a1aa] hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-40"
                          >
                            {busy === `rm-${m.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canManage && (
                <div className="pt-4 border-t border-[#f0f0f2] flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy === 'status'}
                    onClick={() =>
                      act(
                        'status',
                        async () => apply(await api.teams.update(t.id, { status: t.status === 'active' ? 'inactive' : 'active' })),
                        t.status === 'active' ? 'Team deactivated' : 'Team reactivated'
                      )
                    }
                  >
                    {t.status === 'active' ? 'Deactivate team' : 'Reactivate team'}
                  </Button>
                  <Button variant="secondary" size="sm" className="text-red-600!" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete team
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetBody>
      </SheetContent>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${t?.name}?`}
        description="Its members stay in the department without a team. Their section access is not affected."
        confirmLabel="Delete team"
        destructive
        loading={busy === 'delete'}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          act(
            'delete',
            async () => {
              await api.teams.remove(teamId);
              setConfirmDelete(false);
              onDeleted(teamId);
            },
            'Team deleted'
          )
        }
      />
    </Sheet>
  );
}
