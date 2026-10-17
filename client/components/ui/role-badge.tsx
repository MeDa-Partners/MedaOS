import { Crown, ShieldCheck, Star } from 'lucide-react';

export function RoleBadge({ role }: { role: 'admin' | 'department_head' | 'team_head' | 'member' }) {
  if (role === 'member') return null;
  const config = {
    admin: { label: 'Admin', icon: ShieldCheck, cls: 'bg-[#09090b] text-white border-transparent' },
    department_head: { label: 'Dept head', icon: Crown, cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    team_head: { label: 'Team head', icon: Star, cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  }[role];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium whitespace-nowrap ${config.cls}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function StatusDot({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#52525b]">
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}
