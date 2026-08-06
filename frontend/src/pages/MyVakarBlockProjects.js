import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { PublicButton } from '../ui/PublicButton';
import VakarBlockEditor from '../components/VakarBlockEditor';
import { PuzzlePiece, Plus, Trash, Check, X, Crown } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MyVakarBlockProjects() {
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    document.title = 'Vakar Block — Vakar Games';
    if (authLoading) return;
    if (!user) navigate('/login');
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/my/vakar-block-projects`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setProjects(data.projects || []);
      setQuota(data.quota || null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (!editingId) load(); }, [load, editingId]);

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreateError('');
    setCreateLoading(true);
    try {
      const r = await fetch(`${API}/api/my/vakar-block-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setCreateError(data.detail || 'Impossible de créer ce projet.'); return; }
      setNewName('');
      setCreating(false);
      setEditingId(data.id);
    } finally {
      setCreateLoading(false);
    }
  };

  const deleteProject = async (id) => {
    await fetch(`${API}/api/my/vakar-block-projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirmDeleteId(null);
    load();
  };

  if (authLoading || !user) return null;

  if (editingId) {
    return (
      <div className="h-screen flex flex-col bg-[#F5F5F7]">
        <VakarBlockEditor projectId={editingId} apiBase="/api/my/vakar-block-projects" onBack={() => setEditingId(null)} />
      </div>
    );
  }

  const atLimit = !!(quota && quota.used >= quota.max);

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <PublicNav />

      <section className="bg-white border-b border-[#D2D2D7] px-6 md:px-10 lg:px-16 pt-[104px] pb-10">
        <Reveal className="max-w-screen-md mx-auto">
          <p className="text-[12px] font-mono text-[#4ECDC4] mb-3">// vakar block</p>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.02em] text-[#1D1D1F]">
                Crée tes propres jeux et animations
              </h1>
              <p className="text-[#6E6E73] text-sm mt-2 max-w-md">
                Des blocs à assembler comme des Lego, des sprites que tu personnalises, et une scène qui prend vie. Aucune ligne de code.
              </p>
            </div>
            {quota && (
              <div className="rounded-xl liquid-glass px-4 py-3 text-right shrink-0">
                <p className="font-display text-xl font-medium text-[#1D1D1F] leading-none">{quota.used}<span className="text-[#A1A1A6] text-sm">/{quota.max}</span></p>
                <p className="text-[10px] text-[#6E6E73] mt-1">projets utilisés</p>
              </div>
            )}
          </div>
        </Reveal>
      </section>

      <main className="flex-1 max-w-screen-md mx-auto w-full px-6 md:px-10 lg:px-16 py-10">
        {!quota?.is_vakar_plus && (
          <div className="rounded-xl liquid-glass p-4 mb-8 flex items-center gap-3 flex-wrap">
            <Crown size={16} className="text-[#4ECDC4] shrink-0" />
            <p className="text-xs text-[#3A3A3C] flex-1 min-w-[200px]">
              Tu es sur l'offre gratuite — {quota ? `${quota.max} projets.` : 'nombre de projets limité.'} Vakar+ débloque plus de projets.
            </p>
            <a href="/vakar-plus" className="text-xs font-semibold text-[#4ECDC4] hover:underline shrink-0">Passer à Vakar+</a>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <p className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-widest">Tes projets</p>
          <PublicButton size="sm" icon={Plus} iconPosition="leading" disabled={atLimit} onClick={() => setCreating(true)}>
            Nouveau projet
          </PublicButton>
        </div>

        {creating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D1D1F]/40" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
            <div className="animate-appear rounded-2xl liquid-glass w-full max-w-md">
              <div className="px-6 py-4 border-b border-[#D2D2D7]/60 flex items-center justify-between">
                <h3 className="font-display text-base font-medium text-[#1D1D1F]">Nouveau projet</h3>
                <button onClick={() => { setCreating(false); setNewName(''); setCreateError(''); }} className="p-1 text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Nom du projet</label>
                  <input
                    autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createProject()}
                    placeholder="ex. « Mon jeu de chat »"
                    className="w-full rounded-lg px-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-sm text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
                  />
                </div>
                {createError && <p className="text-xs text-red-500">{createError}</p>}
              </div>
              <div className="px-6 py-4 border-t border-[#D2D2D7]/60">
                <PublicButton className="w-full" onClick={createProject} disabled={!newName.trim() || createLoading}>
                  {createLoading ? 'Création…' : 'Créer le projet'}
                </PublicButton>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-white/60 animate-pulse" />)}</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="rounded-full w-14 h-14 bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-5">
              <PuzzlePiece size={24} className="text-[#4ECDC4]" />
            </div>
            <p className="font-display text-lg font-medium text-[#1D1D1F] mb-2">Aucun projet pour l'instant</p>
            <p className="text-sm text-[#6E6E73] mb-6">Crée ton premier projet pour commencer à assembler des blocs.</p>
            <PublicButton icon={Plus} iconPosition="leading" onClick={() => setCreating(true)}>Nouveau projet</PublicButton>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="rounded-xl liquid-glass p-5 flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1D1D1F] truncate">{p.name}</p>
                  <p className="text-[11px] text-[#A1A1A6] font-mono truncate">{p.sprites?.length || 0} sprite{(p.sprites?.length || 0) === 1 ? '' : 's'}</p>
                </div>
                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#6E6E73]">Supprimer ce projet ?</span>
                    <button onClick={() => deleteProject(p.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Check size={14} /></button>
                    <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7]"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setEditingId(p.id)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] transition-all">
                      Ouvrir
                    </button>
                    <button onClick={() => setConfirmDeleteId(p.id)} title="Supprimer" className="p-2 text-[#A1A1A6] hover:text-red-500 rounded-lg hover:bg-red-50">
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
