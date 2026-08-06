import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Blocks, Building2, Users, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import VakarBlockEditor from './VakarBlockEditor';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function VakarBlockList() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/vakar-block-projects`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setProjects(data.projects || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (!editingId) load(); }, [load, editingId]);

  const createProject = async () => {
    if (!newName.trim()) return;
    const r = await fetch(`${API}/api/admin/vakar-block-projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await r.json();
    setNewName('');
    setCreating(false);
    if (data.id) setEditingId(data.id);
  };

  const deleteProject = async (id) => {
    setDeleting(true);
    try {
      await fetch(`${API}/api/admin/vakar-block-projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setConfirm(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = projects.filter((p) => !q || p.name?.toLowerCase().includes(q) || p.slug?.toLowerCase().includes(q) || p.owner?.toLowerCase().includes(q));

  if (editingId) {
    return <VakarBlockEditor projectId={editingId} onBack={() => setEditingId(null)} />;
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Vakar Block</h2>
            <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">L'éditeur de blocs façon Scratch — sprites, costumes et scripts glisser-déposer</p>
          </div>
          <Button icon={Plus} onClick={() => setCreating(true)}>Nouveau projet</Button>
        </div>

        {creating && (
          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 space-y-4">
            <input
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProject()}
              placeholder="Nom du projet, ex. « Mon jeu de chat »"
              className="w-full rounded-lg px-3 py-2 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-[#4ECDC4]"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={createProject}>Créer</Button>
              <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewName(''); }}>Annuler</Button>
            </div>
          </div>
        )}

        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a] pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-lg w-full pl-9 pr-3 py-2 text-sm bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-[#D2D2D7] dark:bg-[#1c1c2e] animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState icon={Blocks} title="Aucun projet" description="Crée ton premier projet Vakar Block — sprites, décors et blocs, tout en visuel." action={<Button icon={Plus} onClick={() => setCreating(true)}>Nouveau projet</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="Aucun résultat" description="Essaie un autre terme de recherche." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((p) => (
              <div key={p.id} className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{p.name}</p>
                    <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] font-mono truncate">/{p.slug}</p>
                  </div>
                  <span className="text-[10px] flex items-center gap-1 shrink-0">
                    {p.is_user_app ? (
                      <span className="inline-flex items-center gap-1 text-[#A1A1A6] dark:text-[#71717a]"><Users size={9} />{p.owner}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#4ECDC4]"><Building2 size={9} />Vakar</span>
                    )}
                  </span>
                </div>
                <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">{p.sprites?.length || 0} sprite{(p.sprites?.length || 0) === 1 ? '' : 's'} · mis à jour {timeAgo(p.updated_at)}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e]">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditingId(p.id)}>Ouvrir</Button>
                  <button onClick={() => setConfirm(p.id)} title="Supprimer" className="p-2 text-[#A1A1A6] hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
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
        onConfirm={() => deleteProject(confirm)}
        title="Supprimer ce projet ?"
        description="Cette action supprime définitivement les sprites, costumes et scripts. Impossible à annuler."
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleting}
      />
    </>
  );
}
