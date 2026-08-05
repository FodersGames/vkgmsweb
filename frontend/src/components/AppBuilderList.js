import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, Copy, ExternalLink, Globe, Lock, Upload, Download, Sparkles, Search, Building2, Users, ClipboardCheck, ShieldAlert, ShieldCheck, Clock, ThumbsDown, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import AppBuilderEditor from './AppBuilderEditor';
import { APP_TEMPLATES, APP_TEMPLATE_MAP } from '../constants/appBuilderTemplates';
import { THEME_MAP } from '../constants/appBuilder';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const SEGMENTS = [
  { id: 'all',       label: 'All',            icon: null },
  { id: 'house',     label: 'Vakar Apps',     icon: Building2 },
  { id: 'community', label: 'Community Apps', icon: Users },
];

const REVIEW_PILL = {
  approved: { label: 'Approved',         icon: Check,      cls: 'bg-emerald-500/10 text-emerald-500' },
  pending:  { label: 'Pending review',   icon: Clock,      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  rejected: { label: 'Changes requested', icon: ThumbsDown, cls: 'bg-red-500/10 text-red-500' },
};

const SORTS = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'name',    label: 'Name A–Z' },
  { id: 'oldest',  label: 'Oldest first' },
  { id: 'earnings', label: 'Most earnings' },
];

