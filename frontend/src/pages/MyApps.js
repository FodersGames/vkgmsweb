import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { PublicButton } from '../ui/PublicButton';
import AppBuilderEditor from '../components/AppBuilderEditor';
import {
  AppWindow, Plus, Copy, Trash, Globe, LockSimple, ArrowSquareOut, Crown, X, Check,
  UploadSimple, DownloadSimple,
} from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MyApps() {
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [apps, setApps] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    document.title = 'My Apps — Vakar Games';
    if (authLoading) return;
    if (!user) navigate('/login');
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/my/studio-apps`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setApps(data.apps || []);
      setQuota(data.quota || null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (!editingId) load(); }, [load, editingId]);

  const createApp = async () => {
    if (!newName.trim()) return;
    setCreateError('');
    const r = await fetch(`${API}/api/my/studio-apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await r.json();
    if (!r.ok) { setCreateError(data.detail || 'Could not create app.'); return; }
    setNewName('');
    setCreating(false);
    setEditingId(data.id);
  };

  const duplicateApp = async (id) => {
    const r = await fetch(`${API}/api/my/studio-apps/${id}/duplicate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) load();
  };

  const deleteApp = async (id) => {
    await fetch(`${API}/api/my/studio-apps/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirmDeleteId(null);
    load();
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
      const r = await fetch(`${API}/api/my/studio-apps/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
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
      const r = await fetch(`${API}/api/my/studio-apps/${a.id}/export-file`, { headers: { Authorization: `Bearer ${token}` } });
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

  if (authLoading || !user) return null;

  if (editingId) {
    return (
      <div className="h-screen flex flex-col bg-[#F5F5F7]">
        <AppBuilderEditor
          appId={editingId}
          apiBase="/api/my/studio-apps"
          allowPremium={!!user.is_vakar_plus}
          quota={quota}
          enableApkBuild
          onBack={() => setEditingId(null)}
        />
      </div>
    );
  }

  const atLimit = !!(quota && quota.used >= quota.max);

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <PublicNav />

      <section className="bg-white border-b border-[#D2D2D7] px-6 md:px-10 lg:px-16 pt-[104px] pb-10">
        <Reveal className="max-w-screen-md mx-auto">
          <p className="text-[12px] font-mono text-[#4ECDC4] mb-3">// my apps</p>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[#1D1D1F]">
                Build your own app
              </h1>
              <p className="text-[#6E6E73] text-sm mt-2 max-w-md">
                Screens, components and actions — no code. Publish it publicly or keep it just for you.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {apps.some(a => a.creator_earnings_cents) && (
                <div className="rounded-xl liquid-glass px-4 py-3 text-right">
                  <p className="font-display text-xl font-medium text-emerald-600 leading-none">
                    ${(apps.reduce((sum, a) => sum + (a.creator_earnings_cents || 0), 0) / 100).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[#6E6E73] mt-1">earned total</p>
                </div>
              )}
              {quota && (
                <div className="rounded-xl liquid-glass px-4 py-3 text-right">
                  <p className="font-display text-xl font-medium text-[#1D1D1F] leading-none">{quota.used}<span className="text-[#A1A1A6] text-sm">/{quota.max}</span></p>
                  <p className="text-[10px] text-[#6E6E73] mt-1">apps used</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      <main className="flex-1 max-w-screen-md mx-auto w-full px-6 md:px-10 lg:px-16 py-10">
        {!quota?.is_vakar_plus && (
          <div className="rounded-xl liquid-glass p-4 mb-8 flex items-center gap-3 flex-wrap">
            <Crown size={16} className="text-[#4ECDC4] shrink-0" />
            <p className="text-xs text-[#3A3A3C] flex-1 min-w-[200px]">
              You're on the free plan — {quota ? `${quota.max} apps, a few screens each.` : 'limited apps and screens.'} Vakar+ unlocks more apps, more screens, extra components and themes.
            </p>
            <a href="/vakar-plus" className="text-xs font-semibold text-[#4ECDC4] hover:underline shrink-0">Upgrade</a>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <p className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-widest">Your apps</p>
          <div className="flex items-center gap-2">
            <PublicButton size="sm" variant="outline" icon={UploadSimple} iconPosition="leading" disabled={atLimit || importing} onClick={() => importInputRef.current?.click()}>
              {importing ? 'Importing…' : 'Import .vakarstudio'}
            </PublicButton>
            <input ref={importInputRef} type="file" accept=".vakarstudio" className="hidden" onChange={importApp} />
            <PublicButton size="sm" icon={Plus} iconPosition="leading" disabled={atLimit} onClick={() => setCreating(true)}>
              New App
            </PublicButton>
          </div>
        </div>

        {importError && (
          <div className="rounded-xl liquid-glass p-4 mb-6 flex items-center justify-between gap-3">
            <p className="text-xs text-red-500">{importError}</p>
            <button onClick={() => setImportError('')} className="text-[#6E6E73] hover:text-[#1D1D1F] shrink-0"><X size={13} /></button>
          </div>
        )}

        {creating && (
          <div className="rounded-xl liquid-glass p-5 mb-6 flex items-center gap-3 flex-wrap">
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createApp()}
              placeholder="App name, e.g. 'My workout tracker'"
              className="flex-1 min-w-[200px] rounded-lg px-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-sm text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
            />
            <PublicButton size="sm" onClick={createApp}>Create</PublicButton>
            <button onClick={() => { setCreating(false); setNewName(''); setCreateError(''); }} className="text-xs text-[#6E6E73] hover:text-[#1D1D1F]">Cancel</button>
            {createError && <p className="w-full text-xs text-red-500">{createError}</p>}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-white/60 animate-pulse" />)}</div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20">
            <div className="rounded-full w-14 h-14 bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-5">
              <AppWindow size={24} className="text-[#4ECDC4]" />
            </div>
            <p className="font-display text-lg font-medium text-[#1D1D1F] mb-2">No apps yet</p>
            <p className="text-sm text-[#6E6E73] mb-6">Create your first app to get started.</p>
            <PublicButton icon={Plus} iconPosition="leading" onClick={() => setCreating(true)}>New App</PublicButton>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map(a => (
              <div key={a.id} className="rounded-xl liquid-glass p-5 flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-[#1D1D1F] truncate">{a.name}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${a.status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}`}>
                      {a.status}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#4ECDC4]/10 text-[#4ECDC4] flex items-center gap-1">
                      {a.visibility === 'public' ? <Globe size={9} /> : <LockSimple size={9} />}{a.visibility}
                    </span>
                    {a.price_cents > 0 && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#F2994A]/10 text-[#F2994A]">
                        ${(a.price_cents / 100).toFixed(2)}
                      </span>
                    )}
                    {a.review_status && a.review_status !== 'none' && (
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        a.review_status === 'approved' ? 'bg-emerald-500/10 text-emerald-600'
                          : a.review_status === 'rejected' ? 'bg-red-500/10 text-red-500'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {a.review_status === 'approved' ? 'Approved & live' : a.review_status === 'rejected' ? 'Changes requested' : 'Pending review'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#A1A1A6] font-mono truncate">/apps/{a.slug}</p>
                  {a.review_status === 'rejected' && a.review_rejection_reason && (
                    <p className="text-[11px] text-red-500 mt-1 truncate">Reason: {a.review_rejection_reason}</p>
                  )}
                </div>

                {confirmDeleteId === a.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#6E6E73]">Delete this app?</span>
                    <button onClick={() => deleteApp(a.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Check size={14} /></button>
                    <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7]"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setEditingId(a.id)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] transition-all">
                      Edit
                    </button>
                    {a.status === 'published' && (
                      <a href={`/apps/${a.slug}`} target="_blank" rel="noopener noreferrer" title="Open" className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7]">
                        <ArrowSquareOut size={14} />
                      </a>
                    )}
                    <button onClick={() => duplicateApp(a.id)} title="Duplicate" disabled={atLimit} className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] disabled:opacity-30">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => exportApp(a)} title="Export .vakarstudio" disabled={exportingId === a.id} className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] disabled:opacity-30">
                      <DownloadSimple size={14} />
                    </button>
                    <button onClick={() => setConfirmDeleteId(a.id)} title="Delete" className="p-2 text-[#A1A1A6] hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
