'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import {
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ChevronDown,
  Info,
  ArrowUpRight,
} from 'lucide-react';

// Circular SVG Progress Gauge matching Vercel's exact Usage donut rings
function CircularGauge({
  percentage,
  size = 14,
  strokeWidth = 2.2,
  color = '#0284c7',
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="#e4e4e7"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
    </svg>
  );
}

// Vercel live status ring checkmark
function VercelStatusCheck() {
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <div className="w-5 h-5 rounded-full border border-sky-300/80 bg-sky-50/60 flex items-center justify-center text-sky-700 shadow-2xs">
        <svg
          className="w-2.5 h-2.5"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="2.5 6 4.8 8.5 9.5 3.5" />
        </svg>
      </div>
    </div>
  );
}

// GitHub Mark Icon
function GitHubIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const { activeVenture, activeSections } = useAuth();

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterBarOpen, setFilterBarOpen] = useState(false);
  const [usageExpanded, setUsageExpanded] = useState(false);

  // Available departments in current venture
  const departmentsInVenture = useMemo(() => {
    const map = new Map<string, string>();
    activeSections.forEach((s) => {
      if (s.departmentId && s.departmentName) {
        map.set(s.departmentId, s.departmentName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [activeSections]);

  // Filter sections by search and department
  const filteredSections = useMemo(() => {
    const businessSections = activeSections.filter((s) => s.slug !== 'employees');
    let list = businessSections;

    if (filterDept !== 'all') {
      list = list.filter((s) => s.departmentId === filterDept);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.departmentName && s.departmentName.toLowerCase().includes(q))
    );
  }, [activeSections, filterDept, search]);

  // Section activity commit lines (Vercel git style)
  const getSectionActivity = (slug: string) => {
    switch (slug) {
      case 'sales':
        return {
          commit: 'feat(sales): pipeline revenue conversion tracking and forecast sync',
          time: '3m ago',
          author: 'varun-space/MedaOS',
        };
      case 'operations':
        return {
          commit: 'feat(ops): inventory fulfillment matrix & vendor handoff telemetry',
          time: '14m ago',
          author: 'varun-space/MedaOS',
        };
      case 'orders':
        return {
          commit: 'fix(orders): dispatch webhook retry logic and SLA alert threshold',
          time: '1h ago',
          author: 'varun-space/MedaOS',
        };
      case 'nbd':
        return {
          commit: 'feat(nbd): client acquisition scoring and key account onboarding',
          time: '4h ago',
          author: 'varun-space/MedaOS',
        };
      case 'marketing':
        return {
          commit: 'feat(mkt): campaign attribution channel ROI and conversion audit',
          time: '1d ago',
          author: 'varun-space/MedaOS',
        };
      default:
        return {
          commit: 'chore(config): synchronize venture department permissions & routing',
          time: '2d ago',
          author: 'varun-space/MedaOS',
        };
    }
  };

  return (
    <AppShell
      icon={<LayoutGrid className="w-3.5 h-3.5" />}
      title="Overview"
      description="Workspaces, operational telemetry, and venture pipeline"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* VERCEL TOOLBAR: SEARCH INPUT + SHORTCUT BADGE + FILTER & VIEW TOGGLES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Projects..."
              className="w-full h-9 pl-9 pr-8 text-xs bg-white border border-[#e4e4e7] rounded-lg placeholder:text-[#a1a1aa] text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] transition-all shadow-2xs"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[#a1a1aa] bg-[#fafafa] border border-[#e4e4e7] px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
              /
            </kbd>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setFilterBarOpen(!filterBarOpen)}
              className={`h-9 px-3 text-xs font-medium border rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                filterBarOpen || filterDept !== 'all'
                  ? 'bg-[#09090b] text-white border-[#09090b]'
                  : 'bg-white text-[#71717a] hover:text-[#09090b] border-[#e4e4e7] hover:border-[#a1a1aa]'
              }`}
              title="Filter by department"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {filterDept !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* View Mode Switcher (Grid vs List) */}
            <div className="flex items-center bg-white border border-[#e4e4e7] rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#09090b] text-white shadow-xs'
                    : 'text-[#71717a] hover:text-[#09090b]'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#09090b] text-white shadow-xs'
                    : 'text-[#71717a] hover:text-[#09090b]'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar disclosure */}
        {filterBarOpen && (
          <div className="p-3 bg-white border border-[#e4e4e7] rounded-xl flex items-center gap-3 text-xs shadow-2xs animate-in fade-in duration-100">
            <span className="text-[#71717a] font-medium shrink-0">Filter Department:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterDept('all')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  filterDept === 'all'
                    ? 'bg-[#09090b] text-white'
                    : 'bg-[#fafafa] text-[#71717a] hover:text-[#09090b] border border-[#e4e4e7]'
                }`}
              >
                All Departments
              </button>
              {departmentsInVenture.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setFilterDept(d.id)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    filterDept === d.id
                      ? 'bg-[#09090b] text-white'
                      : 'bg-[#fafafa] text-[#71717a] hover:text-[#09090b] border border-[#e4e4e7]'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MAIN TWO-COLUMN SPLIT: USAGE + ALERTS ON LEFT, PROJECTS ON RIGHT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: USAGE CARD & ALERTS CARD */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. VERCEL USAGE CARD */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#09090b] tracking-tight">Usage</h3>
              <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-2xs">
                {/* Header Row: Last 30 days & Upgrade Button */}
                <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
                  <span className="text-xs font-semibold text-[#09090b]">Last 30 days</span>
                  <button
                    type="button"
                    className="px-3 py-1 bg-[#09090b] hover:bg-black text-white text-[11px] font-semibold rounded-full transition-colors cursor-pointer shadow-2xs"
                  >
                    Upgrade
                  </button>
                </div>

                {/* Donut progress meters */}
                <div className="space-y-3 pt-3.5 text-xs">
                  {/* Metric 1 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#3f3f46]">
                      <CircularGauge percentage={8} color="#0284c7" />
                      <span className="flex items-center gap-1">
                        Fluid Active CPU
                        <Info className="w-3 h-3 text-[#a1a1aa]" />
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#71717a]">1m 59s / 4h</span>
                  </div>

                  {/* Metric 2 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#3f3f46]">
                      <CircularGauge percentage={15} color="#0284c7" />
                      <span className="flex items-center gap-1">
                        Image Optimization - Transformations
                        <Info className="w-3 h-3 text-[#a1a1aa]" />
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#71717a]">34 / 5K</span>
                  </div>

                  {/* Metric 3 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#3f3f46]">
                      <CircularGauge percentage={5} color="#0284c7" />
                      <span className="flex items-center gap-1">
                        CDN Requests
                        <Info className="w-3 h-3 text-[#a1a1aa]" />
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#71717a]">4.5K / 1M</span>
                  </div>

                  {/* Metric 4 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#3f3f46]">
                      <CircularGauge percentage={4} color="#0284c7" />
                      <span className="flex items-center gap-1">
                        Deployment Storage
                        <Info className="w-3 h-3 text-[#a1a1aa]" />
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#71717a]">37.57 MB / 10 GB</span>
                  </div>

                  {/* Expanded Telemetry */}
                  {usageExpanded && (
                    <div className="pt-2 border-t border-[#f0f0f2] space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#3f3f46]">
                          <CircularGauge
                            percentage={Math.min(100, activeSections.length * 20)}
                            color="#10b981"
                          />
                          <span>Active Workspaces</span>
                        </div>
                        <span className="font-mono text-[11px] text-[#71717a]">
                          {activeSections.length} sections
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#3f3f46]">
                          <CircularGauge percentage={100} color="#8b5cf6" />
                          <span>PostgreSQL Engine</span>
                        </div>
                        <span className="font-mono text-[11px] text-[#71717a]">Neon / Pool</span>
                      </div>
                    </div>
                  )}

                  {/* Expand Chevron */}
                  <div className="pt-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setUsageExpanded(!usageExpanded)}
                      className="p-1 text-[#a1a1aa] hover:text-[#09090b] transition-colors cursor-pointer"
                      title={usageExpanded ? 'Collapse' : 'Expand'}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          usageExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. VERCEL ALERTS CARD */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[#09090b] tracking-tight">Alerts</h3>
              <div className="bg-white border border-[#e4e4e7] rounded-xl p-6 text-center shadow-2xs space-y-3">
                <h4 className="text-xs font-semibold text-[#09090b] tracking-tight">
                  Get alerted for anomalies
                </h4>
                <p className="text-[11px] text-[#71717a] leading-relaxed max-w-xs mx-auto">
                  Automatically monitor your projects for anomalies and get notified.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    className="px-4 py-1.5 text-xs font-medium text-[#09090b] bg-white hover:bg-[#fafafa] border border-[#e4e4e7] hover:border-[#a1a1aa] rounded-lg transition-all cursor-pointer shadow-2xs"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: VERCEL PROJECT CARDS */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#09090b] tracking-tight">Projects</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f4f4f5] text-[#71717a] border border-[#e4e4e7]">
                  {filteredSections.length + 1}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#71717a]">
                {activeVenture?.name || 'All Projects'}
              </span>
            </div>

            {/* GRID VIEW */}
            {viewMode === 'grid' ? (
              <div className="space-y-3">
                {/* 1. PRIMARY MEDA-OS CARD (Matching Screenshot's meda-os project card) */}
                <div className="p-4 bg-white hover:bg-[#fafafa] border border-[#e4e4e7] hover:border-[#a1a1aa] rounded-xl transition-all shadow-2xs hover:shadow-xs group">
                  {/* Top Row: Icon + Title + Status */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Vercel Black Circle with White Triangle Logo */}
                      <div className="w-8 h-8 rounded-full bg-[#09090b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        ▲
                      </div>
                      <div className="flex flex-col min-w-0">
                        <Link
                          href="/"
                          className="text-sm font-semibold text-[#09090b] tracking-tight hover:underline truncate"
                        >
                          meda-os
                        </Link>
                        <span className="text-xs text-[#71717a] hover:text-[#09090b] font-normal truncate">
                          meda-os.vercel.app
                        </span>
                      </div>
                    </div>

                    {/* Vercel status ring */}
                    <VercelStatusCheck />
                  </div>

                  {/* Git commit activity row */}
                  <div className="pt-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-[#09090b] font-medium">
                      <span className="text-[#a1a1aa] font-mono text-[11px] shrink-0">-o-</span>
                      <span className="truncate">
                        feat(ui): implement shadcn sidebar with department-to-section hierarchical
                        navigation
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] pl-4">
                      <GitHubIcon className="w-3 h-3 text-[#71717a]" />
                      <span>varun-space/MedaOS · 2m ago</span>
                    </div>
                  </div>
                </div>

                {/* 2. SECTION WORKSPACE CARDS (Sales, Operations, Orders, etc.) */}
                {filteredSections.map((section, idx) => {
                  const activity = getSectionActivity(section.slug);
                  // Use 'N' for Next.js app or initial lettermark
                  const monogram = idx % 2 === 0 ? 'N' : section.name.slice(0, 1).toUpperCase();

                  return (
                    <div
                      key={section.id}
                      className="p-4 bg-white hover:bg-[#fafafa] border border-[#e4e4e7] hover:border-[#a1a1aa] rounded-xl transition-all shadow-2xs hover:shadow-xs group"
                    >
                      {/* Top Row: Icon + Title + Status */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Circular logo */}
                          <div className="w-8 h-8 rounded-full bg-[#09090b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {monogram}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <Link
                              href={section.route}
                              className="text-sm font-semibold text-[#09090b] tracking-tight hover:underline truncate capitalize"
                            >
                              {section.name}
                            </Link>
                            <span className="text-xs text-[#71717a] hover:text-[#09090b] font-normal truncate">
                              {section.slug}.vercel.app
                            </span>
                          </div>
                        </div>

                        {/* Vercel status ring */}
                        <VercelStatusCheck />
                      </div>

                      {/* Git commit activity row */}
                      <div className="pt-2 text-xs space-y-1">
                        <div className="flex items-center gap-2 text-[#09090b] font-medium">
                          <span className="text-[#a1a1aa] font-mono text-[11px] shrink-0">-o-</span>
                          <span className="truncate">{activity.commit}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#71717a] pl-4">
                          <div className="flex items-center gap-1.5 truncate">
                            <GitHubIcon className="w-3 h-3 text-[#71717a] shrink-0" />
                            <span className="truncate">
                              {activity.author} · {activity.time}
                            </span>
                          </div>
                          <Link
                            href={section.route}
                            className="font-medium text-[#09090b] hover:underline shrink-0 ml-2 inline-flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="w-3 h-3 text-[#71717a]" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="bg-white border border-[#e4e4e7] rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fafafa] border-b border-[#e4e4e7] text-[10px] font-mono uppercase text-[#71717a]">
                    <tr>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Domain</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5]">
                    <tr className="hover:bg-[#fafafa] transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#09090b]">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#09090b] text-white flex items-center justify-center text-[10px] font-bold">
                            ▲
                          </div>
                          <span>meda-os</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#71717a]">
                        meda-os.vercel.app
                      </td>
                      <td className="px-4 py-3 text-[#71717a]">Core Platform</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sky-700 font-medium">
                          <VercelStatusCheck />
                          <span className="text-[11px]">Active</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href="/"
                          className="text-xs font-medium text-sky-700 hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Open</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                    {filteredSections.map((section, idx) => (
                      <tr key={section.id} className="hover:bg-[#fafafa] transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#09090b]">
                          <Link href={section.route} className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-[#09090b] text-white flex items-center justify-center text-[10px] font-bold">
                              {idx % 2 === 0 ? 'N' : section.name.slice(0, 1).toUpperCase()}
                            </div>
                            <span className="capitalize">{section.name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[#71717a]">
                          {section.slug}.vercel.app
                        </td>
                        <td className="px-4 py-3 text-[#71717a]">
                          {section.departmentName || 'General'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sky-700 font-medium">
                            <VercelStatusCheck />
                            <span className="text-[11px]">Active</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={section.route}
                            className="text-xs font-medium text-sky-700 hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
