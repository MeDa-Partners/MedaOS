'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { api, Team, Venture, ApiError } from '@/lib/api';
import {
  Network,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Building2,
} from 'lucide-react';

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [ventures, setVentures] = useState<Venture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVentureId, setSelectedVentureId] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Create Form state
  const [createForm, setCreateForm] = useState({
    ventureId: '',
    name: '',
    slug: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Edit Form state
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Auto-dismiss notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const reloadData = useCallback(() => {
    setLoading(true);
    setRefreshCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchTeamsData() {
      try {
        const [tList, vList] = await Promise.all([
          api.teams.list(selectedVentureId || undefined),
          api.ventures.list(),
        ]);
        if (isMounted) {
          setTeams(tList);
          setVentures(vList);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load teams');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchTeamsData();

    return () => {
      isMounted = false;
    };
  }, [selectedVentureId, refreshCount]);

  // Handle Create Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    try {
      await api.teams.create({
        ventureId: createForm.ventureId,
        name: createForm.name,
        slug: createForm.slug || toSlug(createForm.name),
        status: createForm.status,
      });

      setSuccessMessage(`Team "${createForm.name}" created successfully`);
      setIsCreateOpen(false);
      setCreateForm({
        ventureId: ventures[0]?.id || '',
        name: '',
        slug: '',
        status: 'active',
      });
      reloadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create team');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update Team
  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.teams.update(editingTeam.id, {
        name: editForm.name,
        slug: editForm.slug || toSlug(editForm.name),
        status: editForm.status,
      });

      setSuccessMessage(`Team "${editForm.name}" updated successfully`);
      setEditingTeam(null);
      reloadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update team');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Filter teams by search
  const filteredTeams = teams.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <AppShell
      requireAdmin={true}
      title="Team Management"
      description="Configure organizational teams per venture. Teams classify employees within a specific business context."
    >
      <div className="space-y-6">
        {/* Admin Header Banner */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-center text-[#18181b] shrink-0">
              <Network className="w-5 h-5 text-[#09090b]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#09090b]">
                  Organizational Teams by Venture
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs text-[#71717a] mt-0.5">
                Teams answer which group an employee belongs to inside a venture. Teams do not dictate access permissions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateForm({
                ventureId: selectedVentureId || (ventures[0]?.id || ''),
                name: '',
                slug: '',
                status: 'active',
              });
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Team</span>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedVentureId}
              onChange={(e) => setSelectedVentureId(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden text-[#18181b]"
            >
              <option value="">All Ventures</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={reloadData}
              className="p-2 text-[#71717a] hover:text-[#09090b] hover:bg-white border border-transparent hover:border-[#e4e4e7] rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Teams Table */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafafa] border-b border-[#e4e4e7] text-[#71717a] font-medium">
                <tr>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Venture</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f2]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#71717a]">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#09090b]" />
                        <span>Loading teams...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#71717a]">
                      No teams found.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((t) => (
                    <tr key={t.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#09090b]">
                        {t.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#71717a] text-[11px]">
                        {t.slug}
                      </td>
                      <td className="py-3 px-4 text-[#18181b]">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#f4f4f5] border border-[#e4e4e7] text-[11px]">
                          <Building2 className="w-3 h-3 text-[#71717a]" />
                          {t.venture?.name || 'Venture'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            t.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              t.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'
                            }`}
                          />
                          {t.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeam(t);
                            setEditForm({
                              name: t.name,
                              slug: t.slug,
                              status: (t.status as 'active' | 'inactive') || 'active',
                            });
                          }}
                          className="px-2 py-1 text-[11px] bg-white hover:bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7] rounded-md transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE TEAM MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">Create Team</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-[#71717a] hover:text-[#09090b] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Venture Context
                </label>
                <select
                  required
                  value={createForm.ventureId}
                  onChange={(e) => setCreateForm({ ...createForm, ventureId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden"
                >
                  <option value="">Select Venture</option>
                  {ventures.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales, Operations, NBD"
                  value={createForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCreateForm({
                      ...createForm,
                      name,
                      slug: toSlug(name),
                    });
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  required
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: toSlug(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#52525b] hover:bg-[#f4f4f5] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !createForm.ventureId || !createForm.name}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Team</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">Edit Team</h3>
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="p-1 text-[#71717a] hover:text-[#09090b] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTeam} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  required
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: toSlug(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-3 py-1.5 text-xs text-[#52525b] hover:bg-[#f4f4f5] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !editForm.name}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