export default function AppBuilderList({ onNavigate }) {
  const { token } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const importInputRef = useRef(null);

  // ── Management console: segment / search / filters / sort ───────────────
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVisibility, setFilterVisibility] = useState('');
  const [filterReview, setFilterReview] = useState('');
  const [suspendedOnly, setSuspendedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('updated');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/studio-apps`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setApps(data.apps || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (!editingId) load(); }, [load, editingId]);

  const createApp = async () => {
    if (!newName.trim()) return;
    const tpl = selectedTemplateId ? APP_TEMPLATE_MAP[selectedTemplateId] : null;
    const r = await fetch(`${API}/api/admin/studio-apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: newName.trim(),
        ...(tpl ? { theme: tpl.theme, screens: tpl.screens, variables: tpl.variables } : {}),
      }),
    });
    const data = await r.json();
    setNewName('');
    setSelectedTemplateId(null);
    setCreating(false);
    if (data.id) setEditingId(data.id);
  };

  const duplicateApp = async (id) => {
    await fetch(`${API}/api/admin/studio-apps/${id}/duplicate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const deleteApp = async (id) => {
    setDeleting(true);
    try {
      await fetch(`${API}/api/admin/studio-apps/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setConfirm(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const importApp = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch(`${API}/api/admin/studio-apps/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Could not import this file.');
      setEditingId(data.id);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const exportApp = async (a) => {
    setExportingId(a.id);
    try {
      const r = await fetch(`${API}/api/admin/studio-apps/${a.id}/export-file`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${a.slug}.vakarstudio`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setImportError('Could not export this app.');
    } finally {
      setExportingId(null);
    }
  };

  // ── Derived: counts, filtered + sorted list ──────────────────────────────
  const counts = useMemo(() => ({
    all: apps.length,
    house: apps.filter(a => !a.is_user_app).length,
    community: apps.filter(a => a.is_user_app).length,
    published: apps.filter(a => a.status === 'published').length,
    draft: apps.filter(a => a.status === 'draft').length,
    suspended: apps.filter(a => a.admin_takedown).length,
  }), [apps]);

  const visibleApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = apps.filter(a => {
      if (segment === 'house' && a.is_user_app) return false;
      if (segment === 'community' && !a.is_user_app) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterVisibility && a.visibility !== filterVisibility) return false;
      if (segment === 'community' && filterReview && (a.review_status || 'none') !== filterReview) return false;
      if (segment === 'community' && suspendedOnly && !a.admin_takedown) return false;
      if (q && !(a.name?.toLowerCase().includes(q) || a.slug?.toLowerCase().includes(q) || a.owner?.toLowerCase().includes(q))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'earnings') return (b.total_sales_cents || 0) - (a.total_sales_cents || 0);
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    return list;
  }, [apps, segment, search, filterStatus, filterVisibility, filterReview, suspendedOnly, sortBy]);

  if (editingId) {
    return <AppBuilderEditor appId={editingId} onBack={() => setEditingId(null)} />;
  }

  const StatCard = ({ label, value, tone }) => (
    <div className={`rounded-xl border px-4 py-3 ${tone === 'danger' ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20' : 'bg-white dark:bg-[#151520] border-[#D2D2D7] dark:border-[#2a2a3c]'}`}>
      <p className={`text-xl font-bold ${tone === 'danger' ? 'text-red-500' : 'text-[#1D1D1F] dark:text-[#e4e4e7]'}`}>{value}</p>
      <p className={`text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${tone === 'danger' ? 'text-red-500/80' : 'text-[#A1A1A6] dark:text-[#71717a]'}`}>{label}</p>
    </div>
  );

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">App Builder</h2>
            <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">Build internal tools and player-facing mini-apps visually — no code required</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Upload} loading={importing} onClick={() => importInputRef.current?.click()}>Import</Button>
            <input ref={importInputRef} type="file" accept=".vakarstudio" className="hidden" onChange={importApp} />
            <Button icon={Plus} onClick={() => setCreating(true)}>New App</Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total apps" value={counts.all} />
          <StatCard label="Published" value={counts.published} />
          <StatCard label="Drafts" value={counts.draft} />
          <StatCard label="Vakar apps" value={counts.house} />
          <StatCard label="Community" value={counts.community} />
          {counts.suspended > 0 && <StatCard label="Suspended" value={counts.suspended} tone="danger" />}
        </div>

        {importError && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
            <span>{importError}</span>
            <button onClick={() => setImportError('')}>×</button>
          </div>
        )}

        {creating && (
          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 space-y-4">
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createApp()}
              placeholder="App name, e.g. 'Support triage tool'"
              className="w-full rounded-lg px-3 py-2 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-[#4ECDC4]"
            />
            <div>
              <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Start from</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setSelectedTemplateId(null)}
                  className={`rounded-lg p-2.5 text-left border-2 transition-all ${!selectedTemplateId ? 'border-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4]'}`}
                >
                  <div className="w-full h-10 rounded-md bg-[#F5F5F7] dark:bg-[#0d0d14] border border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center mb-1.5">
                    <Plus size={13} className="text-[#A1A1A6]" />
                  </div>
                  <p className="text-[11px] font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Blank</p>
                </button>
                {APP_TEMPLATES.map(tpl => {
                  const theme = THEME_MAP[tpl.theme];
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => { setSelectedTemplateId(tpl.id); if (!newName.trim()) setNewName(tpl.label); }}
                      title={tpl.description}
                      className={`relative rounded-lg p-2.5 text-left border-2 transition-all ${selectedTemplateId === tpl.id ? 'border-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4]'}`}
                    >
                      {tpl.tier === 'premium' && (
                        <span title="Vakar+ template" className="absolute top-1.5 right-1.5 text-[#F2994A]"><Sparkles size={10} /></span>
                      )}
                      <div className="w-full h-10 rounded-md mb-1.5" style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.background})` }} />
                      <p className="text-[11px] font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{tpl.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={createApp}>Create</Button>
              <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewName(''); setSelectedTemplateId(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Segmented control */}
        <div className="inline-flex rounded-full bg-[#EDEDEF] dark:bg-[#1c1c2e] p-1 gap-1">
          {SEGMENTS.map(s => (
            <button
              key={s.id} onClick={() => setSegment(s.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${segment === s.id ? 'bg-white dark:bg-[#2a2a3c] text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#6E6E73] dark:text-[#a1a1aa]'}`}
            >
              {s.icon && <s.icon size={12} />}{s.label}
              <span className="text-[10px] opacity-60">{counts[s.id]}</span>
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a] pointer-events-none" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, slug, or owner…"
              className="rounded-lg w-full pl-9 pr-3 py-2 text-sm bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A1A1A6] dark:placeholder:text-[#52525b]"
            />
          </div>
          <Select size="sm" wrapperClassName="w-32" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
          <Select size="sm" wrapperClassName="w-32" value={filterVisibility} onChange={e => setFilterVisibility(e.target.value)}>
            <option value="">All visibility</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
          {segment === 'community' && (
            <>
              <Select size="sm" wrapperClassName="w-36" value={filterReview} onChange={e => setFilterReview(e.target.value)}>
                <option value="">All reviews</option>
                <option value="none">Never submitted</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
              <button
                onClick={() => setSuspendedOnly(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${suspendedOnly ? 'bg-red-500 border-red-500 text-white' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa]'}`}
              >
                <ShieldAlert size={12} />Suspended
              </button>
            </>
          )}
          <Select size="sm" wrapperClassName="w-40 ml-auto" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORTS.filter(s => s.id !== 'earnings' || segment === 'community').map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-xl bg-[#D2D2D7] dark:bg-[#1c1c2e] animate-pulse" />)}
          </div>
        ) : apps.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No apps yet"
            description="Create your first internal tool or mini-app — screens, components and actions, all visual."
            action={<Button icon={Plus} onClick={() => setCreating(true)}>New App</Button>}
          />
        ) : visibleApps.length === 0 ? (
          <EmptyState icon={Search} title="No apps match" description="Try a different search term or clear a filter." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleApps.map(a => {
              const reviewPill = a.is_user_app ? REVIEW_PILL[a.review_status] : null;
              return (
                <div key={a.id} className={`rounded-xl bg-white dark:bg-[#151520] border overflow-hidden flex flex-col ${a.admin_takedown ? 'border-red-300 dark:border-red-500/40' : 'border-[#D2D2D7] dark:border-[#2a2a3c]'}`}>
                  {a.admin_takedown && (
                    <div className="px-3.5 py-1.5 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 flex items-center gap-1.5">
                      <ShieldAlert size={11} className="text-red-500 shrink-0" />
                      <p className="text-[10px] text-red-600 dark:text-red-400 truncate">Suspended{a.admin_takedown_reason ? ` — ${a.admin_takedown_reason}` : ''}</p>
                    </div>
                  )}
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{a.name}</p>
                        <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] font-mono truncate">/{a.slug}</p>
                        <p className="text-[10px] mt-0.5 flex items-center gap-1">
                          {a.is_user_app ? (
                            <span className="text-[#A1A1A6] dark:text-[#71717a]">by {a.owner || 'unknown'}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#4ECDC4]"><Building2 size={9} />Vakar</span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${a.status === 'published' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-[#2a2a3c] text-zinc-500 dark:text-[#a1a1aa]'}`}>
                          {a.status}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#4ECDC4]/10 text-[#4ECDC4] flex items-center gap-1">
                          {a.visibility === 'public' ? <Globe size={9} /> : <Lock size={9} />}{a.visibility}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {reviewPill && (
                        <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded flex items-center gap-1 ${reviewPill.cls}`}>
                          <reviewPill.icon size={9} />{reviewPill.label}
                        </span>
                      )}
                      {a.price_cents > 0 && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          ${(a.price_cents / 100).toFixed(2)}
                        </span>
                      )}
                      {a.review_tags?.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#F5F5F7] dark:bg-[#0d0d14] text-[#6E6E73] dark:text-[#a1a1aa]">{t}</span>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-[#A1A1A6] dark:text-[#71717a]">
                      <span>{a.screens_count} screen{a.screens_count === 1 ? '' : 's'}</span>
                      <span>·</span>
                      <span>updated {timeAgo(a.updated_at)}</span>
                    </div>

                    {a.is_user_app && a.total_sales_cents > 0 && (
                      <p className="text-[10px] text-[#6E6E73] dark:text-[#a1a1aa]">
                        <span className="font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">${(a.creator_earnings_cents / 100).toFixed(2)}</span> earned of ${(a.total_sales_cents / 100).toFixed(2)} in sales
                      </p>
                    )}

                    {a.is_user_app && a.review_status === 'pending' && onNavigate && (
                      <button onClick={() => onNavigate('app-reviews')} className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 self-start">
                        <ClipboardCheck size={10} />Go to Reviews
                      </button>
                    )}
                    {a.is_user_app && a.status === 'published' && onNavigate && (
                      <button onClick={() => onNavigate('app-published')} className="text-[10px] font-semibold text-[#4ECDC4] hover:underline flex items-center gap-1 self-start">
                        <ShieldCheck size={10} />Manage in Published Apps
                      </button>
                    )}

                    <div className="flex-1" />
                    <div className="flex items-center gap-2 pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e]">
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditingId(a.id)}>Edit</Button>
                      {a.status === 'published' && (
                        <a
                          href={`/apps/${a.public_id}`} target="_blank" rel="noopener noreferrer" title="Open"
                          className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06]"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => duplicateApp(a.id)} title="Duplicate" className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06]">
                        <Copy size={14} />
                      </button>
                      <button onClick={() => exportApp(a)} disabled={exportingId === a.id} title="Export .vakarstudio" className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] disabled:opacity-40">
                        <Download size={14} />
                      </button>
                      <button onClick={() => setConfirm(a.id)} title="Delete" className="p-2 text-[#A1A1A6] hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => !deleting && setConfirm(null)}
        onConfirm={() => deleteApp(confirm)}
        title="Delete this app?"
        description="This permanently deletes all its screens and settings. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </>
  );
}
