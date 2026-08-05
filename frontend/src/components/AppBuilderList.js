import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Copy, ExternalLink, Globe, Lock, Upload, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import AppBuilderEditor from './AppBuilderEditor';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

export default function AppBuilderList() {
  const { token } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const importInputRef = useRef(null);

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
    const r = await fetch(`${API}/api/admin/studio-apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await r.json();
    setNewName('');
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

  if (editingId) {
    return <AppBuilderEditor appId={editingId} onBack={() => setEditingId(null)} />;
  }

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

        {importError && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
            <span>{importError}</span>
            <button onClick={() => setImportError('')}>×</button>
          </div>
        )}

        {creating && (
          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 flex items-center gap-3 flex-wrap">
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createApp()}
              placeholder="App name, e.g. 'Support triage tool'"
              className="flex-1 min-w-[200px] rounded-lg px-3 py-2 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-[#4ECDC4]"
            />
            <Button size="sm" onClick={createApp}>Create</Button>
            <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-[#D2D2D7] dark:bg-[#1c1c2e] animate-pulse" />)}
          </div>
        ) : apps.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No apps yet"
            description="Create your first internal tool or mini-app — screens, components and actions, all visual."
            action={<Button icon={Plus} onClick={() => setCreating(true)}>New App</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map(a => (
              <div key={a.id} className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{a.name}</p>
                    <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] font-mono truncate">/{a.slug}</p>
                    {a.is_user_app && (
                      <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-0.5">User app · by {a.owner || 'unknown'}</p>
                    )}
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
                <div className="flex-1" />
                <div className="flex items-center gap-2 pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e]">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditingId(a.id)}>Edit</Button>
                  {a.status === 'published' && (
                    <a
                      href={`/apps/${a.slug}`} target="_blank" rel="noopener noreferrer" title="Open"
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
            ))}
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
