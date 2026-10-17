'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { Loader2, Menu, ShieldX } from 'lucide-react';
import { useAuth, AuthContextType } from '@/context/auth-context';
import { Sidebar } from './sidebar';

interface AppShellProps {
  children: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Return false to show a "no access" screen instead of the page. */
  allow?: (auth: AuthContextType) => boolean;
  /** Use the full content width (tables, matrices). */
  wide?: boolean;
}

export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#09090b] text-white flex items-center justify-center font-bold text-sm animate-pulse">
          M
        </div>
        <div className="flex items-center gap-2 text-xs text-[#71717a]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {label}
        </div>
      </div>
    </div>
  );
}

export function NoAccess({ title = 'You don’t have access to this page', message }: { title?: string; message: ReactNode }) {
  const { activeVenture } = useAuth();
  return (
    <div className="max-w-md mx-auto mt-16 text-center bg-white border border-[#e4e4e7] rounded-2xl p-8 shadow-xs">
      <div className="w-11 h-11 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto mb-4">
        <ShieldX className="w-5 h-5" />
      </div>
      <h2 className="text-sm font-semibold text-[#09090b]">{title}</h2>
      <p className="text-xs text-[#71717a] leading-relaxed mt-1.5 mb-5">{message}</p>
      <Link
        href={activeVenture ? `/${activeVenture.slug}` : '/'}
        className="inline-flex items-center h-8 px-3.5 rounded-lg bg-[#09090b] text-white text-xs font-medium hover:bg-[#27272a]"
      >
        Back to home
      </Link>
    </div>
  );
}

export function AppShell({ children, title, description, actions, allow, wide = false }: AppShellProps) {
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (auth.isLoading) return <FullScreenLoader label="Signing you in…" />;
  if (!auth.user) return <FullScreenLoader label="Redirecting to sign in…" />;

  const allowed = allow ? allow(auth) : true;

  return (
    <div className="min-h-screen flex bg-[#fafafa]">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[#fafafa]/85 backdrop-blur border-b border-[#e4e4e7]">
          <div className={`${wide ? 'max-w-[1400px]' : 'max-w-6xl'} mx-auto px-4 sm:px-8 min-h-14 py-3 flex items-center gap-3`}>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden -ml-1 p-1.5 rounded-md text-[#52525b] hover:bg-[#f4f4f5] cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-semibold tracking-tight text-[#09090b] truncate">{title}</h1>
              {description && allowed && <p className="text-xs text-[#71717a] truncate hidden sm:block">{description}</p>}
            </div>
            {actions && allowed && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </header>
        <main className={`flex-1 w-full ${wide ? 'max-w-[1400px]' : 'max-w-6xl'} mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fade-in`}>
          {allowed ? (
            children
          ) : (
            <NoAccess message="This area is for administrators, department heads and team heads of the selected venture." />
          )}
        </main>
      </div>
    </div>
  );
}
