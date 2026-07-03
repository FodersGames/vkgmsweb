import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import {
  ClipboardList, Plus, Edit2, Trash2, X, Save, Upload, CheckCircle,
  UserCheck, Undo2, ChevronDown, Image as ImageIcon,
  Flame, ArrowUp, Minus, Zap, Download, FileText, RotateCcw,
  MessageSquare, AlertCircle, History, ZoomIn,
} from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState } from '../ui';

const inputClass = 'w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg text-sm px-3 py-2.5 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 transition-colors placeholder:text-gray-400';
const labelClass = 'block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-widest';

const PRIORITY = {
  low:    { label: 'Low',    color: '#71717a', bg: 'bg-gray-100', Icon: Minus },
  medium: { label: 'Medium', color: '#2F80ED', bg: 'bg-blue-50', Icon: ArrowUp },
  high:   { label: 'High',   color: '#F2994A', bg: 'bg-orange-50', Icon: Flame },
  urgent: { label: 'Urgent', color: '#EB5757', bg: 'bg-error-50', Icon: Zap },
};

const STATUS = {
  open:        { label: 'Open',        color: '#4ECDC4', dot: 'bg-brand-400' },
  in_progress: { label: 'In Progress', color: '#F2994A', dot: 'bg-[#F2994A]' },
  completed:   { label: 'Completed',   color: '#27AE60', dot: 'bg-[#27AE60]' },
  cancelled:   { label: 'Cancelled',   color: '#71717a', dot: 'bg-[#71717a]' },
};

const FILTERS = ['all', 'open', 'in_progress', 'completed'];
const emptyForm = { title: '', description: '', style_description: '', reference_images: [], priority: 'medium' };

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif']);
const isImageExt = (name = '') => IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase());

const resolveUrl = (url) => url?.startsWith('/') ? `${API_URL}${url}` : url;

