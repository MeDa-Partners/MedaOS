'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  Folder,
  Home,
  KeyRound,
  LogOut,
  Network,
  ShieldCheck,
  Users,
  FolderTree,
  X,
} from 'lucide-react';
import { useAuth, ROLE_LABEL } from '@/context/auth-context';
import { SectionRef } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { ChangePasswordModal } from '@/components/modals/change-password-modal';

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] transition-colors ${
        active ? 'bg-[#f4f4f5] text-[#09090b] font-medium' : 'text-[#52525b] hover:bg-[#f4f4f5]/70 hover:text-[#09090b]'
      }`}
    >
      {Icon ? (
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#09090b]' : 'text-[#a1a1aa] group-hover:text-[#52525b]'}`} />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 mr-0.5 ${active ? 'bg-[#09090b]' : 'bg-[#d4d4d8]'}`} />
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{children}</div>;
}

function VentureSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { memberships, activeVenture, role, setActiveVenture } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!activeVenture) {
    return (
      <div className="mx-3 rounded-lg border border-dashed border-[#e4e4e7] px-3 py-2.5 text-[11px] text-[#71717a]">
        You are not part of any venture yet.
      </div>
    );
  }

  return (
    <div ref={ref} className="relative mx-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 rounded-lg border border-[#e4e4e7] bg-white px-2.5 py-2 text-left hover:border-[#d4d4d8] transition-colors cursor-pointer shadow-2xs"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Avatar name={activeVenture.name} seed={activeVenture.slug} size="md" square />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[#09090b] truncate">{activeVenture.name}</span>
          <span className="block text-[11px] text-[#71717a] truncate">{role ? ROLE_LABEL[role] : ''}</span>
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border border-[#e4e4e7] bg-white p-1 shadow-xl animate-pop-in max-h-80 overflow-y-auto"
        >
          <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Ventures</div>
          {memberships.map((m) => {
            const selected = m.venture.id === activeVenture.id;
            return (
              <button
                key={m.venture.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setActiveVenture(m.venture.id);
                  setOpen(false);
                  onNavigate?.();
                  router.push(`/${m.venture.slug}`);
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-[#f4f4f5] cursor-pointer"
              >
                <Avatar name={m.venture.name} seed={m.venture.slug} size="sm" square />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-[#09090b] truncate">{m.venture.name}</span>
                  <span className="block text-[10px] text-[#71717a] truncate">
                    {m.department ? `${m.department.name}${m.team ? ` · ${m.team.name}` : ''}` : ROLE_LABEL[m.role]}
                  </span>
                </span>
                {selected && <Check className="w-3.5 h-3.5 text-[#09090b] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const pathname = usePathname();
  const { user, activeMembership, activeVenture, role, isAdmin, logout } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Departments the user has folded away in the sidebar (all open by default).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sectionGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; sections: SectionRef[] }>();
    for (const s of activeMembership?.sections ?? []) {
      const g = groups.get(s.departmentId) ?? { id: s.departmentId, name: s.departmentName, sections: [] };
      g.sections.push(s);
      groups.set(s.departmentId, g);
    }
    return [...groups.values()];
  }, [activeMembership]);

  const isLeaderHere = role === 'admin' || role === 'department_head' || role === 'team_head';
  const ventureHome = activeVenture ? `/${activeVenture.slug}` : '/';

  const content = (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center gap-2 px-4 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-[#09090b] text-white flex items-center justify-center text-xs font-bold tracking-tight">
          M
        </div>
        <span className="text-sm font-semibold tracking-tight text-[#09090b]">MeDa OS</span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden ml-auto p-1.5 rounded-md text-[#71717a] hover:bg-[#f4f4f5] cursor-pointer"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <VentureSwitcher onNavigate={onCloseMobile} />

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="pt-4">
          <NavLink href={ventureHome} icon={Home} label="Home" active={pathname === ventureHome || pathname === '/'} onNavigate={onCloseMobile} />
        </div>

        {sectionGroups.length === 0 ? (
          <>
            <GroupLabel>Sections</GroupLabel>
            <p className="px-2.5 text-[11px] text-[#a1a1aa] leading-relaxed">
              No sections yet. Your team or department head can give you access.
            </p>
          </>
        ) : (
          // One collapsible group per department, its sections nested below it.
          <div className="pt-4 space-y-0.5">
            {sectionGroups.map((group) => {
              const open = !collapsed.has(group.id);
              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={open}
                    className="group w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-[#52525b] hover:bg-[#f4f4f5]/70 hover:text-[#09090b] transition-colors cursor-pointer"
                  >
                    <Folder className="w-4 h-4 shrink-0 text-[#a1a1aa] group-hover:text-[#52525b]" />
                    <span className="truncate flex-1 text-left">{group.name}</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 text-[#a1a1aa] transition-transform ${open ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {open && (
                    <div className="ml-[17px] pl-2 border-l border-[#e4e4e7] mt-0.5 space-y-0.5">
                      {group.sections.map((s) => (
                        <NavLink
                          key={s.id}
                          href={s.route}
                          label={s.name}
                          active={pathname === s.route}
                          onNavigate={onCloseMobile}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isLeaderHere && (
          <>
            <GroupLabel>Manage</GroupLabel>
            <NavLink href="/employees" icon={Users} label="Employees" active={pathname.startsWith('/employees')} onNavigate={onCloseMobile} />
            <NavLink href="/access" icon={ShieldCheck} label="Section access" active={pathname.startsWith('/access')} onNavigate={onCloseMobile} />
            <NavLink href="/teams" icon={Network} label="Teams" active={pathname.startsWith('/teams')} onNavigate={onCloseMobile} />
            {(isAdmin || role === 'department_head') && (
              <NavLink href="/departments" icon={FolderTree} label="Departments" active={pathname.startsWith('/departments')} onNavigate={onCloseMobile} />
            )}
          </>
        )}
      </nav>

      {user && (
        <div className="relative border-t border-[#f0f0f2] p-3 shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#f4f4f5] text-left cursor-pointer"
          >
            <Avatar name={user.name} seed={user.id} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-[#09090b] truncate">{user.name}</span>
              <span className="block text-[11px] text-[#71717a] truncate">{user.email}</span>
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-[#a1a1aa]" />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-xl border border-[#e4e4e7] bg-white p-1 shadow-xl animate-pop-in">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setPasswordOpen(true);
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#09090b] hover:bg-[#f4f4f5] cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#71717a]" /> Change password
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      )}
      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-[#e4e4e7] bg-white h-screen sticky top-0">
        <div className="w-full">{content}</div>
      </aside>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl animate-slide-in-left">{content}</aside>
        </div>
      )}
    </>
  );
}
