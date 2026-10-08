'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  LayoutDashboard,
  TrendingUp,
  Boxes,
  Target,
  Megaphone,
  Users2,
  FolderGit2,
  Building2,
  ChevronDown,
  LogOut,
  KeyRound,
  Check,
  User as UserIcon,
  ShieldCheck,
  Network,
} from 'lucide-react';
import { ChangePasswordModal } from '../modals/change-password-modal';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const {
    user,
    ventures,
    allVentures,
    activeVenture,
    activeTeam,
    activeSections,
    setActiveVentureId,
    isAdmin,
    hasEmployeeManagementAccess,
    logout,
  } = useAuth();

  const [ventureMenuOpen, setVentureMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Map route slugs to icons
  const getSectionIcon = (slug: string) => {
    switch (slug) {
      case 'sales':
        return <TrendingUp className="w-4 h-4 shrink-0" />;
      case 'operations':
        return <Boxes className="w-4 h-4 shrink-0" />;
      case 'orders':
        return <Boxes className="w-4 h-4 shrink-0" />;
      case 'nbd':
        return <Target className="w-4 h-4 shrink-0" />;
      case 'marketing':
        return <Megaphone className="w-4 h-4 shrink-0" />;
      case 'employees':
        return <Users2 className="w-4 h-4 shrink-0" />;
      default:
        return <LayoutDashboard className="w-4 h-4 shrink-0" />;
    }
  };

  // List of available ventures for the switcher
  const ventureOptions = isAdmin
    ? allVentures.length > 0
      ? allVentures
      : ventures.map((m) => m.venture)
    : ventures.map((m) => m.venture);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-[#e4e4e7] flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Branding, Venture Switcher, and Nav Links */}
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
          {/* Logo / Brand Header */}
          <div className="h-14 px-5 border-b border-[#f0f0f2] flex items-center justify-between shrink-0">
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

          {/* Active Venture Switcher */}
          <div className="p-3 border-b border-[#f0f0f2] shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setVentureMenuOpen(!ventureMenuOpen)}
                className="w-full px-3 py-2 bg-[#fafafa] hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg text-left flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-[#e4e4e7] flex items-center justify-center text-[#18181b] shrink-0">
                    <Building2 className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-[#a1a1aa] uppercase font-mono tracking-wider">
                      Active Venture
                    </span>
                    <span className="text-xs font-medium text-[#18181b] truncate">
                      {activeVenture ? activeVenture.name : 'Select Venture'}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#71717a] transition-transform ${
                    ventureMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Venture Dropdown Menu */}
              {ventureMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#e4e4e7] rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider border-b border-[#f0f0f2]">
                    {isAdmin ? 'All Ventures (Admin)' : 'Assigned Ventures'}
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
                          className={`w-full px-3 py-2 text-xs text-left flex items-center justify-between hover:bg-[#f4f4f5] transition-colors ${
                            isSelected
                              ? 'text-[#09090b] font-medium bg-[#fafafa]'
                              : 'text-[#52525b]'
                          }`}
                        >
                          <span className="truncate">{v.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#09090b]" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* User Team Badge in Active Venture */}
            <div className="mt-2 px-1 flex items-center justify-between text-[11px] text-[#71717a]">
              <span>Team in Venture</span>
              <span className="font-medium text-[#09090b] bg-[#f4f4f5] px-1.5 py-0.5 rounded-sm border border-[#e4e4e7] truncate max-w-[120px]">
                {isAdmin ? 'Administration' : activeTeam?.name || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">
              Navigation
            </div>

            {/* Dashboard / Home */}
            <Link
              href="/"
              onClick={onCloseMobile}
              className={`w-full px-2.5 py-2 text-xs rounded-lg flex items-center gap-2.5 transition-colors ${
                pathname === '/'
                  ? 'bg-[#09090b] text-white font-medium shadow-xs'
                  : 'text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Overview</span>
            </Link>

            {/* Venture Business Sections (filtered by activeSections) */}
            {activeSections
              .filter((s) => s.slug !== 'employees')
              .map((section) => {
                const isActive = pathname.startsWith(section.route);
                return (
                  <Link
                    key={section.id}
                    href={section.route}
                    onClick={onCloseMobile}
                    className={`w-full px-2.5 py-2 text-xs rounded-lg flex items-center gap-2.5 transition-colors ${
                      isActive
                        ? 'bg-[#09090b] text-white font-medium shadow-xs'
                        : 'text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5]'
                    }`}
                  >
                    {getSectionIcon(section.slug)}
                    <span className="capitalize">{section.name}</span>
                  </Link>
                );
              })}

            {/* Separate Management Areas */}
            {(hasEmployeeManagementAccess || isAdmin) && (
              <div className="pt-3 px-2 py-1 text-[10px] font-mono text-[#a1a1aa] uppercase tracking-wider">
                Management
              </div>
            )}

            {/* Employee Management: available to Admin and users with employees access */}
            {hasEmployeeManagementAccess && (
              <Link
                href="/employees"
                onClick={onCloseMobile}
                className={`w-full px-2.5 py-2 text-xs rounded-lg flex items-center gap-2.5 transition-colors ${
                  pathname.startsWith('/employees')
                    ? 'bg-[#09090b] text-white font-medium shadow-xs'
                    : 'text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5]'
                }`}
              >
                <Users2 className="w-4 h-4 shrink-0" />
                <span>Employees</span>
              </Link>
            )}

            {/* Team Management: Admin ONLY */}
            {isAdmin && (
              <Link
                href="/teams"
                onClick={onCloseMobile}
                className={`w-full px-2.5 py-2 text-xs rounded-lg flex items-center gap-2.5 transition-colors ${
                  pathname.startsWith('/teams')
                    ? 'bg-[#09090b] text-white font-medium shadow-xs'
                    : 'text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5]'
                }`}
              >
                <Network className="w-4 h-4 shrink-0" />
                <span>Teams</span>
              </Link>
            )}

            {/* Venture Management: Admin ONLY */}
            {isAdmin && (
              <Link
                href="/ventures"
                onClick={onCloseMobile}
                className={`w-full px-2.5 py-2 text-xs rounded-lg flex items-center gap-2.5 transition-colors ${
                  pathname.startsWith('/ventures')
                    ? 'bg-[#09090b] text-white font-medium shadow-xs'
                    : 'text-[#52525b] hover:text-[#09090b] hover:bg-[#f4f4f5]'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Ventures</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Bottom User Area */}
        <div className="p-3 border-t border-[#f0f0f2] bg-[#fafafa] shrink-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#18181b] text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-[#09090b] truncate">
                    {user?.name || 'User'}
                  </span>
                  {isAdmin && (
                    <span title="Global Administrator">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#71717a] truncate">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 pt-1">
            <button
              type="button"
              onClick={() => setChangePasswordOpen(true)}
              title="Change Password"
              className="flex-1 px-2 py-1.5 text-[11px] text-[#52525b] hover:text-[#09090b] hover:bg-white border border-transparent hover:border-[#e4e4e7] rounded-md transition-all flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#71717a]" />
              <span>Password</span>
            </button>

            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="px-2.5 py-1.5 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-md transition-all flex items-center justify-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
