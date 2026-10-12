'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { Menu, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onOpenMobile?: () => void;
}

export function Header({
  title,
  description,
  badge,
  icon,
  actions,
  onOpenMobile,
}: HeaderProps) {
  const { isAdmin, activeTeam } = useAuth();

  return (
    <header className="h-14 border-b border-[#e4e4e7] bg-white sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left side: Mobile Toggle + Page Icon + Page Title + Badge + Subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobile && (
          <button
            type="button"
            onClick={onOpenMobile}
            className="lg:hidden p-1.5 text-[#71717a] hover:text-[#09090b] rounded-md transition-colors cursor-pointer shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {icon && (
          <div className="w-7 h-7 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0 shadow-2xs">
            {icon}
          </div>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-[#09090b] tracking-tight truncate">
            {title}
          </h1>
          {badge}
          {description && (
            <span className="hidden md:inline text-xs text-[#71717a] font-normal truncate max-w-md">
              — {description}
            </span>
          )}
        </div>
      </div>

      {/* Right side: Page Actions + Session Authority */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}

        {/* Minimal Session Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#f4f4f5] border border-[#e4e4e7] rounded-md text-[11px] font-mono text-[#52525b]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{isAdmin ? 'Admin' : `${activeTeam?.name || 'Member'}`}</span>
        </div>
      </div>
    </header>
  );
}
