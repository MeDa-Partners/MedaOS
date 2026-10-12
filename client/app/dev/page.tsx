'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  DevCatalogOverview,
  ApiError,
} from '@/lib/api';
import {
  SUPPORTED_SECTIONS,
  SUPPORTED_VENTURES,
  isSectionImplemented,
} from '@/lib/feature-registry';
import {
  Terminal,
  Building2,
  FolderTree,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  Sparkles,
  Info,
  Code2,
  KeyRound,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type CatalogVentureItem = { id: string; name: string; slug: string; status?: string };
type CatalogDeptItem = { id: string; name: string; slug: string; ventureId: string; status?: string };
type CatalogSecItem = { id: string; name: string; slug: string; departmentId: string; status?: string };

export default function DevAdminPage() {
  // Developer Auth State
  const [isDevAuthLoading, setIsDevAuthLoading] = useState(true);
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(false);
  const [devUser, setDevUser] = useState<{ username: string } | null>(null);

  // Login Form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'ventures' | 'departments' | 'sections' | 'registry'
  >('overview');

  // Catalog Data
  const [overview, setOverview] = useState<DevCatalogOverview | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  // Notifications
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Modals
  const [modalType, setModalType] = useState<
    'createVenture' | 'editVenture' | 'createDept' | 'editDept' | 'createSec' | 'editSec' | 'deleteConfirm' | null
  >(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Selected item for edit / delete
  const [selectedVenture, setSelectedVenture] = useState<CatalogVentureItem | null>(null);
  const [selectedDept, setSelectedDept] = useState<CatalogDeptItem | null>(null);
  const [selectedSec, setSelectedSec] = useState<CatalogSecItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'venture' | 'department' | 'section';
    id: string;
    name: string;
  } | null>(null);

  // Form states
  const [ventureForm, setVentureForm] = useState({ name: '', slug: '', status: 'active' as 'active' | 'inactive' });
  const [deptForm, setDeptForm] = useState({ ventureId: '', name: '', slug: '', status: 'active' as 'active' | 'inactive' });
  const [secForm, setSecForm] = useState({ departmentId: '', name: '', slug: '', status: 'active' as 'active' | 'inactive' });

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Check Developer Session on Mount
  useEffect(() => {
    let active = true;
    api.dev.me()
      .then((me) => {
        if (!active) return;
        setIsDevAuthenticated(true);
        setDevUser(me);
      })
      .catch(() => {
        if (!active) return;
        setIsDevAuthenticated(false);
        setDevUser(null);
      })
      .finally(() => {
        if (!active) return;
        setIsDevAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Load Catalog Overview once authenticated
  useEffect(() => {
    if (!isDevAuthenticated) return;
    let active = true;

    api.dev.getCatalogOverview()
      .then((data) => {
        if (!active) return;
        setOverview(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof ApiError ? err.message : 'Failed to fetch catalog overview';
        setNotification({ type: 'error', message: msg });
      })
      .finally(() => {
        if (!active) return;
        setLoadingCatalog(false);
      });

    return () => {
      active = false;
    };
  }, [isDevAuthenticated, refreshCount]);

  // Handle Developer Login
  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const res = await api.dev.login(loginForm);
      setIsDevAuthenticated(true);
      setDevUser({ username: res.username });
      setLoadingCatalog(true);
      setNotification({ type: 'success', message: 'Developer session authenticated' });
    } catch (err: unknown) {
      setLoginError(err instanceof ApiError ? err.message : 'Authentication failed');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handle Developer Logout
  const handleDevLogout = async () => {
    try {
      await api.dev.logout();
    } catch {
      // Ignore
    } finally {
      setIsDevAuthenticated(false);
      setDevUser(null);
      setOverview(null);
    }
  };

  // ===================== CRUD ACTIONS =====================

  const handleCreateVenture = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    try {
      await api.dev.ventures.create(ventureForm);
      setNotification({ type: 'success', message: `Venture "${ventureForm.name}" registered in catalog` });
      setModalType(null);
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to create venture' });
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleUpdateVenture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenture) return;
    setModalSubmitting(true);
    try {
      await api.dev.ventures.update(selectedVenture.id, ventureForm);
      setNotification({ type: 'success', message: `Venture "${ventureForm.name}" updated` });
      setModalType(null);
      setSelectedVenture(null);
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update venture' });
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    try {
      await api.dev.departments.create(deptForm);
      setNotification({ type: 'success', message: `Department "${deptForm.name}" registered in catalog` });
      setModalType(null);
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to create department' });
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    setModalSubmitting(true);
    try {
      await api.dev.departments.update(selectedDept.id, {
        name: deptForm.name,
        slug: deptForm.slug,
        status: deptForm.status,
      });
      setNotification({ type: 'success', message: `Department "${deptForm.name}" updated` });
      setModalType(null);
      setSelectedDept(null);
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update department' });
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleCreateSec = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    try {
      await api.dev.sections.create(secForm);
      setNotification({ type: 'success', message: `Section "${secForm.name}" registered in catalog` });
      setModalType(null);
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to create section' });
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleUpdateSec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSec) return;
    setModalSubmitting(true);
    try {
      await api.dev.sections.update(selectedSec.id, {
        name: secForm.name,
        slug: secForm.slug,
        status: secForm.status,
      });
      setNotification({ type: 'success', message: `Section "${secForm.name}" updated` });
      setModalType(null);
      setSelectedSec(null);
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to update section' });
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setModalSubmitting(true);
    try {
      if (deleteTarget.type === 'venture') {
        await api.dev.ventures.delete(deleteTarget.id);
      } else if (deleteTarget.type === 'department') {
        await api.dev.departments.delete(deleteTarget.id);
      } else if (deleteTarget.type === 'section') {
        await api.dev.sections.delete(deleteTarget.id);
      }
      setNotification({
        type: 'success',
        message: `${deleteTarget.type.toUpperCase()} "${deleteTarget.name}" removed from catalog`,
      });
      setModalType(null);
      setDeleteTarget(null);
      setRefreshCount((c) => c + 1);
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Delete failed',
      });
    } finally {
      setModalSubmitting(false);
    }
  };

  // ===================== RENDER LOGIN IF NOT AUTHENTICATED =====================
  if (isDevAuthLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
        <span className="text-sm font-medium">Verifying Developer Session...</span>
      </div>
    );
  }

  if (!isDevAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#18181b] border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 rounded-xl flex items-center justify-center mx-auto text-emerald-400">
              <Terminal className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">MeDaOS Dev Admin</h1>
            <p className="text-xs text-zinc-400">
              Protected Developer Console — Structural Catalog & Registry Control
            </p>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-400 leading-relaxed flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Authentication is verified via backend server environment secrets. Regular administrator and employee accounts cannot access this area.
            </span>
          </div>

          {loginError && (
            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleDevLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Developer Username</label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                placeholder="e.g. devadmin"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Developer Secret Key / Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loginSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Authenticate Dev Session</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
            <Link href="/" className="hover:text-zinc-300 transition-colors">
              ← Return to MeDaOS Application
            </Link>
            <span>v2.0 Architectural Boundary</span>
          </div>
        </div>
      </div>
    );
  }

  // ===================== AUTHENTICATED DEV CONSOLE =====================
  const allVentures = overview?.ventures || [];
  const allDepts = allVentures.flatMap((v) =>
    v.departments.map((d) => ({ ...d, ventureName: v.name, ventureSlug: v.slug }))
  );
  const allSections = allDepts.flatMap((d) =>
    d.sections.map((s) => ({
      ...s,
      ventureName: d.ventureName,
      ventureSlug: d.ventureSlug,
      departmentName: d.name,
      departmentSlug: d.slug,
    }))
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 border-b border-zinc-800 bg-[#121215] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
            DEV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">MeDaOS Dev Admin</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                Catalog Authority
              </span>
              {devUser && (
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60 hidden sm:inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {devUser.username}
                </span>
              )}
            </div>
            <span className="text-[11px] text-zinc-400">
              Structural Catalog & Feature Registry Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/employees"
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-700/60 flex items-center gap-1.5"
          >
            <span>Open Employee Management</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => setRefreshCount((c) => c + 1)}
            disabled={loadingCatalog}
            title="Refresh Catalog Data"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loadingCatalog ? 'animate-spin' : ''}`} />
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <button
            onClick={handleDevLogout}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Dev Session</span>
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-red-950/80 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left Sub-nav */}
        <aside className="w-full md:w-60 border-r border-zinc-800 bg-[#0e0e11] p-4 flex flex-col gap-1 shrink-0">
          <div className="text-[10px] font-mono text-zinc-500 uppercase px-2 py-1 tracking-wider">
            Catalog Management
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full px-3 py-2 text-xs rounded-lg text-left flex items-center gap-2.5 transition-colors ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Catalog Tree & Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('ventures')}
            className={`w-full px-3 py-2 text-xs rounded-lg text-left flex items-center gap-2.5 transition-colors ${
              activeTab === 'ventures'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Ventures</span>
            {overview && (
              <span className="ml-auto text-[10px] font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded-sm">
                {overview.summary.totalVentures}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`w-full px-3 py-2 text-xs rounded-lg text-left flex items-center gap-2.5 transition-colors ${
              activeTab === 'departments'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Departments</span>
            {overview && (
              <span className="ml-auto text-[10px] font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded-sm">
                {overview.summary.totalDepartments}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sections')}
            className={`w-full px-3 py-2 text-xs rounded-lg text-left flex items-center gap-2.5 transition-colors ${
              activeTab === 'sections'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Sections</span>
            {overview && (
              <span className="ml-auto text-[10px] font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded-sm">
                {overview.summary.totalSections}
              </span>
            )}
          </button>

          <div className="pt-4 mt-2 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-500 uppercase px-2 py-1 tracking-wider">
            Code-Level Verification
          </div>

          <button
            onClick={() => setActiveTab('registry')}
            className={`w-full px-3 py-2 text-xs rounded-lg text-left flex items-center gap-2.5 transition-colors ${
              activeTab === 'registry'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Feature Registry</span>
          </button>

          <div className="mt-auto pt-6 text-[11px] text-zinc-500 p-2 border-t border-zinc-800">
            <div className="font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dev Authority Active</span>
            </div>
            <p className="leading-tight">
              Only Dev Admin can alter structural venture, department, or section definitions.
            </p>
          </div>
        </aside>

        {/* Right Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* TAB: OVERVIEW & DIAGNOSTICS */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-6xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Catalog Diagnostics & Hierarchy</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Live audit of database catalog records mapped to application feature code implementations.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setVentureForm({ name: '', slug: '', status: 'active' });
                      setModalType('createVenture');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register Venture</span>
                  </button>
                </div>
              </div>

              {/* Metrics cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="text-[10px] font-mono uppercase text-zinc-500">Ventures</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {overview?.summary.totalVentures || 0}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1">Application brands</div>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="text-[10px] font-mono uppercase text-zinc-500">Departments</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {overview?.summary.totalDepartments || 0}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">Venture divisions</div>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="text-[10px] font-mono uppercase text-zinc-500">Sections</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {overview?.summary.totalSections || 0}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1">Permission targets</div>
                </div>

                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="text-[10px] font-mono uppercase text-zinc-500">Feature Registry</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {Object.keys(SUPPORTED_SECTIONS).length}
                  </div>
                  <div className="text-[11px] text-blue-400 mt-1">Code implementations</div>
                </div>
              </div>

              {/* Architecture Rule Callout */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-start gap-3 text-xs text-zinc-400">
                <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-white">
                    Important Architectural Rule: Code Defines Features, Database Stores Configuration
                  </span>
                  <p>
                    A database record does not automatically create a functional frontend workflow. Every functional section (e.g. Sales, Orders, Operations, NBD) is backed by code in the Next.js App Router. Sections tagged as <span className="text-emerald-400 font-medium">Implemented in Code</span> have active interfaces, while catalog-only entries require code implementation before deployment.
                  </p>
                </div>
              </div>

              {/* Venture Hierarchy Tree */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white">Full Application Catalog Tree</h3>

                {loadingCatalog ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                    <span className="text-xs">Loading application catalog hierarchy...</span>
                  </div>
                ) : allVentures.length === 0 ? (
                  <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-xl text-center text-zinc-500 text-xs">
                    No ventures registered in catalog yet. Click &quot;Register Venture&quot; to initialize.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allVentures.map((v) => (
                      <div
                        key={v.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xs"
                      >
                        <div className="p-4 bg-zinc-850/80 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{v.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-sm">
                                  /{v.slug}
                                </span>
                                {v.isSupportedInCode ? (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                                    Supported Template
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                    Custom Catalog Venture
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-400">
                                {v.departmentCount} Department(s) • {v.employeeCount} Assigned Employee(s) • Status: {v.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setDeptForm({ ventureId: v.id, name: '', slug: '', status: 'active' });
                                setModalType('createDept');
                              }}
                              className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Department</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedVenture(v);
                                setVentureForm({ name: v.name, slug: v.slug, status: v.status as 'active' | 'inactive' });
                                setModalType('editVenture');
                              }}
                              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                              title="Edit Venture Metadata"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setDeleteTarget({ type: 'venture', id: v.id, name: v.name });
                                setModalType('deleteConfirm');
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-zinc-800 rounded-md transition-colors"
                              title="Remove Venture"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Departments Inside Venture */}
                        <div className="p-4 space-y-3">
                          {v.departments.length === 0 ? (
                            <div className="text-xs text-zinc-500 italic py-2">
                              No departments created under {v.name}.
                            </div>
                          ) : (
                            v.departments.map((d) => (
                              <div
                                key={d.id}
                                className="bg-[#121215] border border-zinc-800/80 rounded-lg p-3 space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <FolderTree className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-semibold text-white">{d.name}</span>
                                    <span className="text-[10px] font-mono text-zinc-500">slug: {d.slug}</span>
                                    <span className="text-[10px] text-zinc-400">
                                      ({d.teamCount} teams, {d.sectionCount} sections)
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSecForm({ departmentId: d.id, name: '', slug: '', status: 'active' });
                                        setModalType('createSec');
                                      }}
                                      className="px-2 py-0.5 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Add Section</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedDept(d);
                                        setDeptForm({ ventureId: d.ventureId, name: d.name, slug: d.slug, status: d.status as 'active' | 'inactive' });
                                        setModalType('editDept');
                                      }}
                                      className="p-1 text-zinc-400 hover:text-white"
                                      title="Edit Department"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        setDeleteTarget({ type: 'department', id: d.id, name: d.name });
                                        setModalType('deleteConfirm');
                                      }}
                                      className="p-1 text-red-400 hover:text-red-300"
                                      title="Delete Department"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Sections under Department */}
                                {d.sections.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 border-t border-zinc-800/60">
                                    {d.sections.map((s) => (
                                      <div
                                        key={s.id}
                                        className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-md flex flex-col justify-between gap-2"
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-medium text-white truncate">
                                              {s.name}
                                            </span>
                                            {s.isImplementedInCode ? (
                                              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-sm">
                                                Code Implemented
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-950 text-amber-400 border border-amber-800 rounded-sm">
                                                Catalog Only
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] font-mono text-zinc-500 mt-1">
                                            route: {s.route}
                                          </div>
                                          <div className="text-[10px] text-zinc-400 mt-0.5">
                                            {s.assignedUserCount} active user assignment(s)
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/80">
                                          <span className={`text-[10px] ${s.status === 'active' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                            ● {s.status}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => {
                                                setSelectedSec(s);
                                                setSecForm({ departmentId: s.departmentId, name: s.name, slug: s.slug, status: s.status as 'active' | 'inactive' });
                                                setModalType('editSec');
                                              }}
                                              className="p-1 text-zinc-400 hover:text-white"
                                              title="Edit Section"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setDeleteTarget({ type: 'section', id: s.id, name: s.name });
                                                setModalType('deleteConfirm');
                                              }}
                                              className="p-1 text-red-400 hover:text-red-300"
                                              title="Delete Section"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: VENTURES */}
          {activeTab === 'ventures' && (
            <div className="space-y-6 max-w-5xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Ventures Catalog</h2>
                  <p className="text-xs text-zinc-400">
                    Register and configure top-level companies belonging to MeDa Partners.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setVentureForm({ name: '', slug: '', status: 'active' });
                    setModalType('createVenture');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Venture</span>
                </button>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-850 text-zinc-400 font-mono text-[10px] uppercase border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Venture Name</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Code Support</th>
                      <th className="px-4 py-3">Departments</th>
                      <th className="px-4 py-3">Employees</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-zinc-300">
                    {allVentures.map((v) => (
                      <tr key={v.id} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{v.name}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">/{v.slug}</td>
                        <td className="px-4 py-3">
                          {v.isSupportedInCode ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Supported Template
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                              Custom Catalog
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{v.departmentCount}</td>
                        <td className="px-4 py-3">{v.employeeCount}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium ${v.status === 'active' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            ● {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedVenture(v);
                                setVentureForm({ name: v.name, slug: v.slug, status: v.status as 'active' | 'inactive' });
                                setModalType('editVenture');
                              }}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteTarget({ type: 'venture', id: v.id, name: v.name });
                                setModalType('deleteConfirm');
                              }}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-6 max-w-5xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Departments Catalog</h2>
                  <p className="text-xs text-zinc-400">
                    Register organizational departments within ventures.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setDeptForm({
                      ventureId: allVentures[0]?.id || '',
                      name: '',
                      slug: '',
                      status: 'active',
                    });
                    setModalType('createDept');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Department</span>
                </button>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-850 text-zinc-400 font-mono text-[10px] uppercase border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Department Name</th>
                      <th className="px-4 py-3">Owning Venture</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Sections</th>
                      <th className="px-4 py-3">Teams</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-zinc-300">
                    {allDepts.map((d) => (
                      <tr key={d.id} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{d.name}</td>
                        <td className="px-4 py-3 text-zinc-400">{d.ventureName}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">{d.slug}</td>
                        <td className="px-4 py-3">{d.sectionCount}</td>
                        <td className="px-4 py-3">{d.teamCount}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium ${d.status === 'active' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            ● {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedDept(d);
                                setDeptForm({ ventureId: d.ventureId, name: d.name, slug: d.slug, status: d.status as 'active' | 'inactive' });
                                setModalType('editDept');
                              }}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteTarget({ type: 'department', id: d.id, name: d.name });
                                setModalType('deleteConfirm');
                              }}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: SECTIONS */}
          {activeTab === 'sections' && (
            <div className="space-y-6 max-w-5xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Sections Catalog</h2>
                  <p className="text-xs text-zinc-400">
                    Register application sections and permission resources. Identical section slugs under different departments are distinct resources.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSecForm({
                      departmentId: allDepts[0]?.id || '',
                      name: '',
                      slug: '',
                      status: 'active',
                    });
                    setModalType('createSec');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Section</span>
                </button>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-850 text-zinc-400 font-mono text-[10px] uppercase border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Section Name</th>
                      <th className="px-4 py-3">Department & Venture</th>
                      <th className="px-4 py-3">Slug / Route</th>
                      <th className="px-4 py-3">Code Implementation</th>
                      <th className="px-4 py-3">User Grants</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-zinc-300">
                    {allSections.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-zinc-300">{s.departmentName}</span>
                          <span className="text-zinc-500 text-[10px] block">({s.ventureName})</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">{s.route}</td>
                        <td className="px-4 py-3">
                          {s.isImplementedInCode ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                              ✓ Code Implemented
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
                              ! Catalog Only
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{s.assignedUserCount} users</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium ${s.status === 'active' ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            ● {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedSec(s);
                                setSecForm({ departmentId: s.departmentId, name: s.name, slug: s.slug, status: s.status as 'active' | 'inactive' });
                                setModalType('editSec');
                              }}
                              className="p-1 text-zinc-400 hover:text-white"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteTarget({ type: 'section', id: s.id, name: s.name });
                                setModalType('deleteConfirm');
                              }}
                              className="p-1 text-red-400 hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: FEATURE REGISTRY */}
          {activeTab === 'registry' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h2 className="text-lg font-bold text-white">Supported Feature Registry (In Code)</h2>
                <p className="text-xs text-zinc-400">
                  Defines the code-level implementations currently built and supported in MeDaOS.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Supported Sections in Code</h3>
                  </div>

                  <div className="space-y-3">
                    {Object.values(SUPPORTED_SECTIONS).map((sec) => (
                      <div key={sec.key} className="p-3 bg-zinc-850 rounded-lg border border-zinc-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{sec.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-800">
                            {sec.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{sec.description}</p>
                        <div className="text-[10px] font-mono text-zinc-500 pt-1">
                          Template: {sec.routeTemplate}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Supported Venture Templates</h3>
                  </div>

                  <div className="space-y-3">
                    {Object.values(SUPPORTED_VENTURES).map((v) => (
                      <div key={v.slug} className="p-3 bg-zinc-850 rounded-lg border border-zinc-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{v.name}</span>
                          <span className="text-[10px] font-mono text-zinc-400">/{v.slug}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{v.description}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {v.supportedSectionKeys.map((k) => (
                            <span key={k} className="text-[9px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===================== SHEETS ===================== */}

      {/* CREATE VENTURE SHEET */}
      <Sheet open={modalType === 'createVenture'} onOpenChange={(open) => !open && setModalType(null)}>
        <SheetContent side="right">
          <form onSubmit={handleCreateVenture} className="flex flex-col h-full">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle>Register Venture in Catalog</SheetTitle>
                  <SheetDescription>
                    Add a new portfolio company or business unit to MeDa Partners OS.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Venture Name *
                </label>
                <Input
                  required
                  value={ventureForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setVentureForm({
                      ...ventureForm,
                      name,
                      slug: toSlug(name),
                    });
                  }}
                  placeholder="e.g. WayVeda, Digital Chaabi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Slug (URL Identifier) *
                </label>
                <Input
                  required
                  value={ventureForm.slug}
                  onChange={(e) => setVentureForm({ ...ventureForm, slug: toSlug(e.target.value) })}
                  placeholder="e.g. wayveda"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Status
                </label>
                <select
                  value={ventureForm.status}
                  onChange={(e) => setVentureForm({ ...ventureForm, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setModalType(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={modalSubmitting}>
                <Plus className="w-3.5 h-3.5" />
                <span>Register Venture</span>
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT VENTURE SHEET */}
      <Sheet open={modalType === 'editVenture' && Boolean(selectedVenture)} onOpenChange={(open) => !open && setModalType(null)}>
        <SheetContent side="right">
          {selectedVenture && (
            <form onSubmit={handleUpdateVenture} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Edit Venture: {selectedVenture.name}</SheetTitle>
                    <SheetDescription>
                      Update company metadata and lifecycle status.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Venture Name *
                  </label>
                  <Input
                    required
                    value={ventureForm.name}
                    onChange={(e) => setVentureForm({ ...ventureForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Slug *
                  </label>
                  <Input
                    required
                    value={ventureForm.slug}
                    onChange={(e) => setVentureForm({ ...ventureForm, slug: toSlug(e.target.value) })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Status
                  </label>
                  <select
                    value={ventureForm.status}
                    onChange={(e) => setVentureForm({ ...ventureForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setModalType(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={modalSubmitting}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* CREATE DEPARTMENT SHEET */}
      <Sheet open={modalType === 'createDept'} onOpenChange={(open) => !open && setModalType(null)}>
        <SheetContent side="right">
          <form onSubmit={handleCreateDept} className="flex flex-col h-full">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                  <FolderTree className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle>Register Department in Catalog</SheetTitle>
                  <SheetDescription>
                    Define an organizational division for a venture.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Target Venture *
                </label>
                <select
                  required
                  value={deptForm.ventureId}
                  onChange={(e) => setDeptForm({ ...deptForm, ventureId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                >
                  {allVentures.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (/{v.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Department Name *
                </label>
                <Input
                  required
                  value={deptForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setDeptForm({
                      ...deptForm,
                      name,
                      slug: toSlug(name),
                    });
                  }}
                  placeholder="e.g. Sales, Marketing, Operations"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Slug *
                </label>
                <Input
                  required
                  value={deptForm.slug}
                  onChange={(e) => setDeptForm({ ...deptForm, slug: toSlug(e.target.value) })}
                  placeholder="e.g. sales"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Status
                </label>
                <select
                  value={deptForm.status}
                  onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setModalType(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={modalSubmitting}>
                <Plus className="w-3.5 h-3.5" />
                <span>Register Department</span>
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT DEPARTMENT SHEET */}
      <Sheet open={modalType === 'editDept' && Boolean(selectedDept)} onOpenChange={(open) => !open && setModalType(null)}>
        <SheetContent side="right">
          {selectedDept && (
            <form onSubmit={handleUpdateDept} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Edit Department: {selectedDept.name}</SheetTitle>
                    <SheetDescription>
                      Update department naming and status.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Department Name *
                  </label>
                  <Input
                    required
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Slug *
                  </label>
                  <Input
                    required
                    value={deptForm.slug}
                    onChange={(e) => setDeptForm({ ...deptForm, slug: toSlug(e.target.value) })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Status
                  </label>
                  <select
                    value={deptForm.status}
                    onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setModalType(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={modalSubmitting}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* CREATE SECTION SHEET */}
      <Sheet open={modalType === 'createSec'} onOpenChange={(open) => !open && setModalType(null)}>
        <SheetContent side="right">
          <form onSubmit={handleCreateSec} className="flex flex-col h-full">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle>Register Section in Catalog</SheetTitle>
                  <SheetDescription>
                    Define a functional area and route permission boundary.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-4">
              <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-xs text-[#71717a] flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Identical section slugs (e.g. &quot;sales&quot;) can exist under different departments and represent distinct venture permission resources.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Target Department & Venture *
                </label>
                <select
                  required
                  value={secForm.departmentId}
                  onChange={(e) => setSecForm({ ...secForm, departmentId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                >
                  {allDepts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.ventureName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Section Name *
                </label>
                <Input
                  required
                  value={secForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setSecForm({
                      ...secForm,
                      name,
                      slug: toSlug(name),
                    });
                  }}
                  placeholder="e.g. Sales, Orders, Operations"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#18181b]">Section Slug *</label>
                  {secForm.slug && (
                    <span className={`text-[10px] font-mono ${isSectionImplemented(secForm.slug) ? 'text-emerald-600 font-semibold' : 'text-amber-600'}`}>
                      {isSectionImplemented(secForm.slug) ? '✓ Code Ready' : '! Catalog-Only'}
                    </span>
                  )}
                </div>
                <Input
                  required
                  value={secForm.slug}
                  onChange={(e) => setSecForm({ ...secForm, slug: toSlug(e.target.value) })}
                  placeholder="e.g. sales"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#18181b]">
                  Status
                </label>
                <select
                  value={secForm.status}
                  onChange={(e) => setSecForm({ ...secForm, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button type="button" variant="secondary" onClick={() => setModalType(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={modalSubmitting}>
                <Plus className="w-3.5 h-3.5" />
                <span>Register Section</span>
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT SECTION SHEET */}
      <Sheet open={modalType === 'editSec' && Boolean(selectedSec)} onOpenChange={(open) => !open && setModalType(null)}>
        <SheetContent side="right">
          {selectedSec && (
            <form onSubmit={handleUpdateSec} className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#09090b] text-white flex items-center justify-center shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Edit Section: {selectedSec.name}</SheetTitle>
                    <SheetDescription>
                      Update section catalog configuration.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Section Name *
                  </label>
                  <Input
                    required
                    value={secForm.name}
                    onChange={(e) => setSecForm({ ...secForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#18181b]">Slug *</label>
                    {secForm.slug && (
                      <span className={`text-[10px] font-mono ${isSectionImplemented(secForm.slug) ? 'text-emerald-600 font-semibold' : 'text-amber-600'}`}>
                        {isSectionImplemented(secForm.slug) ? '✓ Code Ready' : '! Catalog-Only'}
                      </span>
                    )}
                  </div>
                  <Input
                    required
                    value={secForm.slug}
                    onChange={(e) => setSecForm({ ...secForm, slug: toSlug(e.target.value) })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#18181b]">
                    Status
                  </label>
                  <select
                    value={secForm.status}
                    onChange={(e) => setSecForm({ ...secForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg text-[#09090b] focus:outline-hidden focus:ring-1 focus:ring-[#09090b] cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button type="button" variant="secondary" onClick={() => setModalType(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={modalSubmitting}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* DELETE CONFIRMATION SHEET */}
      <Sheet open={modalType === 'deleteConfirm' && Boolean(deleteTarget)} onOpenChange={(open) => !open && setModalType(null)}>
        <SheetContent side="right">
          {deleteTarget && (
            <div className="flex flex-col h-full">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <SheetTitle>Confirm Removal: {deleteTarget.name}</SheetTitle>
                    <SheetDescription className="font-mono uppercase text-[10px]">
                      Target Type: {deleteTarget.type}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 leading-relaxed">
                  Are you sure you want to delete this {deleteTarget.type}? The server will verify relational dependencies. If employees or child resources exist, consider deactivating it instead to preserve data integrity.
                </div>

                <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-xs font-mono text-[#52525b] space-y-1">
                  <div>Resource Name: <strong className="text-[#09090b]">{deleteTarget.name}</strong></div>
                  <div>Target Type: <strong className="text-[#09090b]">{deleteTarget.type}</strong></div>
                  <div>Identifier ID: <span className="text-[#71717a]">{deleteTarget.id}</span></div>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setModalType(null);
                    setDeleteTarget(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleExecuteDelete}
                  loading={modalSubmitting}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Resource</span>
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
