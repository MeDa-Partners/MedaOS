'use client';

import { useState } from 'react';
import { ChevronRight, Loader2, Network, Plus, Star, Users } from 'lucide-react';
import { api, Department, errorMessage, Team } from '@/lib/api';
import { useVentureOrg } from '@/lib/use-org';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Field } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { TeamSheet } from '@/components/teams/team-sheet';

function NewTeamDialog({
  department,
  onClose,
  onCreated,
}: {
  department: Department;
  onClose: () => void;
  onCreated: (team: Team) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return setError('Give the team a name.');
    setSaving(true);
    setError(null);
    try {
      onCreated(await api.teams.create({ departmentId: department.id, name: name.trim() }));
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`New team in ${department.name}`}
      description="You can add members and appoint a team head next."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create team
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Field label="Team name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Inside Sales" autoFocus />
        </Field>
        {error && <Alert>{error}</Alert>}
      </form>
    </Dialog>
  );
}

function TeamCard({ team, onOpen }: { team: Team; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group text-left rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-2xs hover:border-[#d4d4d8] hover:shadow-sm transition-all cursor-pointer ${
        team.status !== 'active' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#09090b] truncate">{team.name}</div>
          <div className="flex items-center gap-1 text-[11px] text-[#71717a] mt-0.5">
            <Users className="w-3 h-3" /> {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
            {team.status !== 'active' && <span className="ml-1.5 rounded bg-[#f4f4f5] px-1">inactive</span>}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#d4d4d8] group-hover:text-[#09090b] transition-colors shrink-0" />
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs">
        {team.headUser ? (
          <>
            <Avatar name={team.headUser.name} seed={team.headUser.id} size="sm" />
            <span className="text-[#3f3f46] truncate">{team.headUser.name}</span>
            <Star className="w-3 h-3 text-sky-600 fill-sky-600 shrink-0" />
          </>
        ) : (
          <span className="text-[#a1a1aa]">No team head</span>
        )}
      </div>
    </button>
  );
}

export default function TeamsPage() {
  const { activeVenture } = useAuth();
  const toast = useToast();
  const org = useVentureOrg(activeVenture?.id);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [newIn, setNewIn] = useState<Department | null>(null);

  const setTeams = (fn: (teams: Team[]) => Team[]) =>
    org.setData((prev) => (prev ? { ...prev, teams: fn(prev.teams) } : prev));

  return (
    <AppShell
      title="Teams"
      description={`Teams inside each department of ${activeVenture?.name ?? 'this venture'}`}
      allow={(a) => a.role !== null && a.role !== 'member'}
    >
      {org.error && <Alert>{org.error}</Alert>}
      {org.loading && !org.data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading teams…
        </div>
      ) : (org.data?.departments.length ?? 0) === 0 ? (
        <EmptyState icon={Network} title="No departments" description="This venture has no departments you can see yet." />
      ) : (
        <div className="space-y-10">
          {org.data!.departments.map((dept) => {
            const teams = org.data!.teams.filter((t) => t.departmentId === dept.id);
            return (
              <section key={dept.id}>
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#09090b]">{dept.name}</h2>
                    <p className="text-xs text-[#71717a] mt-0.5">
                      {dept.headUser ? `Head: ${dept.headUser.name}` : 'No department head'} · {dept.memberCount} people
                    </p>
                  </div>
                  {dept.canManage && (
                    <Button variant="secondary" size="sm" onClick={() => setNewIn(dept)}>
                      <Plus className="w-3.5 h-3.5" /> New team
                    </Button>
                  )}
                </div>
                {teams.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#d4d4d8] px-4 py-8 text-center text-xs text-[#71717a]">
                    No teams in {dept.name} yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {teams.map((t) => (
                      <TeamCard key={t.id} team={t} onOpen={() => setOpenTeamId(t.id)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {newIn && (
        <NewTeamDialog
          department={newIn}
          onClose={() => setNewIn(null)}
          onCreated={(team) => {
            setTeams((list) => [...list, team]);
            setNewIn(null);
            toast(`${team.name} created`);
            setOpenTeamId(team.id);
          }}
        />
      )}

      {openTeamId && activeVenture && (
        <TeamSheet
          teamId={openTeamId}
          ventureId={activeVenture.id}
          onChanged={(team) => setTeams((list) => list.map((t) => (t.id === team.id ? { ...team, memberCount: team.members?.length ?? team.memberCount } : t)))}
          onDeleted={(id) => {
            setTeams((list) => list.filter((t) => t.id !== id));
            setOpenTeamId(null);
          }}
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </AppShell>
  );
}
