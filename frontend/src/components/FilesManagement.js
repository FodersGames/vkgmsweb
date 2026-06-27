import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import {
  Upload, Download, Trash2, Edit2, RefreshCw, Key, Eye, EyeOff,
  CheckCircle, Loader2, FileText, AlertTriangle, Copy, Check,
  HardDrive, Star, X, GitBranch, ChevronDown, Plus, Image, ZoomIn,
} from 'lucide-react';

const IMAGE_EXTS = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
function isImageFile(filename) {
  const s = (filename || '').toLowerCase();
  return IMAGE_EXTS.some(e => s.endsWith(e));
}

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATFORMS = ['all', 'windows', 'mac', 'linux', 'android', 'ios'];
const FILE_TYPES = ['build', 'patch', 'config', 'asset', 'other'];
const PLATFORM_LABELS = { all: 'All', windows: 'Windows', mac: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS' };
const TYPE_LABELS = { build: 'Build', patch: 'Patch', config: 'Config', asset: 'Asset', other: 'Other' };

const PLATFORM_COLORS = {
  windows: 'bg-blue-50 text-blue-700 border-blue-200',
  mac:     'bg-zinc-100 text-zinc-700 border-zinc-200',
  linux:   'bg-orange-50 text-orange-700 border-orange-200',
  android: 'bg-green-50 text-green-700 border-green-200',
  ios:     'bg-zinc-100 text-zinc-600 border-zinc-200',
  all:     'bg-[#4ECDC4]/10 text-[#4ECDC4] border-[#4ECDC4]/30',
};

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const emptyUpload = { name: '', version: '', platform: 'all', file_type: 'build', description: '', version_tag: 'default', rotation_center_x: '', rotation_center_y: '' };

// ── Main component ────────────────────────────────────────────────────────────

export const FilesManagement = () => {
  const { token } = useAuth();
  const { selectedProject } = useProject();
  const headers = { Authorization: `Bearer ${token}` };
  const slug = selectedProject?.slug;

  const [files,       setFiles]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [apiKey,      setApiKey]      = useState(null);
  const [showKey,     setShowKey]     = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [showUpload,  setShowUpload]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadErr,   setUploadErr]   = useState('');
  const [form,        setForm]        = useState(emptyUpload);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [editSaving,  setEditSaving]  = useState(false);
  const [replacing,   setReplacing]   = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceSaving, setReplaceSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting,    setDeleting]    = useState(null);

  // Copy ID
  const [copiedId, setCopiedId] = useState('');

  // Image preview
  const [previews,       setPreviews]       = useState({});  // { fileId: blobUrl }
  const [previewLoading, setPreviewLoading] = useState(new Set());
  const [previewModal,   setPreviewModal]   = useState(null); // file object

  useEffect(() => {
    return () => { Object.values(previews).forEach(u => URL.revokeObjectURL(u)); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Version management
  const [versions,          setVersions]          = useState(['default']);
  const [activeVersionTag,  setActiveVersionTag]  = useState('all');
  const [versionDropOpen,   setVersionDropOpen]   = useState(false);
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [newVersionTag,     setNewVersionTag]     = useState('');
  const [creatingVersion,   setCreatingVersion]   = useState(false);
  const [createVersionErr,  setCreateVersionErr]  = useState('');

  const fileInputRef    = useRef(null);
  const replaceInputRef = useRef(null);
  const dropRef         = useRef(null);

  const loadVersions = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await axios.get(`${API_URL}/api/admin/projects/${slug}/versions`, { headers });
      setVersions(r.data.versions || ['default']);
    } catch {}
  }, [slug, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const params = activeVersionTag !== 'all' ? { version_tag: activeVersionTag } : {};
      const [filesRes, keyRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/projects/${slug}/files`, { headers, params }),
        axios.get(`${API_URL}/api/admin/projects/${slug}/files-api-key`, { headers }),
      ]);
      setFiles(filesRes.data.files || []);
      setApiKey(keyRes.data.files_api_key || null);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [slug, token, activeVersionTag]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); loadVersions(); }, [load, loadVersions]);

  // ── API key ───────────────────────────────────────────────────────────────

  const regenKey = async () => {
    if (!window.confirm('Regenerate the API key? All game clients using the old key will lose access.')) return;
    setRegenLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/admin/projects/${slug}/files-api-key/regenerate`, {}, { headers });
      setApiKey(r.data.files_api_key);
      setShowKey(true);
    } catch { /* silent */ } finally {
      setRegenLoading(false);
    }
  };

  const copyKey = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setSelectedFile(f); setForm(prev => ({ ...prev, name: prev.name || f.name.replace(/\.[^/.]+$/, '') })); }
  };

  const loadPreview = async (file) => {
    if (previews[file.id] || previewLoading.has(file.id)) return;
    setPreviewLoading(prev => new Set([...prev, file.id]));
    try {
      const res  = await fetch(`${API_URL}/api/admin/projects/${slug}/files/${file.id}/preview`, { headers });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setPreviews(prev => ({ ...prev, [file.id]: url }));
    } catch {}
    finally {
      setPreviewLoading(prev => { const n = new Set(prev); n.delete(file.id); return n; });
    }
  };

  const openPreview = (file) => {
    setPreviewModal(file);
    loadPreview(file);
  };

  const createVersion = async () => {
    const tag = newVersionTag.trim();
    if (!tag) { setCreateVersionErr('Version name is required.'); return; }
    if (!/^[a-zA-Z0-9._-]+$/.test(tag)) { setCreateVersionErr('Only letters, numbers, dots, dashes and underscores.'); return; }
    setCreatingVersion(true);
    setCreateVersionErr('');
    try {
      await axios.post(`${API_URL}/api/admin/projects/${slug}/versions`, { new_tag: tag }, { headers });
      setShowCreateVersion(false);
      setNewVersionTag('');
      await loadVersions();
      setActiveVersionTag(tag);
    } catch (e) {
      setCreateVersionErr(e.response?.data?.detail || 'Failed to create version.');
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { setUploadErr('Please select a file.'); return; }
    setUploadErr('');
    setUploading(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('name', form.name.trim() || selectedFile.name);
    fd.append('version', form.version.trim());
    fd.append('platform', form.platform);
    fd.append('file_type', form.file_type);
    fd.append('description', form.description.trim());
    fd.append('version_tag', form.version_tag || 'default');
    if (form.rotation_center_x !== '') fd.append('rotation_center_x', form.rotation_center_x);
    if (form.rotation_center_y !== '') fd.append('rotation_center_y', form.rotation_center_y);
    try {
      await axios.post(`${API_URL}/api/admin/projects/${slug}/files`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      setShowUpload(false);
      setForm(emptyUpload);
      setSelectedFile(null);
      load();
    } catch (e) {
      setUploadErr(e.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // ── Replace ───────────────────────────────────────────────────────────────

  const handleReplace = async () => {
    if (!replaceFile || !replacing) return;
    setReplaceSaving(true);
    const fd = new FormData();
    fd.append('file', replaceFile);
    try {
      await axios.put(`${API_URL}/api/admin/projects/${slug}/files/${replacing}/replace`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      setReplacing(null);
      setReplaceFile(null);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Replace failed.');
    } finally {
      setReplaceSaving(false);
    }
  };

  // ── Edit metadata ─────────────────────────────────────────────────────────

  const startEdit = (file) => {
    setEditingId(file.id);
    setEditForm({
      name: file.name,
      version: file.version || '',
      platform: file.platform || 'all',
      file_type: file.file_type || 'build',
      description: file.description || '',
      is_latest: file.is_latest || false,
      rotation_center_x: file.rotation_center_x ?? '',
      rotation_center_y: file.rotation_center_y ?? '',
    });
  };

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await axios.put(`${API_URL}/api/admin/projects/${slug}/files/${editingId}`, editForm, { headers });
      setEditingId(null);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Save failed.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Toggle latest ─────────────────────────────────────────────────────────

  const copyFileId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const toggleLatest = async (file) => {
    const next = !file.is_latest;
    // Optimistic update
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, is_latest: next } : f));
    try {
      await axios.put(`${API_URL}/api/admin/projects/${slug}/files/${file.id}`,
        { is_latest: next }, { headers });
    } catch (e) {
      // Revert on error
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, is_latest: !next } : f));
      toast.error(e.response?.data?.detail || 'Impossible de modifier le fichier');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (file) => {
    setDeleting(file.id);
    try {
      await axios.delete(`${API_URL}/api/admin/projects/${slug}/files/${file.id}`, { headers });
      setDeleteConfirm(null);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  // ── No project ────────────────────────────────────────────────────────────

  if (!slug) {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <HardDrive size={28} className="text-[#C9C3BB] mx-auto mb-3" />
          <p className="text-sm text-[#78716C]">Select a project to manage its files.</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-[#1C1917]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
            GAME FILES — {selectedProject?.name?.toUpperCase()}
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5">
            {files.length} file{files.length !== 1 ? 's' : ''} · stable ID per file
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowCreateVersion(v => !v); setCreateVersionErr(''); setNewVersionTag(''); }}
            className="flex items-center gap-1.5 border border-[#E8E3DB] hover:border-[#C9C3BB] text-[#78716C] hover:text-[#1C1917] text-xs font-semibold px-3 py-2.5 transition-colors"
          >
            <GitBranch size={12} /> New version
          </button>
          <button
            onClick={() => { setShowUpload(v => !v); setUploadErr(''); setSelectedFile(null); setForm({ ...emptyUpload, version_tag: activeVersionTag !== 'all' ? activeVersionTag : 'default' }); }}
            className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white text-xs font-semibold px-4 py-2.5 transition-colors"
          >
            <Upload size={13} /> Upload file
          </button>
        </div>
      </div>

      {/* Version filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.1em] uppercase">Version:</span>
        {['all', ...versions].map(tag => (
          <button
            key={tag}
            onClick={() => setActiveVersionTag(tag)}
            className={`text-xs font-semibold px-2.5 py-1 border transition-colors ${
              activeVersionTag === tag
                ? 'bg-[#1C1917] text-white border-[#1C1917]'
                : 'border-[#E8E3DB] text-[#78716C] hover:border-[#C9C3BB] hover:text-[#1C1917]'
            }`}
          >
            {tag}
          </button>
        ))}
        <button
          onClick={() => setVersionDropOpen(v => !v)}
          className="flex items-center gap-1 text-[10px] text-[#A8A29E] hover:text-[#4ECDC4] transition-colors"
        >
          <Plus size={10} /> add
        </button>
      </div>

      {/* Create version panel */}
      {(showCreateVersion || versionDropOpen) && (
        <div className="bg-white border border-[#E8E3DB] p-4 space-y-3">
          <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
            <GitBranch size={14} className="text-[#4ECDC4]" /> Create a new version
          </h3>
          <p className="text-xs text-[#78716C]">
            Clones all files marked <strong>is_latest</strong> into a new version tag. Files on disk are copied — existing versions are never touched.
          </p>
          <div className="flex gap-2 items-start">
            <input
              value={newVersionTag}
              onChange={e => setNewVersionTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createVersion()}
              placeholder="e.g. v1.1, v2.0-beta"
              className="flex-1 px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
            />
            <button
              onClick={createVersion}
              disabled={creatingVersion || !newVersionTag.trim()}
              className="flex items-center gap-1.5 bg-[#1C1917] hover:bg-[#2D2926] text-white text-xs font-semibold px-4 py-2.5 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {creatingVersion ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />}
              Create
            </button>
            <button onClick={() => { setShowCreateVersion(false); setVersionDropOpen(false); }} className="text-xs text-[#78716C] px-3 py-2.5 border border-[#E8E3DB] transition-colors">
              Cancel
            </button>
          </div>
          {createVersionErr && <p className="text-xs text-red-500">{createVersionErr}</p>}
        </div>
      )}

      {/* API Key section */}
      <div className="bg-white border border-[#E8E3DB] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-[#4ECDC4]" />
          <p className="text-xs font-bold text-[#1C1917]">Files API Key</p>
          <span className="text-[10px] text-[#A8A29E]">— used by the game client in header <code className="bg-[#F9F7F4] px-1">X-Files-Api-Key</code></span>
        </div>
        {apiKey ? (
          <div className="flex items-center gap-2 flex-wrap">
            <code className="flex-1 min-w-0 bg-[#F9F7F4] border border-[#E8E3DB] px-3 py-2 text-xs font-mono text-[#1C1917] truncate">
              {showKey ? apiKey : '•'.repeat(40)}
            </code>
            <button onClick={() => setShowKey(v => !v)} className="p-2 text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] transition-colors">
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button onClick={copyKey} className="p-2 text-[#78716C] hover:text-[#4ECDC4] border border-[#E8E3DB] transition-colors">
              {copied ? <Check size={13} className="text-[#4ECDC4]" /> : <Copy size={13} />}
            </button>
            <button
              onClick={regenKey}
              disabled={regenLoading}
              className="flex items-center gap-1.5 text-xs text-[#78716C] hover:text-red-500 border border-[#E8E3DB] px-2.5 py-2 transition-colors disabled:opacity-50"
            >
              {regenLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regen
            </button>
          </div>
        ) : (
          <button
            onClick={regenKey}
            disabled={regenLoading}
            className="flex items-center gap-2 text-xs font-semibold text-[#4ECDC4] border border-[#4ECDC4]/30 px-3 py-2 hover:bg-[#4ECDC4]/5 transition-colors disabled:opacity-50"
          >
            {regenLoading ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
            Generate API key
          </button>
        )}
        <p className="text-[10px] text-[#A8A29E]">
          Endpoint: <code className="bg-[#F9F7F4] px-1">{API_URL}/api/game/{slug}/files</code>
        </p>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="bg-white border border-[#E8E3DB] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#1C1917] border-b border-[#E8E3DB] pb-3">Upload a new file</h3>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#E8E3DB] hover:border-[#4ECDC4] bg-[#F9F7F4] hover:bg-[#4ECDC4]/5 transition-colors cursor-pointer p-8 text-center"
          >
            <Upload size={24} className="text-[#C9C3BB] mx-auto mb-2" />
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-[#1C1917]">{selectedFile.name}</p>
                <p className="text-xs text-[#78716C]">{formatBytes(selectedFile.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[#78716C]">Drop a file here or click to browse</p>
                <p className="text-[10px] text-[#A8A29E] mt-1">ZIP, EXE, APK, PAK, JSON… — max 500 MB</p>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setSelectedFile(f); setForm(prev => ({ ...prev, name: prev.name || f.name.replace(/\.[^/.]+$/, '') })); }
          }} />

          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Display name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Game v1.2.3 Windows"
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Version</label>
              <input
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="1.2.3"
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Type</label>
              <select
                value={form.file_type}
                onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
              >
                {FILE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Version tag</label>
              <div className="relative">
                <select
                  value={form.version_tag}
                  onChange={e => setForm(f => ({ ...f, version_tag: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917] appearance-none"
                >
                  {['default', ...versions.filter(v => v !== 'default')].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A8A29E] pointer-events-none" />
              </div>
            </div>
            {/* Rotation center — SVG seulement */}
            {isImageFile(selectedFile?.name || '') && (
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">
                  Centre de rotation <span className="font-normal normal-case text-[#C9C3BB]">(SVG/PNG — laisser vide = centre auto)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={form.rotation_center_x}
                    onChange={e => setForm(f => ({ ...f, rotation_center_x: e.target.value }))}
                    placeholder="X (auto)"
                    className="px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                  />
                  <input
                    type="number"
                    value={form.rotation_center_y}
                    onChange={e => setForm(f => ({ ...f, rotation_center_y: e.target.value }))}
                    placeholder="Y (auto)"
                    className="px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                  />
                </div>
                <p className="text-[9px] text-[#A8A29E] mt-1">Obtiens les valeurs avec le bloc TurboWarp <code className="bg-[#F9F7F4] px-1">centre rotation X costume [...] sprite [...]</code></p>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Description <span className="font-normal normal-case text-[#C9C3BB]">(optional)</span></label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Changelog, notes…"
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
              />
            </div>
          </div>

          {uploadErr && <p className="text-xs text-red-500">{uploadErr}</p>}

          <div className="flex gap-2 pt-1 border-t border-[#E8E3DB]">
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button onClick={() => setShowUpload(false)} className="text-sm text-[#78716C] hover:text-[#1C1917] px-4 py-2.5 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Replace modal */}
      {replacing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white border border-[#E8E3DB] p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1917]">Replace file content</h3>
              <button onClick={() => { setReplacing(null); setReplaceFile(null); }} className="text-[#A8A29E] hover:text-[#1C1917]"><X size={15} /></button>
            </div>
            <p className="text-xs text-[#78716C]">The ID and download URL stay the same. Only the file bytes are replaced.</p>
            <div
              onClick={() => replaceInputRef.current?.click()}
              className="border-2 border-dashed border-[#E8E3DB] hover:border-[#4ECDC4] bg-[#F9F7F4] transition-colors cursor-pointer p-6 text-center"
            >
              {replaceFile ? (
                <div>
                  <p className="text-sm font-semibold text-[#1C1917]">{replaceFile.name}</p>
                  <p className="text-xs text-[#78716C]">{formatBytes(replaceFile.size)}</p>
                </div>
              ) : (
                <p className="text-xs text-[#78716C]">Click to select new file</p>
              )}
            </div>
            <input ref={replaceInputRef} type="file" className="hidden" onChange={e => setReplaceFile(e.target.files?.[0] || null)} />
            <div className="flex gap-2">
              <button
                onClick={handleReplace}
                disabled={!replaceFile || replaceSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-colors"
              >
                {replaceSaving ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {replaceSaving ? 'Replacing…' : 'Replace'}
              </button>
              <button onClick={() => { setReplacing(null); setReplaceFile(null); }} className="text-sm text-[#78716C] px-4 py-2.5 border border-[#E8E3DB] hover:border-[#C9C3BB] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white border border-[#E8E3DB] p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1917]">Edit file metadata</h3>
              <button onClick={() => setEditingId(null)} className="text-[#A8A29E] hover:text-[#1C1917]"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'name', label: 'Display name', type: 'text', placeholder: 'Game v1.2.3 Windows' },
                { key: 'version', label: 'Version', type: 'text', placeholder: '1.2.3' },
                { key: 'description', label: 'Description', type: 'text', placeholder: 'Changelog, notes…' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">{label}</label>
                  <input
                    type={type}
                    value={editForm[key] || ''}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Platform</label>
                  <select
                    value={editForm.platform || 'all'}
                    onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">Type</label>
                  <select
                    value={editForm.file_type || 'build'}
                    onChange={e => setEditForm(f => ({ ...f, file_type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                  >
                    {FILE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              {/* Rotation center */}
              <div>
                <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.12em] uppercase mb-1">
                  Centre de rotation <span className="font-normal normal-case text-[#C9C3BB]">(vide = centre auto)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={editForm.rotation_center_x ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, rotation_center_x: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                    placeholder="X (auto)"
                    className="px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                  />
                  <input
                    type="number"
                    value={editForm.rotation_center_y ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, rotation_center_y: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                    placeholder="Y (auto)"
                    className="px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_latest || false}
                  onChange={e => setEditForm(f => ({ ...f, is_latest: e.target.checked }))}
                  className="accent-[#4ECDC4]"
                />
                <span className="text-xs text-[#1C1917] font-semibold">Mark as latest version</span>
              </label>
            </div>
            <div className="flex gap-2 pt-2 border-t border-[#E8E3DB]">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-colors"
              >
                {editSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setEditingId(null)} className="text-sm text-[#78716C] px-4 py-2.5 border border-[#E8E3DB] hover:border-[#C9C3BB] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="bg-white border border-[#E8E3DB] w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E3DB]">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1C1917] truncate">{previewModal.name}</p>
                <p className="text-[10px] text-[#A8A29E] mt-0.5">{previewModal.original_filename} · {formatBytes(previewModal.size_bytes)}</p>
              </div>
              <button onClick={() => setPreviewModal(null)} className="ml-4 text-[#A8A29E] hover:text-[#1C1917] shrink-0">
                <X size={15} />
              </button>
            </div>
            {/* Preview area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#F9F7F4] min-h-[200px]">
              {previews[previewModal.id] ? (
                <img
                  src={previews[previewModal.id]}
                  alt={previewModal.name}
                  className="max-w-full max-h-[70vh] object-contain"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-[#A8A29E]">
                  <Loader2 size={20} className="animate-spin" />
                  <p className="text-xs">Chargement…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white border border-[#E8E3DB] p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0" />
              <h3 className="text-sm font-bold text-[#1C1917]">Delete file?</h3>
            </div>
            <p className="text-xs text-[#78716C]">
              <strong className="text-[#1C1917]">{deleteConfirm.name}</strong> will be permanently removed from the server. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting === deleteConfirm.id}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-colors"
              >
                {deleting === deleteConfirm.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete permanently
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="text-sm text-[#78716C] px-4 py-2.5 border border-[#E8E3DB] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="text-center py-12 text-[#A8A29E] text-sm flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#E8E3DB]">
          <FileText size={28} className="text-[#C9C3BB] mx-auto mb-3" />
          <p className="text-sm text-[#78716C]">No files yet. Upload your first game file above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="bg-white border border-[#E8E3DB] hover:border-[#C9C3BB] transition-colors">
              {/* Main row */}
              <div className="flex items-start gap-4 p-4">
                {/* Thumbnail / icon */}
                {isImageFile(file.original_filename) ? (
                  <button
                    onClick={() => openPreview(file)}
                    className="w-10 h-10 bg-[#F9F7F4] border border-[#E8E3DB] flex items-center justify-center shrink-0 mt-0.5 overflow-hidden group relative hover:border-[#4ECDC4]/50 transition-colors"
                    title="Prévisualiser"
                  >
                    {previews[file.id] ? (
                      <>
                        <img src={previews[file.id]} alt="" className="w-full h-full object-contain" />
                        <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn size={11} className="text-white" />
                        </span>
                      </>
                    ) : previewLoading.has(file.id) ? (
                      <Loader2 size={12} className="animate-spin text-[#A8A29E]" />
                    ) : (
                      <>
                        <Image size={14} className="text-[#A8A29E] group-hover:hidden" />
                        <ZoomIn size={13} className="text-[#4ECDC4] hidden group-hover:block" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-10 h-10 bg-[#F9F7F4] border border-[#E8E3DB] flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={15} className="text-[#A8A29E]" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#1C1917] truncate">{file.name}</p>
                    {file.is_latest && (
                      <span className="flex items-center gap-1 text-[9px] font-bold bg-[#4ECDC4]/10 text-[#4ECDC4] border border-[#4ECDC4]/30 px-1.5 py-0.5 shrink-0">
                        <Star size={8} /> LATEST
                      </span>
                    )}
                    {file.version && (
                      <span className="text-[10px] text-[#78716C] bg-[#F9F7F4] border border-[#E8E3DB] px-1.5 py-0.5 shrink-0">
                        v{file.version}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={`text-[10px] font-semibold border px-1.5 py-0.5 ${PLATFORM_COLORS[file.platform] || PLATFORM_COLORS.all}`}>
                      {PLATFORM_LABELS[file.platform] || file.platform}
                    </span>
                    <span className="text-[10px] text-[#A8A29E]">{TYPE_LABELS[file.file_type] || file.file_type}</span>
                    <span className="text-[10px] text-[#A8A29E]">{formatBytes(file.size_bytes)}</span>
                    <span className="text-[10px] text-[#A8A29E]">{formatDate(file.uploaded_at)}</span>
                    <span className="text-[10px] text-[#A8A29E] flex items-center gap-1">
                      <Download size={9} /> {file.download_count || 0}
                    </span>
                  </div>
                  {file.description && (
                    <p className="text-xs text-[#78716C] mt-1 truncate">{file.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[9px] text-[#C9C3BB] font-mono">{file.id}</span>
                    <button
                      onClick={() => copyFileId(file.id)}
                      title="Copier l'ID"
                      className="flex items-center gap-0.5 text-[9px] text-[#A8A29E] hover:text-[#4ECDC4] transition-colors shrink-0"
                    >
                      {copiedId === file.id
                        ? <><Check size={9} className="text-[#4ECDC4]" /><span className="text-[#4ECDC4]">copié</span></>
                        : <><Copy size={9} /><span>copier ID</span></>
                      }
                    </button>
                    <span className="text-[9px] text-[#A8A29E] border border-[#E8E3DB] px-1.5 py-0.5 font-semibold shrink-0">
                      {file.version_tag || 'default'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleLatest(file)}
                    title={file.is_latest ? 'Retirer du marquage "latest" (utilisé pour cloner les versions)' : 'Marquer comme latest (sera inclus dans le clone de version)'}
                    className={`p-1.5 border transition-colors ${file.is_latest ? 'text-[#4ECDC4] border-[#4ECDC4]/30 bg-[#4ECDC4]/5' : 'text-[#A8A29E] border-[#E8E3DB] hover:text-[#4ECDC4] hover:border-[#4ECDC4]/30'}`}
                  >
                    <Star size={13} />
                  </button>
                  <button
                    onClick={() => { setReplacing(file.id); setReplaceFile(null); }}
                    title="Replace file content (ID stays the same)"
                    className="p-1.5 border border-[#E8E3DB] text-[#A8A29E] hover:text-[#1C1917] hover:border-[#C9C3BB] transition-colors"
                  >
                    <RefreshCw size={13} />
                  </button>
                  <button
                    onClick={() => startEdit(file)}
                    title="Edit metadata"
                    className="p-1.5 border border-[#E8E3DB] text-[#A8A29E] hover:text-[#1C1917] hover:border-[#C9C3BB] transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(file)}
                    title="Delete"
                    className="p-1.5 border border-[#E8E3DB] text-[#A8A29E] hover:text-red-500 hover:border-red-200 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilesManagement;
