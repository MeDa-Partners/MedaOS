'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FolderTree, Layers, Network, ShieldCheck, Users } from 'lucide-react';
import { useAuth, ROLE_LABEL } from '@/context/auth-context';
import { AppShell, NoAccess } from '@/components/layout/app-shell';
import { SectionRef } from '@/lib/api';
import { isSectionModuleBuilt } from '@/sections/registry';
import { useVentureFromSlug } from '@/lib/use-venture';
import { RoleBadge } from '@/components/ui/role-badge';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function SectionCard({ section, ventureSlug }: { section: SectionRef; ventureSlug: string }) {
  const built = isSectionModuleBuilt(ventureSlug, section.slug);
  return (
    <Link
      href={section.route}
      className="group relative flex flex-col gap-3 rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-2xs transition-all hover:border-[#d4d4d8] hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#f4f4f5] border border-[#e4e4e7] flex items-center justify-center text-[#52525b] group-hover:bg-[#09090b] group-hover:text-white group-hover:border-[#09090b] transition-colors">
          <Layers className="w-4 h-4" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-[#d4d4d8] group-hover:text-[#09090b] transition-colors" />
      </div>
      <div>
        <div className="text-sm font-semibold text-[#09090b] tracking-tight">{section.name}</div>
        <div className="text-[11px] text-[#71717a] mt-0.5">{section.departmentName}</div>
      </div>
      {!built && (
        <span className="self-start text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
          Coming soon
        </span>
      )}
    </Link>
  );
}

function ManageCard({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-[#e4e4e7] bg-white p-4 hover:border-[#d4d4d8] hover:shadow-sm transition-all"
    >
      <div className="w-8 h-8 rounded-lg bg-[#f4f4f5] flex items-center justify-center text-[#52525b] shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[#09090b] flex items-center gap-1">
          {title}
          <ArrowUpRight className="w-3.5 h-3.5 text-[#d4d4d8] group-hover:text-[#09090b] transition-colors" />
        </div>
        <p className="text-xs text-[#71717a] leading-relaxed mt-0.5">{text}</p>
      </div>
    </Link>
  );
}

export default function VentureHomePage({ params }: { params: Promise<{ ventureSlug: string }> }) {
  const { ventureSlug } = use(params);
  const { user, isLoading } = useAuth();
  const { membership } = useVentureFromSlug(ventureSlug);

  const groups = useMemo(() => {
    const map = new Map<string, SectionRef[]>();
    for (const s of membership?.sections ?? []) map.set(s.departmentName, [...(map.get(s.departmentName) ?? []), s]);
    return [...map.entries()];
  }, [membership]);

  if (isLoading || !user) return <AppShell title="">{null}</AppShell>;

  if (!membership) {
    return (
      <AppShell title="Venture">
        <NoAccess title="Venture not available" message="This venture doesn’t exist, is disabled, or you are not a member of it." />
      </AppShell>
    );
  }

  const { role, department, team } = membership;
  const isLeader = role !== 'member';
  const firstName = user.name.split(' ')[0];

  return (
    <AppShell title={membership.venture.name} description="Workspace home">
      <section className="rounded-2xl border border-[#e4e4e7] bg-white p-6 sm:p-7 shadow-2xs">
        <p className="text-xs text-[#71717a]">{greeting()},</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#09090b] mt-0.5">{firstName}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <RoleBadge role={role} />
          {department && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f4f4f5] px-2 py-1 text-[#3f3f46]">
              <FolderTree className="w-3.5 h-3.5 text-[#71717a]" /> {department.name}
            </span>
          )}
          {department && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f4f4f5] px-2 py-1 text-[#3f3f46]">
              <Network className="w-3.5 h-3.5 text-[#71717a]" /> {team ? team.name : 'No team yet'}
            </span>
          )}
          {role === 'member' && <span className="text-[#71717a]">{ROLE_LABEL[role]}</span>}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#09090b]">Your sections</h3>
          <span className="text-xs text-[#71717a]">{membership.sections.length} available</span>
        </div>
        {membership.sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d4d4d8] bg-white/60 px-6 py-10 text-center">
            <Layers className="w-5 h-5 text-[#a1a1aa] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#09090b]">No sections yet</p>
            <p className="text-xs text-[#71717a] mt-1 max-w-sm mx-auto">
              Access is given per person. Ask your team head or department head to open the sections you need.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([deptName, list]) => (
              <div key={deptName}>
                {groups.length > 1 && <div className="text-xs font-medium text-[#71717a] mb-2">{deptName}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {list.map((s) => (
                    <SectionCard key={s.id} section={s} ventureSlug={ventureSlug} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isLeader && (
        <section className="mt-10">
          <h3 className="text-sm font-semibold text-[#09090b] mb-3">Manage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <ManageCard
              href="/employees"
              icon={Users}
              title="Employees"
              text={role === 'team_head' ? 'See the people in your team.' : 'Add people and place them in teams.'}
            />
            <ManageCard href="/access" icon={ShieldCheck} title="Section access" text="Decide who can open which section." />
            <ManageCard
              href="/teams"
              icon={Network}
              title="Teams"
              text={role === 'team_head' ? 'Your department’s teams.' : 'Create teams and appoint team heads.'}
            />
            {(role === 'admin' || role === 'department_head') && (
              <ManageCard href="/departments" icon={FolderTree} title="Departments" text="Department heads and structure." />
            )}
          </div>
        </section>
      )}
    </AppShell>
  );
}
