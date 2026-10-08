'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/auth-context';
import { api, Venture, Section, ApiError } from '@/lib/api';
import {
  Building2,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Sliders,
} from 'lucide-react';

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function VenturesPage() {
  const { refreshUser } = useAuth();

  const [ventures, setVentures] = useState<Venture[]>([]);
  const [sectionsCatalog, setSectionsCatalog] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVenture, setEditingVenture] = useState<Venture | null>(null);
  const [configuringSectionsVenture, setConfiguringSectionsVenture] = useState<Venture | null>(null);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  // Create Form state
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    sectionIds: [] as string[],
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

  const [refreshCount, setRefreshCount] = useState(0);

  const reloadData = useCallback(() => {
    setLoading(true);
    setRefreshCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchVenturesData() {
      try {
        const [vList, sList] = await Promise.all([
          api.ventures.list(),
          api.sections.list(),
        ]);
        if (isMounted) {
          setVentures(vList);
          setSectionsCatalog(sList);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : 'Failed to load ventures');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchVenturesData();

    return () => {
      isMounted = false;
    };
  }, [refreshCount]);

  // Handle Create Venture
  const handleCreateVenture = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    try {
      await api.ventures.create({
        name: createForm.name,
        slug: createForm.slug || toSlug(createForm.name),
        sectionIds: createForm.sectionIds,
        status: createForm.status,
      });

      setSuccessMessage(`Venture "${createForm.name}" created successfully`);
      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        slug: '',
        sectionIds: [],
        status: 'active',
      });
      reloadData();
      await refreshUser();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create venture');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update Venture
  const handleUpdateVenture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenture) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.ventures.update(editingVenture.id, {
        name: editForm.name,
        slug: editForm.slug || toSlug(editForm.name),
        status: editForm.status,
      });

      setSuccessMessage(`Venture "${editForm.name}" updated successfully`);
      setEditingVenture(null);
      reloadData();
      await refreshUser();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update venture');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Configure Sections
  const handleSaveSections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringSectionsVenture) return;

    setActionLoading(true);
    setError(null);

    try {
      await api.ventures.setSections(configuringSectionsVenture.id, selectedSectionIds);
      setSuccessMessage(`Updated available sections for ${configuringSectionsVenture.name}`);
      setConfiguringSectionsVenture(null);
      reloadData();
      await refreshUser();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update venture sections');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Filter ventures
  const filteredVentures = ventures.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell
      requireAdmin={true}
      title="Venture Management"
      description="Create ventures and configure which business sections are enabled for each venture."
    >
      <div className="space-y-6">
        {/* Admin Header Banner */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-center text-[#18181b] shrink-0">
              <Building2 className="w-5 h-5 text-[#09090b]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#09090b]">
                  Ventures & Business Section Catalog
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs text-[#71717a] mt-0.5">
                Ventures have independent structures. You decide which sections (e.g. Sales, Orders, Operations) exist inside each venture.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateForm({
                name: '',
                slug: '',
                sectionIds: [],
                status: 'active',
              });
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Venture</span>
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

        {/* Search */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ventures..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e4e4e7] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-black"
            />
          </div>

          <button
            type="button"
            onClick={reloadData}
            className="p-2 text-[#71717a] hover:text-[#09090b] hover:bg-white border border-transparent hover:border-[#e4e4e7] rounded-lg transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Ventures Grid */}
        {loading ? (
          <div className="p-12 text-center text-[#71717a] bg-white border border-[#e4e4e7] rounded-xl">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#09090b]" />
              <span className="text-xs">Loading ventures...</span>
            </div>
          </div>
        ) : filteredVentures.length === 0 ? (
          <div className="p-12 text-center text-[#71717a] bg-white border border-[#e4e4e7] rounded-xl text-xs">
            No ventures found matching search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVentures.map((v) => (
              <div
                key={v.id}
                className="bg-white border border-[#e4e4e7] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-[#d4d4d8] transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-[#fafafa] border border-[#e4e4e7] flex items-center justify-center font-bold text-xs text-[#09090b]">
                        {v.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#09090b]">{v.name}</h4>
                        <span className="text-[11px] font-mono text-[#71717a]">{v.slug}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        v.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          v.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'
                        }`}
                      />
                      {v.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Available Sections */}
                  <div className="mt-4">
                    <span className="text-[11px] font-medium text-[#71717a] block mb-2">
                      Enabled Business Sections:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {!v.sections || v.sections.length === 0 ? (
                        <span className="text-xs text-[#a1a1aa] italic">
                          No sections enabled yet
                        </span>
                      ) : (
                        v.sections.map((sec) => (
                          <span
                            key={sec.id}
                            className="px-2 py-0.5 bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7] rounded-md text-[11px] font-medium capitalize"
                          >
                            {sec.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-6 pt-3 border-t border-[#f0f0f2] flex items-center justify-between">
                  <span className="text-[11px] text-[#71717a]">
                    {v.teams?.length || 0} {(v.teams?.length || 0) === 1 ? 'team' : 'teams'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfiguringSectionsVenture(v);
                        setSelectedSectionIds((v.sections || []).map((s) => s.id));
                      }}
                      className="px-2.5 py-1 text-xs bg-white hover:bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7] rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Sliders className="w-3 h-3 text-[#71717a]" />
                      <span>Sections</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingVenture(v);
                        setEditForm({
                          name: v.name,
                          slug: v.slug,
                          status: (v.status as 'active' | 'inactive') || 'active',
                        });
                      }}
                      className="px-2.5 py-1 text-xs bg-white hover:bg-[#f4f4f5] text-[#18181b] border border-[#e4e4e7] rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE VENTURE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-md w-full p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">Create Venture</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-[#71717a] hover:text-[#09090b] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVenture} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Venture Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wayveda, Nature Mania"
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

              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1.5">
                  Initial Available Sections
                </label>
                <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-lg max-h-44 overflow-y-auto space-y-2">
                  {sectionsCatalog.map((sec) => (
                    <label key={sec.id} className="flex items-center gap-2 text-xs text-[#18181b] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createForm.sectionIds.includes(sec.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCreateForm({
                              ...createForm,
                              sectionIds: [...createForm.sectionIds, sec.id],
                            });
                          } else {
                            setCreateForm({
                              ...createForm,
                              sectionIds: createForm.sectionIds.filter((id) => id !== sec.id),
                            });
                          }
                        }}
                        className="rounded-xs border-[#e4e4e7] text-black focus:ring-black"
                      />
                      <span className="capitalize">{sec.name}</span>
                    </label>
                  ))}
                </div>
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
                  disabled={actionLoading || !createForm.name}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Venture</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VENTURE MODAL */}
      {editingVenture && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <h3 className="text-sm font-semibold text-[#09090b]">Edit Venture</h3>
              <button
                type="button"
                onClick={() => setEditingVenture(null)}
                className="p-1 text-[#71717a] hover:text-[#09090b] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateVenture} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#18181b] mb-1">
                  Venture Name
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
                  onClick={() => setEditingVenture(null)}
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

      {/* CONFIGURE SECTIONS MODAL */}
      {configuringSectionsVenture && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-xl max-w-sm w-full p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f2]">
              <div>
                <h3 className="text-sm font-semibold text-[#09090b]">Configure Sections</h3>
                <p className="text-xs text-[#71717a]">
                  For <strong className="text-[#09090b]">{configuringSectionsVenture.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfiguringSectionsVenture(null)}
                className="p-1 text-[#71717a] hover:text-[#09090b] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSections} className="mt-4 space-y-4">
              <p className="text-xs text-[#71717a]">
                Enable or disable sections available for this specific venture. Employees can only access sections enabled here.
              </p>

              <div className="p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-lg max-h-56 overflow-y-auto space-y-2">
                {sectionsCatalog.map((sec) => (
                  <label key={sec.id} className="flex items-center gap-2 text-xs text-[#18181b] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSectionIds.includes(sec.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSectionIds([...selectedSectionIds, sec.id]);
                        } else {
                          setSelectedSectionIds(selectedSectionIds.filter((id) => id !== sec.id));
                        }
                      }}
                      className="rounded-xs border-[#e4e4e7] text-black focus:ring-black"
                    />
                    <span className="capitalize">{sec.name}</span>
                  </label>
                ))}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#f0f0f2]">
                <button
                  type="button"
                  onClick={() => setConfiguringSectionsVenture(null)}
                  className="px-3 py-1.5 text-xs text-[#52525b] hover:bg-[#f4f4f5] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#09090b] text-white rounded-lg hover:bg-black transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Sections</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
