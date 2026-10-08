'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import {
  TrendingUp,
  Boxes,
  Target,
  Megaphone,
  ShieldCheck,
  Building2,
  Users2,
  ArrowUpRight,
  Network,
  Shield,
  Layers,
} from 'lucide-react';

export default function DashboardPage() {
  const {
    user,
    activeVenture,
    activeTeam,
    activeSections,
    ventures,
    isAdmin,
    hasEmployeeManagementAccess,
  } = useAuth();

  const getSectionDetails = (slug: string) => {
    switch (slug) {
      case 'sales':
        return {
          icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
          desc: 'Sales performance and venture pipeline',
        };
      case 'operations':
        return {
          icon: <Boxes className="w-5 h-5 text-blue-600" />,
          desc: 'Operational fulfillment and logistics oversight',
        };
      case 'orders':
        return {
          icon: <Boxes className="w-5 h-5 text-indigo-600" />,
          desc: 'Order dispatching and inventory tracking',
        };
      case 'nbd':
        return {
          icon: <Target className="w-5 h-5 text-violet-600" />,
          desc: 'New business development and strategic accounts',
        };
      case 'marketing':
        return {
          icon: <Megaphone className="w-5 h-5 text-amber-600" />,
          desc: 'Campaign management and venture brand reach',
        };
      case 'employees':
        return {
          icon: <Users2 className="w-5 h-5 text-blue-600" />,
          desc: 'Team personnel records and section access',
        };
      default:
        return {
          icon: <Building2 className="w-5 h-5 text-zinc-600" />,
          desc: 'Venture workspace section',
        };
    }
  };

  return (
    <AppShell
      title="Overview"
      description="MeDa Partners Operating System Central Hub"
    >
      <div className="space-y-8">
        {/* Top Status Banner */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#09090b] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#09090b] tracking-tight">
                  Welcome, {user?.name}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                    Global Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-[#71717a] mt-1">
                Signed in as <span className="font-mono text-[#09090b]">{user?.email}</span>
                {activeTeam && (
                  <>
                    {' '}· Team in {activeVenture?.name || 'Venture'}:{' '}
                    <strong className="text-[#09090b] font-medium">{activeTeam.name}</strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-xs">
              <span className="text-[10px] text-[#a1a1aa] block uppercase font-mono tracking-wider">
                Active Venture
              </span>
              <span className="font-medium text-[#09090b] flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-[#71717a]" />
                {activeVenture ? activeVenture.name : 'No Venture Selected'}
              </span>
            </div>

            <div className="px-3.5 py-2 bg-[#fafafa] border border-[#e4e4e7] rounded-lg text-xs">
              <span className="text-[10px] text-[#a1a1aa] block uppercase font-mono tracking-wider">
                Assigned Team
              </span>
              <span className="font-medium text-[#09090b] flex items-center gap-1.5 mt-0.5">
                <Users2 className="w-3.5 h-3.5 text-[#71717a]" />
                {isAdmin ? 'Administration' : activeTeam?.name || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Authorized Sections for Current Venture */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#09090b] tracking-tight">
                Workspaces in {activeVenture?.name || 'Active Venture'}
              </h3>
              <p className="text-xs text-[#71717a]">
                Sections you are granted access to within {activeVenture?.name || 'this venture'}
              </p>
            </div>
            <span className="text-xs font-mono text-[#71717a] bg-[#f4f4f5] px-2 py-1 rounded-md border border-[#e4e4e7]">
              {activeSections.length} accessible
            </span>
          </div>

          {activeSections.length === 0 ? (
            <div className="p-8 text-center bg-white border border-[#e4e4e7] rounded-xl text-xs text-[#71717a]">
              No business sections assigned to you in this venture yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSections.map((section) => {
                const details = getSectionDetails(section.slug);
                return (
                  <Link
                    key={section.id}
                    href={section.route}
                    className="p-5 bg-white hover:bg-[#fafafa] border border-[#e4e4e7] hover:border-[#d4d4d8] rounded-xl transition-all group flex flex-col justify-between shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-lg bg-[#fafafa] border border-[#f0f0f2]">
                          {details.icon}
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-[#a1a1aa] group-hover:text-[#09090b] transition-colors" />
                      </div>
                      <h4 className="text-sm font-semibold text-[#09090b] tracking-tight capitalize">
                        {section.name} Section
                      </h4>
                      <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
                        {details.desc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-[11px] font-mono text-[#a1a1aa]">
                      <span>Route: {section.route}</span>
                      <span className="text-[#09090b] font-medium group-hover:underline">
                        Open Workspace
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Dedicated Management Areas (Separate routes according to responsibility) */}
        {(hasEmployeeManagementAccess || isAdmin) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#09090b] tracking-tight">
                  Management Areas
                </h3>
                <p className="text-xs text-[#71717a]">
                  Dedicated governance sections separated by operational responsibility
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Employee Management: available to Admin and authorized managers */}
              {hasEmployeeManagementAccess && (
                <Link
                  href="/employees"
                  className="p-5 bg-white hover:bg-[#fafafa] border border-[#e4e4e7] hover:border-[#d4d4d8] rounded-xl transition-all group flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                        <Users2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#a1a1aa] group-hover:text-[#09090b] transition-colors" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#09090b] tracking-tight">
                      Employee Management
                    </h4>
                    <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
                      {isAdmin
                        ? 'Manage user records, team assignments, and section permissions across all ventures.'
                        : `Manage team employees and configure section access within ${activeVenture?.name || 'your venture'}.`}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
                    <span>Route: /employees</span>
                    <span className="text-[#09090b] font-medium group-hover:underline">
                      Manage Personnel
                    </span>
                  </div>
                </Link>
              )}

              {/* Team Management: Admin only */}
              {isAdmin && (
                <Link
                  href="/teams"
                  className="p-5 bg-white hover:bg-[#fafafa] border border-[#e4e4e7] hover:border-[#d4d4d8] rounded-xl transition-all group flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                        <Network className="w-5 h-5 text-indigo-600" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#a1a1aa] group-hover:text-[#09090b] transition-colors" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#09090b] tracking-tight">
                      Team Management
                    </h4>
                    <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
                      Configure organizational teams per venture. Define which functional teams exist inside each company.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
                    <span>Route: /teams</span>
                    <span className="text-[#09090b] font-medium group-hover:underline">
                      Configure Teams
                    </span>
                  </div>
                </Link>
              )}

              {/* Venture Management: Admin only */}
              {isAdmin && (
                <Link
                  href="/ventures"
                  className="p-5 bg-white hover:bg-[#fafafa] border border-[#e4e4e7] hover:border-[#d4d4d8] rounded-xl transition-all group flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#a1a1aa] group-hover:text-[#09090b] transition-colors" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#09090b] tracking-tight">
                      Venture Management
                    </h4>
                    <p className="text-xs text-[#71717a] mt-1 leading-relaxed">
                      Register new venture companies and configure which business sections are enabled for each venture.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0f0f2] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
                    <span>Route: /ventures</span>
                    <span className="text-[#09090b] font-medium group-hover:underline">
                      Configure Ventures
                    </span>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Assigned Ventures Overview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#09090b] tracking-tight">
                Venture Memberships
              </h3>
              <p className="text-xs text-[#71717a]">
                Ventures you belong to with your team role and section count
              </p>
            </div>
            <span className="text-xs font-mono text-[#71717a] bg-[#f4f4f5] px-2 py-1 rounded-md border border-[#e4e4e7]">
              {ventures.length} ventures
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ventures.map((m) => {
              const isSelected = activeVenture?.id === m.venture.id;
              return (
                <div
                  key={m.venture.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-white border-[#09090b] shadow-xs'
                      : 'bg-white border-[#e4e4e7]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#09090b]">
                      {m.venture.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-[#09090b] text-white">
                        Active Context
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#52525b] space-y-1">
                    <div>
                      Team:{' '}
                      <strong className="text-[#18181b]">{m.team.name}</strong>
                    </div>
                    <div className="text-[#71717a]">
                      Access: {m.sections.length} {(m.sections.length === 1 ? 'section' : 'sections')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Architecture & Security Verification Footer */}
        <div className="p-4 bg-[#f4f4f5] border border-[#e4e4e7] rounded-xl flex items-center justify-between text-xs text-[#52525b]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Venture-Scoped Security:</strong> User identity, team classification, and section access are enforced independently per venture by the Express backend.
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#a1a1aa] hidden sm:inline">
            MeDa Partners OS · v2.0
          </span>
        </div>
      </div>
    </AppShell>
  );
}
