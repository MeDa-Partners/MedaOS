'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Code2,
  FolderTree,
  Hammer,
  Layers,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';
import { api, DevDepartment, DevSection, DevVenture, errorMessage, Status } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { isSectionModuleBuilt } from '@/sections/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Checkbox, Field } from '@/components/ui/form';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';

type Kind = 'venture' | 'department' | 'section';

interface EditTarget {
  kind: Kind;
  id?: string;
  parentId?: string;
  name: string;
  slug: string;
  status: Status;
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const KIND_LABEL: Record<Kind, string> = { venture: 'venture', department: 'department', section: 'section' };

function DevLogin({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.dev.login(username, password);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#09090b] text-white flex items-center justify-center">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#09090b]">Developer console</h1>
            <p className="text-[11px] text-[#71717a]">Ventures, departments and sections catalog</p>
          </div>
        </div>
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
        <Link href="/login" className="block text-center text-[11px] text-[#71717a] hover:text-[#09090b]">
          Employee sign-in →
        </Link>
      </form>
    </div>
  );
}

function EntityDialog({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(target.name);
  const [slug, setSlug] = useState(target.slug);
  const [slugTouched, setSlugTouched] = useState(!!target.id);
  const [active, setActive] = useState(target.status === 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !target.id;

  const save = async () => {
    if (!name.trim() || !slug) return setError('Name and slug are required.');
    setSaving(true);
    setError(null);
    const data = { name: name.trim(), slug, status: (active ? 'active' : 'inactive') as Status };
    try {
      if (target.kind === 'venture') {
        if (isNew) await api.dev.ventures.create(data);
        else await api.dev.ventures.update(target.id!, data);
      } else if (target.kind === 'department') {
        if (isNew) await api.dev.departments.create({ ...data, ventureId: target.parentId! });
        else await api.dev.departments.update(target.id!, data);
      } else {
        if (isNew) await api.dev.sections.create({ ...data, departmentId: target.parentId! });
        else await api.dev.sections.update(target.id!, data);
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const slugHint =
    target.kind === 'venture'
      ? 'Becomes the URL: /{slug}. Must be unique.'
      : target.kind === 'section'
      ? 'Becomes the URL /{venture}/{slug} and the code module key. Unique per venture.'
      : 'Unique inside the venture.';

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={`${isNew ? 'New' : 'Edit'} ${KIND_LABEL[target.kind]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {isNew ? 'Create' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name">
          <Input
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Slug" hint={slugHint}>
          <Input
            value={slug}
            className="font-mono"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Checkbox
          checked={active}
          onChange={setActive}
          label="Active"
          description={`Inactive ${KIND_LABEL[target.kind]}s are hidden and closed for everyone, but nothing is deleted.`}
        />
        {error && <Alert>{error}</Alert>}
      </form>
    </Dialog>
  );
}

function StatusPill({ status }: { status: Status }) {
  return status === 'active' ? (
    <span className="text-[10px] rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5">active</span>
  ) : (
    <span className="text-[10px] rounded-md bg-[#f4f4f5] text-[#71717a] border border-[#e4e4e7] px-1.5 py-0.5">inactive</span>
  );
}

function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`p-1.5 rounded-md cursor-pointer text-[#a1a1aa] ${danger ? 'hover:text-red-600 hover:bg-red-50' : 'hover:text-[#09090b] hover:bg-[#f4f4f5]'}`}
    >
      {children}
    </button>
  );
}

function SectionRow({ venture, section, onEdit, onDelete }: { venture: DevVenture; section: DevSection; onEdit: () => void; onDelete: () => void }) {
  const built = isSectionModuleBuilt(venture.slug, section.slug);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Layers className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs font-medium text-[#09090b]">
          {section.name} <StatusPill status={section.status} />
        </div>
        <div className="text-[11px] font-mono text-[#a1a1aa] truncate">{section.route}</div>
      </div>
      <span
        title={built ? 'A code module is registered in client/sections/registry.ts' : 'No code module registered yet'}
        className={`hidden sm:inline-flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5 border ${
          built ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}
      >
        {built ? <CheckCircle2 className="w-3 h-3" /> : <Hammer className="w-3 h-3" />}
        {built ? 'module built' : 'not built'}
      </span>
      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#71717a] w-12 justify-end" title="People with access">
        <Users className="w-3 h-3" /> {section.assignedUserCount}
      </span>
      <IconButton title="Edit section" onClick={onEdit}>
        <Pencil className="w-3.5 h-3.5" />
      </IconButton>
      <IconButton title="Delete section" onClick={onDelete} danger>
        <Trash2 className="w-3.5 h-3.5" />
      </IconButton>
    </div>
  );
}

function DepartmentCard({
  venture,
  department,
  onEdit,
  onDelete,
}: {
  venture: DevVenture;
  department: DevDepartment;
  onEdit: (t: EditTarget) => void;
  onDelete: (kind: Kind, id: string, name: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-2xs">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f0f0f2]">
        <FolderTree className="w-4 h-4 text-[#71717a]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#09090b]">
            {department.name} <StatusPill status={department.status} />
          </div>
          <div className="text-[11px] text-[#71717a]">
            {department.employeeCount} people · {department.teamCount} teams · {department.sections.length} sections
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onEdit({ kind: 'section', parentId: department.id, name: '', slug: '', status: 'active' })}
        >
          <Plus className="w-3.5 h-3.5" /> Section
        </Button>
        <IconButton
          title="Edit department"
          onClick={() => onEdit({ kind: 'department', id: department.id, name: department.name, slug: department.slug, status: department.status })}
        >
          <Pencil className="w-3.5 h-3.5" />
        </IconButton>
        <IconButton title="Delete department" onClick={() => onDelete('department', department.id, department.name)} danger>
          <Trash2 className="w-3.5 h-3.5" />
        </IconButton>
      </div>
      {department.sections.length === 0 ? (
        <p className="px-4 py-4 text-xs text-[#a1a1aa]">No sections yet.</p>
      ) : (
        <div className="divide-y divide-[#f0f0f2]">
          {department.sections.map((s) => (
            <SectionRow
              key={s.id}
              venture={venture}
              section={s}
              onEdit={() => onEdit({ kind: 'section', id: s.id, name: s.name, slug: s.slug, status: s.status })}
              onDelete={() => onDelete('section', s.id, s.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Console({ username, onLogout }: { username: string; onLogout: () => void }) {
  const toast = useToast();
  const catalog = useAsync(() => api.dev.catalog(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [deleting, setDeleting] = useState<{ kind: Kind; id: string; name: string; force: boolean; message?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const ventures = catalog.data?.ventures ?? [];
  const venture = ventures.find((v) => v.id === selectedId) ?? ventures[0] ?? null;

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const remove = { venture: api.dev.ventures.remove, department: api.dev.departments.remove, section: api.dev.sections.remove }[deleting.kind];
      await remove(deleting.id, deleting.force);
      toast(`${deleting.name} deleted`);
      setDeleting(null);
      catalog.reload();
    } catch (err) {
      // The server refuses to delete records still in use unless forced; offer that explicitly.
      setDeleting({ ...deleting, force: true, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="h-14 bg-[#09090b] text-white flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-30">
        <Terminal className="w-4 h-4" />
        <span className="text-sm font-semibold">Developer console</span>
        <span className="hidden sm:inline text-[11px] text-white/50">catalog of ventures, departments and sections</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-white/60 font-mono">{username}</span>
          <button type="button" onClick={onLogout} className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white cursor-pointer">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#71717a]">Ventures</h2>
            <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: 'venture', name: '', slug: '', status: 'active' })}>
              <Plus className="w-3.5 h-3.5" /> New
            </Button>
          </div>
          {catalog.loading && !catalog.data ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#71717a] mx-auto mt-8" />
          ) : (
            <div className="space-y-1">
              {ventures.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left cursor-pointer transition-colors ${
                    venture?.id === v.id ? 'bg-white border border-[#e4e4e7] shadow-2xs' : 'border border-transparent hover:bg-white'
                  }`}
                >
                  <Avatar name={v.name} seed={v.slug} size="sm" square />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-[#09090b] truncate">{v.name}</span>
                    <span className="block text-[10px] text-[#71717a]">
                      {v.departmentCount} depts · {v.employeeCount} people
                    </span>
                  </span>
                  {v.status !== 'active' && <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" title="inactive" />}
                </button>
              ))}
            </div>
          )}
          <div className="mt-6 rounded-xl border border-[#e4e4e7] bg-white p-3.5 text-[11px] text-[#52525b] leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-[#09090b] mb-1">
              <Code2 className="w-3.5 h-3.5" /> Building a section
            </div>
            Create the section here, then register its module in{' '}
            <code className="font-mono text-[10px] bg-[#f4f4f5] rounded px-1">client/sections/registry.ts</code> under its slug.
            Until then people with access see a “being built” screen.
          </div>
        </aside>

        <main>
          {catalog.error && <Alert>{catalog.error}</Alert>}
          {!venture ? (
            !catalog.loading && <p className="text-sm text-[#71717a]">No ventures yet. Create the first one.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <Avatar name={venture.name} seed={venture.slug} size="lg" square />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight text-[#09090b]">{venture.name}</h1>
                    <StatusPill status={venture.status} />
                  </div>
                  <p className="text-[11px] font-mono text-[#a1a1aa]">/{venture.slug}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing({ kind: 'venture', id: venture.id, name: venture.name, slug: venture.slug, status: venture.status })}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button variant="secondary" size="sm" className="text-red-600!" onClick={() => setDeleting({ kind: 'venture', id: venture.id, name: venture.name, force: false })}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
                <Button size="sm" onClick={() => setEditing({ kind: 'department', parentId: venture.id, name: '', slug: '', status: 'active' })}>
                  <Plus className="w-3.5 h-3.5" /> Department
                </Button>
              </div>

              {venture.departments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d4d4d8] bg-white/60 px-6 py-12 text-center text-xs text-[#71717a]">
                  No departments in {venture.name} yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {venture.departments.map((d) => (
                    <DepartmentCard
                      key={d.id}
                      venture={venture}
                      department={d}
                      onEdit={setEditing}
                      onDelete={(kind, id, name) => setDeleting({ kind, id, name, force: false })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {editing && (
        <EntityDialog
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            toast(`${editing.name || 'Item'} saved`);
            setEditing(null);
            catalog.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        description={
          deleting?.message ? (
            <span className="block space-y-2">
              <span className="block text-amber-800">{deleting.message}</span>
              <span className="block">Delete anyway? Everything inside it and all related access is removed permanently.</span>
            </span>
          ) : (
            `This permanently deletes the ${deleting ? KIND_LABEL[deleting.kind] : ''}. Consider marking it inactive instead.`
          )
        }
        confirmLabel={deleting?.force ? 'Delete everything' : 'Delete'}
        destructive
        loading={busy}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}

export default function DevPage() {
  const session = useAsync(() => api.dev.me(), []);
  const [loggedOut, setLoggedOut] = useState(false);

  if (session.loading && !session.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <Loader2 className="w-5 h-5 animate-spin text-white/60" />
      </div>
    );
  }

  if (!session.data || loggedOut) {
    return (
      <DevLogin
        onDone={() => {
          setLoggedOut(false);
          session.reload();
        }}
      />
    );
  }

  return (
    <Console
      username={session.data.username}
      onLogout={async () => {
        await api.dev.logout().catch(() => {});
        session.setData(null);
        setLoggedOut(true);
      }}
    />
  );
}
