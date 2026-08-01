import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Users, RefreshCw, ChevronDown, ChevronUp, Trash2,
  ShieldOff, Save, Search, Clock, Calendar, Ban, ShieldCheck,
} from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';

const CATEGORIES = ['inventory', 'stats', 'craft', 'tech', 'others'];

const fmt = (iso) => {
  if (!iso || iso === 'None') return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

export const PlayersManagement = () => {
  const { selectedProject } = useProject();
  const { hasPermission } = useAuth();
  const slug = selectedProject?.slug;

  const [players,  setPlayers]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saves,    setSaves]    = useState({});
  const [saving,   setSaving]   = useState({});
  const [dialog,   setDialog]   = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const canDelete = hasPermission('manage_play');

  const fetchPlayers = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/admin/projects/${slug}/play/players`);
      setPlayers(r.data.players || []);
    } catch { toast.error('Erreur lors du chargement des joueurs'); }
    finally  { setLoading(false); }
  }, [slug]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  const openPlayer = async (player) => {
    if (expanded === player.id) { setExpanded(null); setDetail(null); return; }
    setExpanded(player.id);
    setDetailLoading(true);
    try {
      const r = await api.get(`/api/admin/projects/${slug}/play/players/${player.id}`);
      setDetail(r.data);
      setSaves(r.data.saves || {});
    } catch { toast.error('Erreur lors du chargement du joueur'); }
    finally  { setDetailLoading(false); }
  };

  const saveCat = async (playerId, category) => {
    setSaving(s => ({ ...s, [category]: true }));
    try {
      await api.patch(`/api/admin/projects/${slug}/play/players/${playerId}/saves/${category}`, { data: saves[category] || '{}' });
      toast.success(`Catégorie "${category}" sauvegardée`);
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally  { setSaving(s => ({ ...s, [category]: false })); }
  };

  const showConfirm = (cfg) => setDialog({ ...cfg, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const revokeTokens = (player) => {
    showConfirm({
      title: 'Déconnecter le joueur',
      description: `Révoquer toutes les sessions de "${player.username}" ? Il devra se reconnecter sur tous ses appareils.`,
      confirmLabel: 'Déconnecter',
      variant: 'warning',
      onConfirm: async () => {
        await api.delete(`/api/admin/projects/${slug}/play/players/${player.id}/tokens`);
        toast.success(`Sessions de "${player.username}" révoquées`);
      },
    });
  };

  const toggleBan = (player) => {
    const willBan = !player.banned;
    showConfirm({
      title: willBan ? 'Bannir le joueur' : 'Débannir le joueur',
      description: willBan
        ? `Bannir "${player.username}" de "${selectedProject.name}" ? Il ne pourra plus se connecter ni jouer à ce jeu (les autres jeux et son compte restent intacts).`
        : `Retirer le bannissement de "${player.username}" pour "${selectedProject.name}" ?`,
      confirmLabel: willBan ? 'Bannir' : 'Débannir',
      variant: willBan ? 'destructive' : 'warning',
      onConfirm: async () => {
        if (willBan) {
          await api.patch(`/api/admin/projects/${slug}/play/players/${player.id}/ban`);
        } else {
          await api.delete(`/api/admin/projects/${slug}/play/players/${player.id}/ban`);
        }
        toast.success(willBan ? `"${player.username}" banni de ce jeu` : `"${player.username}" débanni`);
        setPlayers(p => p.map(x => x.id === player.id ? { ...x, banned: willBan } : x));
      },
    });
  };

  const deletePlayer = (player) => {
    showConfirm({
      title: 'Supprimer le joueur',
      description: `Supprimer définitivement "${player.username}" et toutes ses sauvegardes ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'destructive',
      onConfirm: async () => {
        await api.delete(`/api/admin/projects/${slug}/play/players/${player.id}`);
        toast.success(`Joueur "${player.username}" supprimé`);
        setPlayers(p => p.filter(x => x.id !== player.id));
        if (expanded === player.id) { setExpanded(null); setDetail(null); }
      },
    });
  };

  const filtered = players.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.username.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase() === q ||
      p.id.toLowerCase().startsWith(q);
  });

  if (!slug) return null;

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-lg w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center">
              <Users size={20} className="text-[#4ECDC4]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1D1D1F]">Players</h1>
              <p className="text-xs text-[#A1A1A6]">{players.length} joueur{players.length !== 1 ? 's' : ''} — {selectedProject.name}</p>
            </div>
          </div>
          <button
            onClick={fetchPlayers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-[#D2D2D7] text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6]" />
          <input
            type="text"
            placeholder="Rechercher par pseudo, email ou ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#D2D2D7] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] bg-white"
          />
        </div>

        {/* Player list */}
        {loading && players.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[#A1A1A6] text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={40} className="text-[#D2D2D7] mb-3" />
            <p className="text-sm text-[#A1A1A6] font-medium">Aucun joueur trouvé</p>
            <p className="text-xs text-[#BFBFC4] mt-1">Les joueurs apparaîtront ici après leur première sauvegarde en jeu.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-[#D2D2D7] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-[#D2D2D7] bg-[#F5F5F7]">
              <span className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-wide">Joueur</span>
              <span className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-wide">Email</span>
              <span className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-wide">Inscrit</span>
              <span className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-wide">Vu</span>
              <span className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-wide">Actions</span>
            </div>

            {filtered.map(player => (
              <div key={player.id} className="border-b border-[#EDEDEF] last:border-0">
                {/* Row */}
                <div
                  className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-3.5 hover:bg-[#F5F5F7] cursor-pointer transition-colors"
                  onClick={() => openPlayer(player)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center text-xs font-bold text-[#4ECDC4] shrink-0">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-[#1D1D1F] truncate">{player.username}</p>
                        {player.banned && (
                          <span className="text-[9px] font-bold text-red-500 border border-red-200 bg-red-50 px-1.5 py-0.5 uppercase tracking-wide shrink-0">Banned</span>
                        )}
                      </div>
                      <p className="text-xs text-[#A1A1A6]">{player.categories?.length || 0} catégorie{player.categories?.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#6E6E73] truncate">{player.email}</p>
                  <div className="flex items-center gap-1 text-xs text-[#A1A1A6]">
                    <Calendar size={11} /> {fmt(player.created_at)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#A1A1A6]">
                    <Clock size={11} /> {fmt(player.last_seen)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); revokeTokens(player); }}
                      title="Déconnecter"
                      className="p-1.5 text-[#A1A1A6] hover:text-orange-500 hover:bg-orange-50 transition-colors"
                    >
                      <ShieldOff size={14} />
                    </button>
                    {canDelete && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleBan(player); }}
                        title={player.banned ? 'Débannir de ce jeu' : 'Bannir de ce jeu'}
                        className={`p-1.5 transition-colors ${player.banned ? 'text-red-500 hover:text-[#4ECDC4] hover:bg-[#4ECDC4]/10' : 'text-[#A1A1A6] hover:text-red-500 hover:bg-red-50'}`}
                      >
                        {player.banned ? <ShieldCheck size={14} /> : <Ban size={14} />}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={e => { e.stopPropagation(); deletePlayer(player); }}
                        title="Supprimer"
                        className="p-1.5 text-[#A1A1A6] hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {expanded === player.id ? <ChevronUp size={14} className="text-[#A1A1A6]" /> : <ChevronDown size={14} className="text-[#A1A1A6]" />}
                  </div>
                </div>

                {/* Expanded saves editor */}
                {expanded === player.id && (
                  <div className="px-5 pb-5 bg-[#F5F5F7] border-t border-[#D2D2D7]">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8 text-[#A1A1A6] text-sm">
                        <RefreshCw size={14} className="animate-spin mr-2" /> Chargement…
                      </div>
                    ) : (
                      <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {CATEGORIES.map(cat => (
                          <div key={cat} className="rounded-xl bg-white border border-[#D2D2D7] p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#4ECDC4] uppercase tracking-wide">{cat}</span>
                              <button
                                onClick={() => saveCat(player.id, cat)}
                                disabled={saving[cat]}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-[#4ECDC4]/10 text-[#4ECDC4] hover:bg-[#4ECDC4]/20 transition-colors disabled:opacity-50"
                              >
                                {saving[cat] ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
                                Enregistrer
                              </button>
                            </div>
                            <textarea
                              value={saves[cat] || '{}'}
                              onChange={e => setSaves(s => ({ ...s, [cat]: e.target.value }))}
                              rows={6}
                              spellCheck={false}
                              className="w-full text-xs font-mono bg-[#F5F5F7] border border-[#D2D2D7] p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] text-[#3A3A3C]"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={dialog.open}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        variant={dialog.variant || 'destructive'}
        onConfirm={handleConfirm}
        onClose={closeConfirm}
        loading={confirmLoading}
      />
    </>
  );
};
