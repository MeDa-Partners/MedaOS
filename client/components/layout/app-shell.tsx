'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { ShieldX, ArrowLeft, Loader2, Building2 } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  requiredSectionSlug?: string;
  requireAdmin?: boolean;
  requireEmployeeManagement?: boolean;
}

export function AppShell({
  children,
  title,
  description,
  requiredSectionSlug,
  requireAdmin = false,
  requireEmployeeManagement = false,
}: AppShellProps) {
  const {
    user,
    activeVenture,
    activeTeam,
    activeSections,
    allSections,
    ventures,
    setActiveVentureId,
    isAdmin,
    hasEmployeeManagementAccess,
    isLoading,
  } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs animate-pulse">
            M
          </div>
          <div className="flex items-center gap-2 text-xs text-[#71717a] font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Resolving MeDa OS session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated check
  if (!user) {
    return null;
  }

  // 3. Section and Authorization guard checks:
  const isForbiddenAdmin = requireAdmin && !isAdmin;
  const isForbiddenEmployeeManagement =
    requireEmployeeManagement && !hasEmployeeManagementAccess;

  // Resolve section display metadata
  const sectionMeta = requiredSectionSlug
    ? allSections.find((s) => s.slug === requiredSectionSlug) ||
      activeVenture?.sections?.find((s) => s.slug === requiredSectionSlug)
    : null;
  const sectionDisplayName =
    sectionMeta?.name ||
    (requiredSectionSlug
      ? requiredSectionSlug.charAt(0).toUpperCase() + requiredSectionSlug.slice(1)
      : 'Requested');

  // Check 1: Does the active venture have this section enabled at all?
  // (If not assigned to the venture, neither employees nor admins can access it in this venture context)
  const ventureSections = activeVenture?.sections || [];
  const isSectionInVenture = requiredSectionSlug
    ? ventureSections.some((s) => s.slug === requiredSectionSlug)
    : true;

  // Check 2: If the section IS enabled in the venture, does this user have access?
  const isForbiddenSection =
    requiredSectionSlug &&
    isSectionInVenture &&
    !isAdmin &&
    !activeSections.some((s) => s.slug === requiredSectionSlug);

  // Check if another venture the user belongs to HAS this section enabled
  const otherVentureWithSection = requiredSectionSlug
    ? ventures.find(
        (m) =>
          m.venture.id !== activeVenture?.id &&
          (m.venture.sections || []).some((s) => s.slug === requiredSectionSlug)
      )
    : null;

  // Render Section Not in Venture State
  if (requiredSectionSlug && !isSectionInVenture) {
    return (
      <div className="min-h-screen flex bg-[#fafafa]">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            title="Section Not Assigned"
            onOpenMobile={() => setMobileSidebarOpen(true)}
          />
          <main className="flex-1 p-6 sm:p-10 flex items-center justify-center">
            <div className="max-w-md w-full bg-white border border-[#e4e4e7] rounded-xl p-8 shadow-xs text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <Building2 className="w-6 h-6" />
              </div>

              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200 mb-2">
                Not Assigned in {activeVenture?.name || 'Venture'}
              </span>

              <h2 className="text-base font-semibold text-[#09090b] tracking-tight mb-2">
                No Such Section in {activeVenture?.name || 'this venture'}
              </h2>

              <p className="text-xs text-[#71717a] leading-relaxed mb-6">
                The <strong className="text-[#09090b]">{sectionDisplayName}</strong> section is not assigned to or enabled for the <strong>{activeVenture?.name || 'active'}</strong> venture. In MeDa OS, organizational departments and workspaces are configured per venture.
              </p>

              <div className="p-3 bg-[#fafafa] border border-[#f0f0f2] rounded-lg text-left text-xs font-mono text-[#52525b] mb-6 space-y-1.5">
                <div>Active Venture: <span className="font-semibold text-zinc-900">{activeVenture?.name || 'None'}</span></div>
                <div>Requested Section: <span className="font-semibold text-zinc-900">{sectionDisplayName}</span> ({requiredSectionSlug})</div>
                <div>Status: <span className="text-amber-700 font-medium">Not Assigned to this Venture</span></div>

                {ventureSections.length > 0 && (
                  <div className="pt-2 border-t border-[#e4e4e7]">
                    <span className="text-[10px] uppercase font-mono text-[#71717a] block mb-1.5">
                      Available sections in {activeVenture?.name}:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {ventureSections.map((s) => (
                        <Link
                          key={s.id}
                          href={s.route}
                          className="px-2 py-0.5 rounded bg-white hover:bg-zinc-100 border border-[#e4e4e7] text-[11px] text-zinc-800 transition-colors"
                        >
                          {s.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {otherVentureWithSection && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-left text-xs text-blue-800 mb-5 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-semibold block">Available in {otherVentureWithSection.venture.name}</span>
                    <span className="text-[11px] text-blue-700">
                      You have access to this section in another venture.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveVentureId(otherVentureWithSection.venture.id)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all shrink-0 cursor-pointer shadow-2xs"
                  >
                    Switch Venture
                  </button>
                </div>
              )}

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Overview</span>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Render Access Forbidden State (Section exists in venture, but user does not have permission)
  if (isForbiddenAdmin || isForbiddenEmployeeManagement || isForbiddenSection) {
    return (
      <div className="min-h-screen flex bg-[#fafafa]">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            title="Access Denied"
            onOpenMobile={() => setMobileSidebarOpen(true)}
          />
          <main className="flex-1 p-6 sm:p-10 flex items-center justify-center">
            <div className="max-w-md w-full bg-white border border-[#e4e4e7] rounded-xl p-8 shadow-xs text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
                <ShieldX className="w-6 h-6" />
              </div>

              <h2 className="text-base font-semibold text-[#09090b] tracking-tight mb-2">
                403 — Access Not Granted
              </h2>

              <p className="text-xs text-[#71717a] leading-relaxed mb-6">
                Your account (<strong className="text-[#09090b]">{user.email}</strong>) does not have assigned permission to access the <strong className="text-[#09090b]">{sectionDisplayName}</strong> section in <strong>{activeVenture?.name || 'this venture'}</strong>.
              </p>

              <div className="p-3 bg-[#fafafa] border border-[#f0f0f2] rounded-lg text-left text-xs font-mono text-[#52525b] mb-6 space-y-1">
                <div>Identity: {user.email}</div>
                <div>Venture Context: {activeVenture?.name || 'None'}</div>
                <div>Assigned Team: {activeTeam?.name || 'Unassigned'}</div>
                <div>Authority: {isAdmin ? 'Global Administrator' : 'Venture Member'}</div>
                <div>Permission Status: <span className="text-red-600 font-medium">Access Not Assigned</span></div>
              </div>

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Overview</span>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // 4. Authorized render
  return (
    <div className="min-h-screen flex bg-[#fafafa]">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          description={description}
          onOpenMobile={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-150">
          {children}
        </main>
      </div>
    </div>
  );
}
