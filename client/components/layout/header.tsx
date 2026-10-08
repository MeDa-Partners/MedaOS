'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { Menu, ShieldCheck, Building2 } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
  onOpenMobile?: () => void;
}

export function Header({ title, description, onOpenMobile }: HeaderProps) {
  const { activeVenture, activeTeam, isAdmin } = useAuth();

  return (
    <header className="h-14 border-b border-[#e4e4e7] bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onOpenMobile && (
          <button
            type="button"
            onClick={onOpenMobile}
            className="lg:hidden p-1.5 text-[#71717a] hover:text-[#09090b] rounded-md transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col">
          <h1 className="text-sm font-semibold tracking-tight text-[#09090b]">
            {title}
          </h1>
          {description && (
            <span className="text-[11px] text-[#71717a] hidden sm:inline">
              {description}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Active Venture Pill */}
        {activeVenture && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#fafafa] border border-[#e4e4e7] rounded-full text-xs text-[#18181b] font-medium shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-[#71717a]" />
            <span className="truncate max-w-[140px] sm:max-w-[200px]">
              {activeVenture.name}
            </span>
          </div>
        )}

        {/* Security / Session Status Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-[#f4f4f5] border border-[#e4e4e7] rounded-full text-[11px] font-mono text-[#52525b]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {isAdmin ? 'Admin Authority' : `${activeTeam?.name || 'Venture'} Session`}
          </span>
        </div>
      </div>
    </header>
  );
}
