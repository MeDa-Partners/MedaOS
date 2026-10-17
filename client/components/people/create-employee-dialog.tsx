'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import { api, Employee, errorMessage } from '@/lib/api';
import { VentureOrg } from '@/lib/use-org';
import { useAuth } from '@/context/auth-context';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, Checkbox, Field, Select } from '@/components/ui/form';
import { generatePassword } from './password';

/**
 * Admins can create anyone (optionally outside a department); department heads only
 * inside the departments they lead. The server enforces the same rules.
 */
export function CreateEmployeeDialog({
  open,
  venture,
  org,
  onClose,
  onCreated,
}: {
  open: boolean;
  venture: { id: string; name: string };
  org: VentureOrg;
  onClose: () => void;
  onCreated: (employee: Employee) => void;
}) {
  const { isAdmin } = useAuth();
  const departments = useMemo(() => org.departments.filter((d) => d.canManage && d.status === 'active'), [org.departments]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [departmentId, setDepartmentId] = useState(departments.length === 1 ? departments[0].id : '');
  const [teamId, setTeamId] = useState('');
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const teams = org.teams.filter((t) => t.departmentId === departmentId && t.status === 'active');
  const sections = org.sections.filter((s) => s.departmentId === departmentId);

  const reset = () => {
    setName('');
    setEmail('');
    setPassword(generatePassword());
    setDepartmentId(departments.length === 1 ? departments[0].id : '');
    setTeamId('');
    setSectionIds([]);
    setError(null);
    setCreated(null);
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!name.trim() || !email.trim()) return setError('Name and email are required.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (!isAdmin && !departmentId) return setError('Choose a department.');
    setSaving(true);
    setError(null);
    try {
      const employee = await api.employees.create({
        name: name.trim(),
        email: email.trim(),
        password,
        departmentId: departmentId || undefined,
        teamId: teamId || null,
        sectionIds,
      });
      onCreated(employee);
      setCreated({ name: employee.name, email: employee.email, password });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    const credentials = `Email: ${created.email}\nPassword: ${created.password}`;
    return (
      <Dialog
        open={open}
        onClose={close}
        title={`${created.name} can now sign in`}
        description="Share these sign-in details privately. They can change the password from their profile menu."
        footer={
          <>
            <Button variant="secondary" onClick={reset}>
              Add another
            </Button>
            <Button onClick={close}>Done</Button>
          </>
        }
      >
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 mb-3">
            <CheckCircle2 className="w-4 h-4" /> Account created
          </div>
          <pre className="text-xs font-mono text-[#09090b] whitespace-pre-wrap">{credentials}</pre>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              navigator.clipboard?.writeText(credentials).then(() => setCopied(true)).catch(() => {});
            }}
          >
            <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy details'}
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title={`Add employee to ${venture.name}`}
      description="They’ll get their own login. Section access is given per person."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create employee
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {departments.length === 0 && !isAdmin && (
          <Alert tone="warning">You don’t head an active department in {venture.name}, so you can’t add employees here.</Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha Verma" autoFocus />
          </Field>
          <Field label="Work email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="asha@meda.partners" />
          </Field>
        </div>
        <Field label="Temporary password" hint="Generated for you. You’ll be able to copy it after creating the account.">
          <div className="flex gap-2">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
            <Button variant="secondary" type="button" onClick={() => setPassword(generatePassword())}>
              Regenerate
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Department">
            <Select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setTeamId('');
                setSectionIds([]);
              }}
            >
              <option value="">{isAdmin ? 'Not in a department yet' : 'Select department…'}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Team" hint={departmentId && teams.length === 0 ? 'This department has no teams yet.' : 'Optional. You can set it later.'}>
            <Select value={teamId} disabled={!departmentId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">No team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {departmentId && sections.length > 0 && (
          <Field label="Section access" hint="Optional. You can change this any time.">
            <div className="rounded-xl border border-[#e4e4e7] divide-y divide-[#f0f0f2] max-h-56 overflow-y-auto">
              {sections.map((s) => (
                <div key={s.id} className="px-1 py-0.5">
                  <Checkbox
                    checked={sectionIds.includes(s.id)}
                    onChange={(on) => setSectionIds((ids) => (on ? [...ids, s.id] : ids.filter((id) => id !== s.id)))}
                    label={s.name}
                    description={s.route}
                  />
                </div>
              ))}
            </div>
          </Field>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </Dialog>
  );
}