// Downloads a file via fetch→blob so the browser saves it in its original format
// regardless of cross-origin restrictions or browser "open in tab" behaviour for SVG/PDF.
const downloadFile = async (url, filename) => {
  try {
    const fullUrl = resolveUrl(url);
    const resp = await fetch(fullUrl);
    if (!resp.ok) throw new Error('Network error');
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename || fullUrl.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch { toast.error('Download failed'); }
};

const PriorityBadge = ({ p }) => {
  const { label, color, bg, Icon } = PRIORITY[p] || PRIORITY.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${bg}`} style={{ color }}>
      <Icon size={10} />{label}
    </span>
  );
};

const StatusBadge = ({ s }) => {
  const { label, color, dot } = STATUS[s] || STATUS.open;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
    </span>
  );
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const fmtSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
};

// ── Reference image card: preview + download in original format ──────────────
const RefImageCard = ({ url, onZoom }) => {
  const src = resolveUrl(url);
  const filename = url.split('/').pop();
  const ext = filename.split('.').pop()?.toUpperCase();
  return (
    <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
      <img src={src} alt="" className="h-28 w-auto max-w-[140px] object-contain block" />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        <button onClick={() => onZoom(src)}
          className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition-colors" title="Zoom">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => downloadFile(url, filename)}
          className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition-colors" title={`Download .${ext}`}>
          <Download size={14} />
        </button>
      </div>
      {/* Extension badge */}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/50 text-white/90 backdrop-blur-sm">
        {ext}
      </div>
    </div>
  );
};

// ── Delivery files: images as a preview grid, others as downloadable rows ────
const DeliveryFilesDisplay = ({ files, onZoom }) => {
  const images = files.filter(f => isImageExt(f.filename || f.url || ''));
  const others  = files.filter(f => !isImageExt(f.filename || f.url || ''));
  return (
    <div className="space-y-2">
      {/* Image previews grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((f, i) => {
            const src = resolveUrl(f.url);
            const filename = f.filename || f.url.split('/').pop();
            const ext = filename.split('.').pop()?.toUpperCase();
            return (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-square">
                <img src={src} alt={filename} className="w-full h-full object-contain" />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <div className="flex gap-2">
                    <button onClick={() => onZoom(src)}
                      className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition-colors" title="Zoom">
                      <ZoomIn size={16} />
                    </button>
                    <button onClick={() => downloadFile(f.url, filename)}
                      className="p-2 bg-white/15 hover:bg-white/25 rounded-lg text-white transition-colors" title={`Download .${ext}`}>
                      <Download size={16} />
                    </button>
                  </div>
                </div>
                {/* Bottom label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white/90 truncate font-medium">{filename}</p>
                  <p className="text-[9px] text-white/60">{ext}{f.size ? ` · ${fmtSize(f.size)}` : ''}</p>
                </div>
                {/* Extension badge */}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/50 text-white/90 backdrop-blur-sm">
                  {ext}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Non-image file rows */}
      {others.map((f, i) => {
        const filename = f.filename || f.url?.split('/').pop() || 'file';
        return (
          <button key={i} onClick={() => downloadFile(f.url, filename)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-[#27AE60]/50 group transition-all text-left">
            <FileText size={13} className="text-gray-500 group-hover:text-[#27AE60] transition-colors shrink-0" />
            <span className="text-xs font-medium text-gray-700 flex-1 truncate">{filename}</span>
            {f.size && <span className="text-[10px] text-gray-500 shrink-0">{fmtSize(f.size)}</span>}
            <Download size={12} className="text-gray-500 group-hover:text-[#27AE60] transition-colors shrink-0" />
          </button>
        );
      })}
    </div>
  );
};

export const MissionsManagement = () => {
  const { token, user, hasPermission } = useAuth();
  const { selectedProject } = useProject();

  const [missions, setMissions]                   = useState([]);
  const [loading, setLoading]                     = useState(false);
  const [filter, setFilter]                       = useState('all');
  const [showForm, setShowForm]                   = useState(false);
  const [editingMission, setEditingMission]       = useState(null);
  const [form, setForm]                           = useState(emptyForm);
  const [uploadingRef, setUploadingRef]           = useState(false);
  const [expandedImg, setExpandedImg]             = useState(null);
  const [expandedMission, setExpandedMission]     = useState(null);
  const [dialog, setDialog]                       = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading]       = useState(false);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  // Completion flow
  const [completingId, setCompletingId]           = useState(null);
  const [pendingFiles, setPendingFiles]           = useState([]);
  const [uploadingDelivery, setUploadingDelivery] = useState(false);

  // Reopen flow
  const [reopeningId, setReopeningId]     = useState(null);
  const [reopenFeedback, setReopenFeedback] = useState('');
  const [keepAssigned, setKeepAssigned]   = useState(true);

  const canCreate = user?.is_super_admin || hasPermission('create_missions');
  const canClaim  = user?.is_super_admin || hasPermission('claim_missions');
  const canManage = user?.is_super_admin || hasPermission('manage_missions');

  const fetchMissions = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/projects/${selectedProject.slug}/missions`);
      setMissions(r.data.missions);
    } catch { toast.error('Failed to load missions'); }
    finally { setLoading(false); }
  }, [selectedProject?.slug]);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  const resetCompletionForm = () => { setCompletingId(null); setPendingFiles([]); };
  const resetReopenForm     = () => { setReopeningId(null); setReopenFeedback(''); setKeepAssigned(true); };

  // ── Ref image upload ──
  const uploadRefImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingRef(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post(`/api/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, reference_images: [...f.reference_images, r.data.url] }));
      toast.success('Image added');
    } catch { toast.error('Upload failed'); }
    finally { setUploadingRef(false); }
  };

  // ── Delivery upload ──
  const uploadDelivery = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingDelivery(true);
    let ok = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const r = await api.post(`/api/upload-delivery`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setPendingFiles(prev => [...prev, { url: r.data.url, filename: r.data.filename, size: r.data.size }]);
        ok++;
      } catch (err) { toast.error(`Failed: ${file.name}`); }
    }
    if (ok > 0) toast.success(`${ok} file${ok > 1 ? 's' : ''} ready`);
    setUploadingDelivery(false);
    e.target.value = '';
  };

  // ── Mission CRUD ──
  const openCreate = () => { setEditingMission(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (m) => {
    setEditingMission(m);
    setForm({ title: m.title, description: m.description, style_description: m.style_description, reference_images: m.reference_images || [], priority: m.priority });
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    try {
      if (editingMission) {
        await api.put(`/api/projects/${selectedProject.slug}/missions/${editingMission.id}`, form);
        toast.success('Mission updated');
      } else {
        await api.post(`/api/projects/${selectedProject.slug}/missions`, form);
        toast.success('Mission posted');
      }
      setShowForm(false);
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
  };

  const claimMission = async (id) => {
    try {
      await api.post(`/api/projects/${selectedProject.slug}/missions/${id}/claim`, {});
      toast.success('Mission claimed!');
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const unclaimMission = async (id) => {
    try {
      await api.post(`/api/projects/${selectedProject.slug}/missions/${id}/unclaim`, {});
      toast.success('Mission unclaimed');
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const submitCompletion = async () => {
    if (!completingId) return;
    try {
      await api.post(`/api/projects/${selectedProject.slug}/missions/${completingId}/complete`, { delivery_files: pendingFiles });
      toast.success('Work submitted!');
      resetCompletionForm();
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const submitReopen = async () => {
    if (!reopeningId) return;
    try {
      await api.post(`/api/projects/${selectedProject.slug}/missions/${reopeningId}/reopen`, { feedback: reopenFeedback, keep_assigned: keepAssigned });
      toast.success('Mission reopened');
      resetReopenForm();
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const deleteMission = (m) => {
    showConfirm({
      title: 'Delete mission',
      description: `"${m.title}" will be permanently deleted including all delivery files and revision history.`,
      onConfirm: async () => {
        await api.delete(`/api/projects/${selectedProject.slug}/missions/${m.id}`);
        toast.success('Deleted');
        fetchMissions();
      },
    });
  };

  if (!selectedProject) {
    return (
      <div className="max-w-4xl">
        <Card>
          <EmptyState icon={ClipboardList} title="No project selected" description="Select a project to view its missions." />
        </Card>
      </div>
    );
  }

  const displayed = filter === 'all' ? missions : missions.filter(m => m.status === filter);
  const counts = { all: missions.length };
  FILTERS.slice(1).forEach(f => { counts[f] = missions.filter(m => m.status === f).length; });

  return (
    <>
    <div className="max-w-4xl space-y-4">

      {/* ── FILTERS + NEW ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize flex items-center gap-1.5 ${
                filter === f
                  ? 'bg-[#6C5CE7] text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-[#6C5CE7]/40'
              }`}>
              {f === 'all' ? 'All' : STATUS[f]?.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filter === f ? 'bg-white/20 text-white' : 'bg-gray-100 bg-gray-200 text-gray-500'}`}>
                {counts[f] ?? 0}
              </span>
            </button>
          ))}
        </div>
        {canCreate && (
          <Button variant="purple" icon={Plus} onClick={openCreate}>
            New Mission
          </Button>
        )}
      </div>

      {/* ── CREATE / EDIT FORM ── */}
      {showForm && (
        <Card className="overflow-hidden border-[#6C5CE7]/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#6C5CE718' }}>
                <ClipboardList size={13} style={{ color: '#6C5CE7' }} />
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {editingMission ? 'Edit Mission' : 'New Mission Request'}
              </span>
            </div>
            <Button variant="ghost" size="sm" icon={X} onClick={() => setShowForm(false)} />
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelClass}>Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputClass} placeholder="e.g. Draw a stone block item" />
              </div>
              <div className="w-36 shrink-0">
                <label className={labelClass}>Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputClass}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={`${inputClass} resize-none`} rows={3}
                placeholder="Describe exactly what you need (purpose, context, usage in game…)" />
            </div>
            <div>
              <label className={labelClass}>Visual Style Notes</label>
              <textarea value={form.style_description} onChange={e => setForm(f => ({ ...f, style_description: e.target.value }))}
                className={`${inputClass} resize-none`} rows={2}
                placeholder="Pixel art 16×16, dark grey palette, fits existing stone theme…" />
            </div>
            <div>
              <label className={labelClass}>Reference Files <span className="text-gray-500 normal-case font-normal">(images, SVG…)</span></label>
              <div className="flex flex-wrap gap-2">
                {form.reference_images.map((url, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={resolveUrl(url)} alt="" className="w-full h-full object-contain" />
                    <button onClick={() => setForm(f => ({ ...f, reference_images: f.reference_images.filter((_, i) => i !== idx) }))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors text-gray-400 ${uploadingRef ? 'opacity-50 cursor-wait' : 'border-gray-300 border-gray-200 hover:border-[#6C5CE7]/50 hover:text-[#6C5CE7]'}`}>
                  <Upload size={16} />
                  <span className="text-[10px] mt-1">{uploadingRef ? '…' : 'Add'}</span>
                  <input type="file" accept="image/*,.svg" className="hidden" onChange={uploadRefImage} disabled={uploadingRef} />
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="purple" icon={Save} onClick={submitForm}>
                {editingMission ? 'Save Changes' : 'Post Mission'}
              </Button>
              <Button variant="secondary" icon={X} onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── MISSIONS LIST ── */}
      {loading ? (
        <div className="py-12 text-center text-gray-500 text-sm">Loading…</div>
      ) : displayed.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={filter === 'all' ? 'No missions yet' : `No ${STATUS[filter]?.label.toLowerCase()} missions`}
            description={filter === 'all' ? 'Create a mission to request assets or tasks from your team.' : undefined}
            action={canCreate && filter === 'all' ? <Button variant="purple" icon={Plus} onClick={openCreate}>Post first mission</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(m => {
            const myName        = user?.username;
            const isClaimedByMe = m.claimed_by === myName;
            const isCreatedByMe = m.created_by === myName;
            const canEditThis   = canManage || isCreatedByMe;
            const canDeleteThis = canManage || isCreatedByMe;
            const canReopenThis = canManage || isCreatedByMe;
            const isExpanded    = expandedMission === m.id;
            const isCompleting  = completingId === m.id;
            const isReopening   = reopeningId === m.id;
            const hasDetails    = m.style_description || m.reference_images?.length > 0
                               || m.delivery_files?.length > 0 || m.revisions?.length > 0;

            return (
              <div key={m.id}
                className={`bg-white rounded-xl border transition-all overflow-hidden ${
                  m.status === 'completed'   ? 'border-[#27AE60]/30' :
                  m.status === 'cancelled'   ? 'border-gray-200 opacity-60' :
                  m.status === 'in_progress' ? 'border-[#F2994A]/40' :
                  'border-gray-200'
                }`}>

                {/* ── Card header ── */}
                <div className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ backgroundColor: PRIORITY[m.priority]?.color || '#71717a' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{m.title}</h3>
                        <PriorityBadge p={m.priority} />
                        <StatusBadge s={m.status} />
                        {m.revisions?.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                            <History size={10} />Round {m.revisions.length}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                        <span>by <span className="font-medium text-gray-600">{m.created_by}</span></span>
                        <span>{timeAgo(m.created_at)}</span>
                        {m.claimed_by && <span>· <span className="text-[#F2994A] font-medium">{m.claimed_by}</span></span>}
                        {m.completed_at && <span>· done {timeAgo(m.completed_at)}</span>}
                      </div>
                      {m.description && (
                        <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{m.description}</p>
                      )}
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {hasDetails && (
                        <button onClick={() => { setExpandedMission(isExpanded ? null : m.id); resetCompletionForm(); resetReopenForm(); }}
                          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-gray-100 text-gray-500 hover:text-gray-900 transition-all">
                          <ImageIcon size={11} />
                          {m.reference_images?.length > 0 && m.reference_images.length}
                          <ChevronDown size={10} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      {m.status === 'open' && canClaim && (
                        <button onClick={() => claimMission(m.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-400 border border-brand-400/30 transition-all">
                          <UserCheck size={12} />Claim
                        </button>
                      )}
                      {m.status === 'in_progress' && (isClaimedByMe || canManage) && (
                        <>
                          {!isCompleting && (
                            <button onClick={() => { setCompletingId(m.id); setPendingFiles([]); resetReopenForm(); setExpandedMission(m.id); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#27AE60]/10 hover:bg-[#27AE60]/20 text-[#27AE60] border border-[#27AE60]/30 transition-all">
                              <CheckCircle size={12} />Submit Work
                            </button>
                          )}
                          <button onClick={() => unclaimMission(m.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-500 hover:text-gray-900 border border-gray-200 transition-all">
                            <Undo2 size={12} />Unclaim
                          </button>
                        </>
                      )}
                      {m.status === 'completed' && canReopenThis && !isReopening && (
                        <button onClick={() => { setReopeningId(m.id); setReopenFeedback(''); setKeepAssigned(true); resetCompletionForm(); setExpandedMission(m.id); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#EB5757]/10 hover:bg-[#EB5757]/20 text-[#EB5757] border border-[#EB5757]/30 transition-all">
                          <RotateCcw size={12} />Reopen
                        </button>
                      )}
                      {canEditThis && m.status !== 'completed' && m.status !== 'cancelled' && (
                        <button onClick={() => openEdit(m)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/10 transition-all">
                          <Edit2 size={13} />
                        </button>
                      )}
                      {canDeleteThis && (
                        <button onClick={() => deleteMission(m)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-error-400 hover:bg-error-50 transition-all">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Expanded panel ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50">

                    {/* Submit Work form */}
                    {isCompleting && (
                      <div className="px-4 py-4 border-b border-gray-100 bg-[#27AE60]/5">
                        <p className="text-xs font-semibold text-[#27AE60] mb-3 flex items-center gap-1.5">
                          <CheckCircle size={13} />Submit your work files
                        </p>
                        <label className={`flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${uploadingDelivery ? 'opacity-50 cursor-wait border-[#27AE60]/30' : 'border-gray-300 border-gray-200 hover:border-[#27AE60]/50 hover:bg-[#27AE60]/5'}`}>
                          <Upload size={20} className="text-gray-400" />
                          <div className="text-center">
                            <p className="text-xs font-semibold text-gray-700">{uploadingDelivery ? 'Uploading…' : 'Click to add files'}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">PNG, SVG, PSD, ZIP, PDF… up to 50 MB per file · Multiple allowed</p>
                          </div>
                          <input type="file" multiple className="hidden" onChange={uploadDelivery} disabled={uploadingDelivery} />
                        </label>
                        {/* Preview of pending delivery files */}
                        {pendingFiles.length > 0 && (
                          <div className="mt-3">
                            <DeliveryFilesDisplay files={pendingFiles} onZoom={setExpandedImg} />
                            <div className="mt-2 space-y-0">
                              {/* Per-file remove buttons */}
                              {pendingFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between text-[11px] text-gray-500 py-0.5">
                                  <span className="truncate">{f.filename}</span>
                                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                                    className="ml-2 text-error-400 hover:text-error-500 shrink-0"><X size={11} /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button onClick={submitCompletion}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#27AE60] hover:bg-[#219a52] text-white rounded-lg text-sm font-semibold transition-all">
                            <CheckCircle size={13} />Mark as Done
                          </button>
                          <button onClick={resetCompletionForm}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg text-sm font-semibold transition-all">
                            <X size={13} />Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reopen form */}
                    {isReopening && (
                      <div className="px-4 py-4 border-b border-gray-100 bg-[#EB5757]/5">
                        <p className="text-xs font-semibold text-[#EB5757] mb-3 flex items-center gap-1.5">
                          <AlertCircle size={13} />Reopen — describe what needs to be corrected
                        </p>
                        <textarea value={reopenFeedback} onChange={e => setReopenFeedback(e.target.value)}
                          className={`${inputClass} resize-none`} rows={3}
                          placeholder="The stone texture is too smooth. Please add more shading detail…" />
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none mt-2.5">
                          <input type="checkbox" checked={keepAssigned} onChange={e => setKeepAssigned(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                          Keep assigned to <span className="font-semibold text-[#F2994A]">{m.claimed_by}</span>
                        </label>
                        <div className="flex gap-2 mt-3">
                          <button onClick={submitReopen} disabled={!reopenFeedback.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#EB5757] hover:bg-[#d44] disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-all">
                            <RotateCcw size={13} />Reopen Mission
                          </button>
                          <button onClick={resetReopenForm}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg text-sm font-semibold transition-all">
                            <X size={13} />Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Style notes + reference files */}
                    {(m.style_description || m.reference_images?.length > 0) && (
                      <div className="px-4 py-3 space-y-3 border-b border-gray-100">
                        {m.style_description && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Visual Style</p>
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{m.style_description}</p>
                          </div>
                        )}
                        {m.reference_images?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                              Reference Files <span className="normal-case font-normal">(hover to download in original format)</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {m.reference_images.map((url, i) => (
                                <RefImageCard key={i} url={url} onZoom={setExpandedImg} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Latest delivery files */}
                    {m.delivery_files?.length > 0 && (
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#27AE60] mb-2 flex items-center gap-1.5">
                          <Download size={10} />Delivered Work
                        </p>
                        <DeliveryFilesDisplay files={m.delivery_files} onZoom={setExpandedImg} />
                      </div>
                    )}

                    {/* Revision history */}
                    {m.revisions?.length > 0 && (
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                          <History size={10} />Revision History ({m.revisions.length} round{m.revisions.length > 1 ? 's' : ''})
                        </p>
                        <div className="space-y-2">
                          {[...m.revisions].reverse().map((rev, i) => (
                            <div key={i} className={`rounded-lg border overflow-hidden text-xs ${rev.feedback ? 'border-[#EB5757]/20' : 'border-[#27AE60]/20'}`}>
                              <div className="px-3 py-2 bg-[#27AE60]/5 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-semibold text-[#27AE60]">
                                  <CheckCircle size={11} />Round {rev.round} — {rev.delivered_by}
                                </span>
                                <span className="text-gray-500 text-[10px]">{timeAgo(rev.delivered_at)}</span>
                              </div>
                              {rev.delivery_files?.length > 0 && (
                                <div className="px-3 py-2 border-t border-[#27AE60]/10">
                                  <DeliveryFilesDisplay files={rev.delivery_files} onZoom={setExpandedImg} />
                                </div>
                              )}
                              {rev.feedback && (
                                <div className="px-3 py-2 bg-[#EB5757]/5 border-t border-[#EB5757]/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="flex items-center gap-1.5 font-semibold text-[#EB5757]">
                                      <MessageSquare size={11} />Feedback — {rev.feedback_by}
                                    </span>
                                    <span className="text-gray-500 text-[10px]">{timeAgo(rev.feedback_at)}</span>
                                  </div>
                                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{rev.feedback}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {expandedImg && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setExpandedImg(null)}>
          <img src={expandedImg} alt="" className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl" />
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={e => { e.stopPropagation(); downloadFile(expandedImg, expandedImg.split('/').pop()); }}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors" title="Download">
              <Download size={16} />
            </button>
            <button onClick={() => setExpandedImg(null)}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>

    <ConfirmDialog
      isOpen={dialog.open}
      onClose={closeConfirm}
      onConfirm={handleConfirm}
      title={dialog.title}
      description={dialog.description}
      confirmLabel="Delete"
      loading={confirmLoading}
      variant="destructive"
    />
    </>
  );
};
