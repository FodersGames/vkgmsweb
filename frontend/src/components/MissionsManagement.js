import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import {
  ClipboardList, Plus, Edit2, Trash2, X, Save, Upload, CheckCircle,
  UserCheck, Undo2, ChevronDown, Image as ImageIcon,
  Flame, ArrowUp, Minus, Zap, Download, FileText, RotateCcw,
  MessageSquare, AlertCircle, History,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const inputClass = 'w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#6C5CE7] focus:outline-none transition-all';
const labelClass = 'block text-xs font-semibold text-[#71717a] mb-1.5 uppercase tracking-wider';

const PRIORITY = {
  low:    { label: 'Low',    color: '#71717a', bg: 'bg-zinc-100 dark:bg-[#1c1c2e]', Icon: Minus },
  medium: { label: 'Medium', color: '#2F80ED', bg: 'bg-blue-50 dark:bg-blue-950/30', Icon: ArrowUp },
  high:   { label: 'High',   color: '#F2994A', bg: 'bg-orange-50 dark:bg-orange-950/20', Icon: Flame },
  urgent: { label: 'Urgent', color: '#EB5757', bg: 'bg-red-50 dark:bg-red-950/20', Icon: Zap },
};

const STATUS = {
  open:        { label: 'Open',        color: '#4ECDC4', dot: 'bg-[#4ECDC4]' },
  in_progress: { label: 'In Progress', color: '#F2994A', dot: 'bg-[#F2994A]' },
  completed:   { label: 'Completed',   color: '#27AE60', dot: 'bg-[#27AE60]' },
  cancelled:   { label: 'Cancelled',   color: '#71717a', dot: 'bg-[#71717a]' },
};

const FILTERS = ['all', 'open', 'in_progress', 'completed'];
const emptyForm = { title: '', description: '', style_description: '', reference_images: [], priority: 'medium' };

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

const FileIcon = ({ name = '' }) => {
  const ext = name.split('.').pop()?.toLowerCase();
  const isImg = ['png','jpg','jpeg','gif','webp','svg','bmp','tiff'].includes(ext);
  return isImg ? <ImageIcon size={13} /> : <FileText size={13} />;
};

const DeliveryFileRow = ({ file }) => {
  const url = file.url?.startsWith('/') ? `${API_URL}${file.url}` : file.url;
  return (
    <a href={url} download={file.filename} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#27AE60]/50 group transition-all">
      <span className="text-[#71717a] group-hover:text-[#27AE60] transition-colors shrink-0"><FileIcon name={file.filename} /></span>
      <span className="text-xs font-medium text-zinc-700 dark:text-[#e4e4e7] flex-1 truncate">{file.filename || file.url?.split('/').pop()}</span>
      {file.size && <span className="text-[10px] text-[#71717a] shrink-0">{fmtSize(file.size)}</span>}
      <Download size={12} className="text-[#71717a] group-hover:text-[#27AE60] transition-colors shrink-0" />
    </a>
  );
};

export const MissionsManagement = () => {
  const { token, user, hasPermission } = useAuth();
  const { selectedProject } = useProject();

  const [missions, setMissions]             = useState([]);
  const [loading, setLoading]               = useState(false);
  const [filter, setFilter]                 = useState('all');
  const [showForm, setShowForm]             = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [form, setForm]                     = useState(emptyForm);
  const [uploadingRef, setUploadingRef]     = useState(false);
  const [expandedImg, setExpandedImg]       = useState(null);
  const [expandedMission, setExpandedMission] = useState(null);

  // Completion flow
  const [completingId, setCompletingId]       = useState(null); // mission id
  const [pendingFiles, setPendingFiles]       = useState([]);   // [{url, filename, size}]
  const [uploadingDelivery, setUploadingDelivery] = useState(false);

  // Reopen flow
  const [reopeningId, setReopeningId]   = useState(null);
  const [reopenFeedback, setReopenFeedback] = useState('');
  const [keepAssigned, setKeepAssigned] = useState(true);

  const canCreate  = user?.is_super_admin || hasPermission('create_missions');
  const canClaim   = user?.is_super_admin || hasPermission('claim_missions');
  const canManage  = user?.is_super_admin || hasPermission('manage_missions');

  const fetchMissions = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/projects/${selectedProject.slug}/missions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMissions(r.data.missions);
    } catch { toast.error('Failed to load missions'); }
    finally { setLoading(false); }
  }, [selectedProject?.slug, token]);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  // Reset delivery/reopen state when switching missions
  const resetCompletionForm = () => { setCompletingId(null); setPendingFiles([]); };
  const resetReopenForm = () => { setReopeningId(null); setReopenFeedback(''); setKeepAssigned(true); };

  // ── Reference image upload (for mission creation) ──
  const uploadRefImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingRef(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await axios.post(`${API_URL}/api/upload`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, reference_images: [...f.reference_images, r.data.url] }));
      toast.success('Image added');
    } catch { toast.error('Upload failed'); }
    finally { setUploadingRef(false); }
  };

  // ── Delivery file upload (for completing a mission) ──
  const uploadDelivery = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingDelivery(true);
    let uploaded = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const r = await axios.post(`${API_URL}/api/upload-delivery`, fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        setPendingFiles(prev => [...prev, { url: r.data.url, filename: r.data.filename, size: r.data.size }]);
        uploaded++;
      } catch (err) { toast.error(`Failed to upload ${file.name}: ${err.response?.data?.detail || 'error'}`); }
    }
    if (uploaded > 0) toast.success(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded`);
    setUploadingDelivery(false);
    e.target.value = '';
  };

  const removeDeliveryFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

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
        await axios.put(`${API_URL}/api/projects/${selectedProject.slug}/missions/${editingMission.id}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Mission updated');
      } else {
        await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/missions`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Mission posted');
      }
      setShowForm(false);
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
  };

  const claimMission = async (id) => {
    try {
      await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/missions/${id}/claim`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Mission claimed!');
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const unclaimMission = async (id) => {
    try {
      await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/missions/${id}/unclaim`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Mission unclaimed');
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const submitCompletion = async () => {
    if (!completingId) return;
    try {
      await axios.post(
        `${API_URL}/api/projects/${selectedProject.slug}/missions/${completingId}/complete`,
        { delivery_files: pendingFiles },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Work submitted!');
      resetCompletionForm();
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const submitReopen = async () => {
    if (!reopeningId) return;
    try {
      await axios.post(
        `${API_URL}/api/projects/${selectedProject.slug}/missions/${reopeningId}/reopen`,
        { feedback: reopenFeedback, keep_assigned: keepAssigned },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Mission reopened');
      resetReopenForm();
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const deleteMission = async (m) => {
    if (!window.confirm(`Delete mission "${m.title}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/projects/${selectedProject.slug}/missions/${m.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Deleted');
      fetchMissions();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  if (!selectedProject) {
    return (
      <div className="max-w-4xl">
        <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] p-8 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-zinc-300 dark:text-[#71717a]" />
          <p className="text-sm text-[#71717a]">Select a project to view missions.</p>
        </div>
      </div>
    );
  }

  const displayed = filter === 'all' ? missions : missions.filter(m => m.status === filter);
  const counts = { all: missions.length };
  FILTERS.slice(1).forEach(f => { counts[f] = missions.filter(m => m.status === f).length; });

  return (
    <div className="max-w-4xl space-y-4">

      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize flex items-center gap-1.5 ${
                filter === f
                  ? 'bg-[#6C5CE7] text-white'
                  : 'bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a] hover:border-[#6C5CE7]/40'
              }`}>
              {f === 'all' ? 'All' : STATUS[f]?.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-[#2a2a3c] text-[#71717a]'}`}>
                {counts[f] ?? 0}
              </span>
            </button>
          ))}
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg text-sm font-semibold transition-all">
            <Plus size={14} />New Mission
          </button>
        )}
      </div>

      {/* ── CREATE / EDIT FORM ── */}
      {showForm && (
        <div className="bg-white dark:bg-[#151520] rounded-xl border border-[#6C5CE7]/40 shadow-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a3c] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center">
                <ClipboardList size={13} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">
                {editingMission ? 'Edit Mission' : 'New Mission Request'}
              </span>
            </div>
            <button onClick={() => setShowForm(false)} className="text-[#71717a] hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-4">
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
              <label className={labelClass}>Reference Images</label>
              <div className="flex flex-wrap gap-2">
                {form.reference_images.map((url, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-zinc-200 dark:border-[#2a2a3c]">
                    <img src={url.startsWith('/') ? `${API_URL}${url}` : url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setForm(f => ({ ...f, reference_images: f.reference_images.filter((_, i) => i !== idx) }))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors text-zinc-400 dark:text-[#71717a] ${uploadingRef ? 'opacity-50 cursor-wait' : 'border-zinc-300 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/50 hover:text-[#6C5CE7]'}`}>
                  <Upload size={16} />
                  <span className="text-[10px] mt-1">{uploadingRef ? '…' : 'Add'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={uploadRefImage} disabled={uploadingRef} />
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={submitForm}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg text-sm font-semibold transition-all">
                <Save size={13} />{editingMission ? 'Save Changes' : 'Post Mission'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm font-semibold transition-all">
                <X size={13} />Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MISSIONS LIST ── */}
      {loading ? (
        <div className="py-12 text-center text-[#71717a] text-sm">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] p-10 text-center">
          <ClipboardList size={28} className="mx-auto mb-3 text-zinc-300 dark:text-[#2a2a3c]" />
          <p className="text-sm text-[#71717a]">
            {filter === 'all' ? 'No missions yet.' : `No ${STATUS[filter]?.label.toLowerCase()} missions.`}
          </p>
          {canCreate && filter === 'all' && (
            <button onClick={openCreate} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg text-sm font-semibold transition-all">
              <Plus size={13} />Post first mission
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(m => {
            const myName = user?.username;
            const isClaimedByMe  = m.claimed_by === myName;
            const isCreatedByMe  = m.created_by === myName;
            const canEditThis    = canManage || isCreatedByMe;
            const canDeleteThis  = canManage || isCreatedByMe;
            const canReopenThis  = canManage || isCreatedByMe;
            const isExpanded     = expandedMission === m.id;
            const isCompleting   = completingId === m.id;
            const isReopening    = reopeningId === m.id;
            const hasDetails     = m.style_description || m.reference_images?.length > 0
                                || m.delivery_files?.length > 0 || m.revisions?.length > 0;

            return (
              <div key={m.id}
                className={`bg-white dark:bg-[#151520] rounded-xl border transition-all overflow-hidden ${
                  m.status === 'completed' ? 'border-[#27AE60]/30' :
                  m.status === 'cancelled' ? 'border-zinc-200 dark:border-[#2a2a3c] opacity-60' :
                  m.status === 'in_progress' ? 'border-[#F2994A]/40' :
                  'border-zinc-200 dark:border-[#2a2a3c]'
                }`}>

                {/* ── Card header ── */}
                <div className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ backgroundColor: PRIORITY[m.priority]?.color || '#71717a' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">{m.title}</h3>
                        <PriorityBadge p={m.priority} />
                        <StatusBadge s={m.status} />
                        {m.revisions?.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#71717a] font-medium">
                            <History size={10} />Round {m.revisions.length}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#71717a]">
                        <span>by <span className="font-medium text-zinc-600 dark:text-[#a1a1aa]">{m.created_by}</span></span>
                        <span>{timeAgo(m.created_at)}</span>
                        {m.claimed_by && <span>· <span className="text-[#F2994A] font-medium">{m.claimed_by}</span></span>}
                        {m.completed_at && <span>· done {timeAgo(m.completed_at)}</span>}
                      </div>
                      {m.description && (
                        <p className="mt-1.5 text-xs text-zinc-500 dark:text-[#71717a] line-clamp-2">{m.description}</p>
                      )}
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {/* Expand */}
                      {hasDetails && (
                        <button onClick={() => { setExpandedMission(isExpanded ? null : m.id); resetCompletionForm(); resetReopenForm(); }}
                          className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-[#1c1c2e] text-zinc-500 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-white transition-all">
                          <ImageIcon size={11} />
                          {m.reference_images?.length > 0 && m.reference_images.length}
                          <ChevronDown size={10} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      {/* Claim */}
                      {m.status === 'open' && canClaim && (
                        <button onClick={() => claimMission(m.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#4ECDC4]/10 hover:bg-[#4ECDC4]/20 text-[#4ECDC4] border border-[#4ECDC4]/30 transition-all">
                          <UserCheck size={12} />Claim
                        </button>
                      )}
                      {/* Done (opens form) / Unclaim */}
                      {m.status === 'in_progress' && (isClaimedByMe || canManage) && (
                        <>
                          {!isCompleting && (
                            <button onClick={() => { setCompletingId(m.id); setPendingFiles([]); resetReopenForm(); setExpandedMission(m.id); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#27AE60]/10 hover:bg-[#27AE60]/20 text-[#27AE60] border border-[#27AE60]/30 transition-all">
                              <CheckCircle size={12} />Submit Work
                            </button>
                          )}
                          <button onClick={() => unclaimMission(m.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-[#1c1c2e] text-zinc-500 dark:text-[#71717a] hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-[#2a2a3c] transition-all">
                            <Undo2 size={12} />Unclaim
                          </button>
                        </>
                      )}
                      {/* Reopen */}
                      {m.status === 'completed' && canReopenThis && !isReopening && (
                        <button onClick={() => { setReopeningId(m.id); setReopenFeedback(''); setKeepAssigned(true); resetCompletionForm(); setExpandedMission(m.id); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#EB5757]/10 hover:bg-[#EB5757]/20 text-[#EB5757] border border-[#EB5757]/30 transition-all">
                          <RotateCcw size={12} />Reopen
                        </button>
                      )}
                      {/* Edit */}
                      {canEditThis && m.status !== 'completed' && m.status !== 'cancelled' && (
                        <button onClick={() => openEdit(m)}
                          className="p-1.5 rounded-lg text-zinc-400 dark:text-[#71717a] hover:text-[#6C5CE7] hover:bg-[#6C5CE7]/10 transition-all">
                          <Edit2 size={13} />
                        </button>
                      )}
                      {/* Delete */}
                      {canDeleteThis && (
                        <button onClick={() => deleteMission(m)}
                          className="p-1.5 rounded-lg text-zinc-400 dark:text-[#71717a] hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Expanded panel ── */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-[#1c1c2e] bg-slate-50 dark:bg-[#0d0d14]">

                    {/* Submit Work form */}
                    {isCompleting && (
                      <div className="px-4 py-4 border-b border-zinc-200 dark:border-[#1c1c2e] bg-[#27AE60]/5">
                        <p className="text-xs font-semibold text-[#27AE60] mb-3 flex items-center gap-1.5">
                          <CheckCircle size={13} />Submit your work
                        </p>
                        {/* Drop zone */}
                        <label className={`flex flex-col items-center justify-center gap-2 w-full py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${uploadingDelivery ? 'opacity-50 cursor-wait border-[#27AE60]/30' : 'border-zinc-300 dark:border-[#2a2a3c] hover:border-[#27AE60]/50 hover:bg-[#27AE60]/5'}`}>
                          <Upload size={20} className="text-zinc-400 dark:text-[#71717a]" />
                          <div className="text-center">
                            <p className="text-xs font-semibold text-zinc-700 dark:text-[#e4e4e7]">{uploadingDelivery ? 'Uploading…' : 'Click to add files'}</p>
                            <p className="text-[10px] text-[#71717a] mt-0.5">PNG, PSD, ZIP, PDF… up to 50 MB per file</p>
                          </div>
                          <input type="file" multiple className="hidden" onChange={uploadDelivery} disabled={uploadingDelivery} />
                        </label>
                        {/* Pending file list */}
                        {pendingFiles.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {pendingFiles.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#151520] border border-[#27AE60]/30">
                                <FileIcon name={f.filename} />
                                <span className="text-xs text-zinc-700 dark:text-[#e4e4e7] flex-1 truncate">{f.filename}</span>
                                <span className="text-[10px] text-[#71717a]">{fmtSize(f.size)}</span>
                                <button onClick={() => removeDeliveryFile(i)} className="text-[#71717a] hover:text-red-400 transition-colors"><X size={12} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button onClick={submitCompletion}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#27AE60] hover:bg-[#219a52] text-white rounded-lg text-sm font-semibold transition-all">
                            <CheckCircle size={13} />Mark as Done
                          </button>
                          <button onClick={resetCompletionForm}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm font-semibold transition-all">
                            <X size={13} />Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reopen form */}
                    {isReopening && (
                      <div className="px-4 py-4 border-b border-zinc-200 dark:border-[#1c1c2e] bg-[#EB5757]/5">
                        <p className="text-xs font-semibold text-[#EB5757] mb-3 flex items-center gap-1.5">
                          <AlertCircle size={13} />Reopen mission — describe what needs to be corrected
                        </p>
                        <textarea value={reopenFeedback} onChange={e => setReopenFeedback(e.target.value)}
                          className={`${inputClass} resize-none`} rows={3}
                          placeholder="The stone texture is too smooth. Please add more detail on the shading…" />
                        <div className="flex items-center gap-3 mt-2.5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-[#e4e4e7] select-none">
                            <input type="checkbox" checked={keepAssigned} onChange={e => setKeepAssigned(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                            Keep assigned to <span className="font-semibold text-[#F2994A]">{m.claimed_by}</span>
                          </label>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={submitReopen} disabled={!reopenFeedback.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#EB5757] hover:bg-[#d44] disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-all">
                            <RotateCcw size={13} />Reopen Mission
                          </button>
                          <button onClick={resetReopenForm}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm font-semibold transition-all">
                            <X size={13} />Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Details: style + reference images */}
                    {(m.style_description || m.reference_images?.length > 0) && (
                      <div className="px-4 py-3 space-y-3 border-b border-zinc-100 dark:border-[#1c1c2e]">
                        {m.style_description && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#71717a] mb-1">Visual Style</p>
                            <p className="text-xs text-zinc-700 dark:text-[#a1a1aa] whitespace-pre-wrap">{m.style_description}</p>
                          </div>
                        )}
                        {m.reference_images?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#71717a] mb-2">Reference Images</p>
                            <div className="flex flex-wrap gap-2">
                              {m.reference_images.map((url, i) => {
                                const src = url.startsWith('/') ? `${API_URL}${url}` : url;
                                return (
                                  <img key={i} src={src} alt=""
                                    className="h-24 w-auto rounded-lg object-cover border border-zinc-200 dark:border-[#2a2a3c] cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setExpandedImg(src)} />
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Latest delivery files */}
                    {m.delivery_files?.length > 0 && (
                      <div className="px-4 py-3 border-b border-zinc-100 dark:border-[#1c1c2e]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#27AE60] mb-2 flex items-center gap-1.5">
                          <Download size={10} />Delivered Files
                        </p>
                        <div className="space-y-1.5">
                          {m.delivery_files.map((f, i) => <DeliveryFileRow key={i} file={f} />)}
                        </div>
                      </div>
                    )}

                    {/* Revision history */}
                    {m.revisions?.length > 0 && (
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#71717a] mb-2 flex items-center gap-1.5">
                          <History size={10} />Revision History ({m.revisions.length} round{m.revisions.length > 1 ? 's' : ''})
                        </p>
                        <div className="space-y-2">
                          {[...m.revisions].reverse().map((rev, i) => (
                            <div key={i} className={`rounded-lg border overflow-hidden text-xs ${rev.feedback ? 'border-[#EB5757]/20' : 'border-[#27AE60]/20'}`}>
                              {/* Delivery row */}
                              <div className="px-3 py-2 bg-[#27AE60]/5 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-semibold text-[#27AE60]">
                                  <CheckCircle size={11} />Round {rev.round} — {rev.delivered_by}
                                </span>
                                <span className="text-[#71717a] text-[10px]">{timeAgo(rev.delivered_at)}</span>
                              </div>
                              {rev.delivery_files?.length > 0 && (
                                <div className="px-3 py-2 space-y-1 border-t border-[#27AE60]/10">
                                  {rev.delivery_files.map((f, j) => <DeliveryFileRow key={j} file={f} />)}
                                </div>
                              )}
                              {/* Feedback row */}
                              {rev.feedback && (
                                <div className="px-3 py-2 bg-[#EB5757]/5 border-t border-[#EB5757]/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="flex items-center gap-1.5 font-semibold text-[#EB5757]">
                                      <MessageSquare size={11} />Feedback — {rev.feedback_by}
                                    </span>
                                    <span className="text-[#71717a] text-[10px]">{timeAgo(rev.feedback_at)}</span>
                                  </div>
                                  <p className="text-zinc-700 dark:text-[#a1a1aa] whitespace-pre-wrap leading-relaxed">{rev.feedback}</p>
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setExpandedImg(null)}>
          <img src={expandedImg} alt="" className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl" />
          <button className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors" onClick={() => setExpandedImg(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
