'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Section } from '@/lib/api';
import {
  Sidebar as SidebarRoot,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuBadge,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  TrendingUp,
  Boxes,
  Package,
  Target,
  Megaphone,
  Users2,
  Building2,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  KeyRound,
  Check,
  User as UserIcon,
  ShieldCheck,
  Network,
  FolderTree,
  Layers,
  Terminal,
  Crown,
} from 'lucide-react';
import { ChangePasswordModal } from '../modals/change-password-modal';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface DepartmentSectionGroup {
  departmentId: string;
  departmentName: string;
  departmentSlug?: string;
  sections: Section[];
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const {
    user,
    ventures,
    allVentures,
    activeVenture,
    activeDepartment,
    activeTeam,
    activeSections,
    setActiveVentureId,
    isAdmin,
    isDepartmentHead,
    isTeamHead,
    hasEmployeeManagementAccess,
    logout,
  } = useAuth();

  const [ventureMenuOpen, setVentureMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [openDepartments, setOpenDepartments] = useState<Record<string, boolean>>({});

  // Map route slugs to distinctive, refined icons
  const getSectionIcon = (slug: string) => {
    switch (slug) {
      case 'sales':
        return <TrendingUp className="w-3.5 h-3.5 shrink-0 text-emerald-600" />;
      case 'operations':
        return <Boxes className="w-3.5 h-3.5 shrink-0 text-blue-600" />;
      case 'orders':
        return <Package className="w-3.5 h-3.5 shrink-0 text-indigo-600" />;
      case 'nbd':
        return <Target className="w-3.5 h-3.5 shrink-0 text-amber-600" />;
      case 'marketing':
        return <Megaphone className="w-3.5 h-3.5 shrink-0 text-pink-600" />;
      case 'employees':
        return <Users2 className="w-3.5 h-3.5 shrink-0 text-purple-600" />;
      default:
        return <Layers className="w-3.5 h-3.5 shrink-0 text-zinc-500" />;
    }
  };

  // Group sections by department
  const departmentGroups = useMemo<DepartmentSectionGroup[]>(() => {
    const groupsMap = new Map<string, DepartmentSectionGroup>();

    // Exclude 'employees' since it has its own prominent management hub
    const businessSections = activeSections.filter((s) => s.slug !== 'employees');

    for (const section of businessSections) {
      const deptId = section.departmentId || 'general';
      const deptName =
        section.departmentName ||
        (activeDepartment && activeDepartment.id === section.departmentId
          ? activeDepartment.name
          : null) ||
        'General';

      if (!groupsMap.has(deptId)) {
        groupsMap.set(deptId, {
          departmentId: deptId,
          departmentName: deptName,
          departmentSlug: section.departmentSlug,
          sections: [],
        });
      }

      groupsMap.get(deptId)!.sections.push(section);
    }

    return Array.from(groupsMap.values());
  }, [activeSections, activeDepartment]);

  // Toggle department collapsible section
  const toggleDepartment = (deptId: string) => {
    setOpenDepartments((prev) => ({
      ...prev,
      [deptId]: prev[deptId] !== undefined ? !prev[deptId] : false,
    }));
  };

  // Check if a department is open (default to true, always true if it contains active path)
  const isDeptOpen = (group: DepartmentSectionGroup) => {
    const containsActiveRoute = group.sections.some((s) => pathname.startsWith(s.route));
    if (containsActiveRoute) return true;
    return openDepartments[group.departmentId] ?? true;
  };

  // Available ventures for switcher
  const ventureOptions = isAdmin
    ? allVentures.length > 0
      ? allVentures
      : ventures.map((m) => m.venture)
    : ventures.map((m) => m.venture);

  return (
    <>
      <SidebarRoot mobileOpen={mobileOpen} onCloseMobile={onCloseMobile}>
        {/* TOP: BRAND & VENTURE SWITCHER */}
        <SidebarHeader>
          {/* Logo / Brand Header */}
          <div className="flex items-center justify-between px-1 pt-1 pb-2 border-b border-[#f0f0f2]">
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              onClick={onCloseMobile}
            >
              <div className="w-7 h-7 rounded-lg bg-[#09090b] text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-xs">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold tracking-tight text-[#09090b] flex items-center gap-1.5">
                  MeDa Partners
                  <span className="text-[10px] font-mono px-1 py-0.2 bg-[#f4f4f5] text-[#71717a] rounded-sm font-normal">
                    OS
                  </span>
                </span>
                <span className="text-[10px] text-[#a1a1aa] tracking-tight">
                  Multi-Venture Platform
                </span>
              </div>
            </Link>
          </div>

          {/* Active Venture Switcher (shadcn Team Switcher Pattern) */}
          <div className="relative pt-1">
            <button
              type="button"
              onClick={() => setVentureMenuOpen(!ventureMenuOpen)}
              className="w-full p-2 bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg text-left flex items-center justify-between transition-all group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-[#09090b] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {activeVenture ? activeVenture.name.slice(0, 2).toUpperCase() : <Building2 className="w-3.5 h-3.5" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-mono uppercase text-[#71717a] tracking-wider font-medium">
                    Active Venture
                  </span>
                  <span className="text-xs font-semibold text-[#09090b] truncate">
                    {activeVenture ? activeVenture.name : 'Select Venture'}
                  </span>
                </div>
              </div>
              <ChevronsUpDown className="w-3.5 h-3.5 text-[#71717a] shrink-0 group-hover:text-[#09090b] transition-colors" />
            </button>

            {/* Dropdown Menu */}
            {ventureMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#e4e4e7] rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-mono text-[#71717a] uppercase tracking-wider border-b border-[#f0f0f2] flex items-center justify-between">
                  <span>{isAdmin ? 'All Ventures (Admin)' : 'Assigned Ventures'}</span>
                  <span className="text-[9px]">{ventureOptions.length}</span>
                </div>

                {ventureOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#a1a1aa] italic">
                    No ventures assigned
                  </div>
                ) : (
                  ventureOptions.map((v) => {
                    const isSelected = activeVenture?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setActiveVentureId(v.id);
                          setVentureMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-xs text-left flex items-center justify-between hover:bg-[#f4f4f5] transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-[#09090b] font-medium bg-[#fafafa]'
                            : 'text-[#52525b]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                          <span className="truncate">{v.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#09090b] shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Active Venture Context Pill */}
            <div className="mt-2 px-1 text-[11px] text-[#71717a] flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#a1a1aa] uppercase tracking-wider">
                Scope
              </span>
              <span className="font-medium text-[#09090b] bg-[#f4f4f5] px-1.5 py-0.5 rounded-sm border border-[#e4e4e7] truncate max-w-[150px] text-[10px]">
                {isAdmin
                  ? 'Global Admin'
                  : isDepartmentHead
                  ? `Head • ${activeDepartment?.name || 'Dept'}`
                  : isTeamHead
                  ? `Lead • ${activeTeam?.name || 'Team'}`
                  : activeDepartment?.name || 'Assigned'}
              </span>
            </div>
          </div>
        </SidebarHeader>

        {/* MIDDLE: SCROLLABLE NAVIGATION CONTENT */}
        <SidebarContent>
          {/* GROUP: PLATFORM OVERVIEW */}
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href="/" onClick={onCloseMobile}>
                    <SidebarMenuButton isActive={pathname === '/'}>
                      <LayoutDashboard className="w-4 h-4 shrink-0" />
                      <span>Overview</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* GROUP: DEPARTMENTS & SECTIONS HIERARCHY */}
          <SidebarGroup>
            <SidebarGroupLabel
              badge={
                activeSections.length > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-sm bg-[#f4f4f5] text-[#71717a] border border-[#e4e4e7]">
                    {activeSections.filter((s) => s.slug !== 'employees').length}
                  </span>
                ) : null
              }
            >
              Departments
            </SidebarGroupLabel>

            <SidebarGroupContent>
              {departmentGroups.length === 0 ? (
                <div className="px-3 py-3 text-xs text-[#71717a] bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-center">
                  <span>No sections enabled in this venture.</span>
                </div>
              ) : (
                <SidebarMenu>
                  {departmentGroups.map((group) => {
                    const open = isDeptOpen(group);
                    const containsActive = group.sections.some((s) =>
                      pathname.startsWith(s.route)
                    );

                    return (
                      <SidebarMenuItem key={group.departmentId}>
                        {/* Department Header / Accordion Trigger */}
                        <SidebarMenuButton
                          size="sm"
                          onClick={() => toggleDepartment(group.departmentId)}
                          className={`justify-between ${
                            containsActive
                              ? 'text-[#09090b] font-semibold bg-[#fafafa]'
                              : 'text-[#3f3f46]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderTree className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate">{group.departmentName}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <SidebarMenuBadge>{group.sections.length}</SidebarMenuBadge>
                            <ChevronDown
                              className={`w-3 h-3 text-[#71717a] transition-transform duration-200 ${
                                open ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                        </SidebarMenuButton>

                        {/* Department Sections List (Indented Tree Rail) */}
                        {open && (
                          <SidebarMenuSub>
                            {group.sections.map((section) => {
                              const isActive = pathname.startsWith(section.route);

                              return (
                                <SidebarMenuSubItem key={section.id}>
                                  <Link
                                    href={section.route}
                                    onClick={onCloseMobile}
                                    className="block"
                                  >
                                    <SidebarMenuSubButton isActive={isActive}>
                                      {getSectionIcon(section.slug)}
                                      <span className="truncate capitalize">
                                        {section.name}
                                      </span>
                                      {isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#09090b] ml-auto shrink-0" />
                                      )}
                                    </SidebarMenuSubButton>
                                  </Link>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          {/* GROUP: MANAGEMENT (Admins, Department Heads, Team Heads) */}
          {(hasEmployeeManagementAccess || isAdmin || isDepartmentHead || isTeamHead) && (
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Employees */}
                  {hasEmployeeManagementAccess && (
                    <SidebarMenuItem>
                      <Link href="/employees" onClick={onCloseMobile}>
                        <SidebarMenuButton isActive={pathname.startsWith('/employees')}>
                          <Users2 className="w-4 h-4 shrink-0" />
                          <span>Employees</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  )}

                  {/* Departments */}
                  {(isAdmin || isDepartmentHead) && (
                    <SidebarMenuItem>
                      <Link href="/departments" onClick={onCloseMobile}>
                        <SidebarMenuButton isActive={pathname.startsWith('/departments')}>
                          <FolderTree className="w-4 h-4 shrink-0" />
                          <span>Departments</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  )}

                  {/* Teams */}
                  {(isAdmin || isDepartmentHead || isTeamHead) && (
                    <SidebarMenuItem>
                      <Link href="/teams" onClick={onCloseMobile}>
                        <SidebarMenuButton isActive={pathname.startsWith('/teams')}>
                          <Network className="w-4 h-4 shrink-0" />
                          <span>Teams</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  )}

                  {/* Sections */}
                  {(isAdmin || isDepartmentHead) && (
                    <SidebarMenuItem>
                      <Link href="/sections" onClick={onCloseMobile}>
                        <SidebarMenuButton isActive={pathname.startsWith('/sections')}>
                          <Layers className="w-4 h-4 shrink-0" />
                          <span>Sections</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  )}

                  {/* Ventures (Admin Only) */}
                  {isAdmin && (
                    <SidebarMenuItem>
                      <Link href="/ventures" onClick={onCloseMobile}>
                        <SidebarMenuButton isActive={pathname.startsWith('/ventures')}>
                          <Building2 className="w-4 h-4 shrink-0" />
                          <span>Ventures</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* GROUP: DEVELOPER ARCHITECTURE */}
          <SidebarGroup>
            <SidebarGroupLabel>Developer</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href="/dev" onClick={onCloseMobile}>
                    <SidebarMenuButton isActive={pathname.startsWith('/dev')}>
                      <Terminal className="w-4 h-4 shrink-0 text-purple-600" />
                      <span>Dev Catalog</span>
                      <SidebarMenuBadge className="text-purple-700 bg-purple-50 border-purple-200">
                        Admin
                      </SidebarMenuBadge>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* BOTTOM: USER PROFILE & SESSION FOOTER */}
        <SidebarFooter>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#18181b] text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-2xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-[#09090b] truncate">
                    {user?.name || 'User'}
                  </span>
                  {isAdmin && (
                    <span title="Global Administrator">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    </span>
                  )}
                  {isDepartmentHead && !isAdmin && (
                    <span title="Department Head">
                      <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#71717a] truncate">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>

          <SidebarSeparator className="my-1" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setChangePasswordOpen(true)}
              title="Change Password"
              className="flex-1 px-2 py-1.5 text-[11px] font-medium text-[#52525b] hover:text-[#09090b] hover:bg-white border border-transparent hover:border-[#e4e4e7] rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#71717a]" />
              <span>Password</span>
            </button>

            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </SidebarFooter>
      </SidebarRoot>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
