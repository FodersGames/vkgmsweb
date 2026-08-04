import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Users, RefreshCw, Trash2, ShieldOff, Save, Search, Clock, Calendar,
  Ban, ShieldCheck, ChevronLeft, Plus, Tag, X, PencilLine, UsersRound,
} from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Skeleton, Select, DensityToggle, useDensity } from '../ui';

const fmt = (iso) => {
  if (!iso || iso === 'None') return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

export const PlayersManagement = () => {
  const { selectedProject } = useProject();
  const { hasPermission } = useAuth();
  const slug = selectedProject?.slug;
  const canDelete = hasPermission('manage_play');

  const [view, setView] = useState('players'); // 'players' | 'categories'

  // ── Players list ─────────────────────────────────────────────────────────
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const [density, setDensity] = useDensity();
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'destructive' });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Categories (shared: used by the save-slots panel AND the Categories tab)
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', label: '', player_scope: 'all' });
  const [catUserQuery, setCatUserQuery] = useState('');
  const [catUserResults, setCatUserResults] = useState([]);
  const [catUserPicked, setCatUserPicked] = useState([]); // [{id, username}]
  const [creatingCat, setCreatingCat] = useState(false);

  // ── Detail view ──────────────────────────────────────────────────────────
  const [activePlayer, setActivePlayer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saves, setSaves] = useState({});
  const [savingCat, setSavingCat] = useState({});

  // ── Bulk update panel (from the list view) ──────────────────────────────
  const [bulkPanel, setBulkPanel] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkData, setBulkData] = useState('{}');
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchPlayers = useCallback(async () => {
    if (!slug) return;
    setListLoading(true);
    try {
      const params = { page, limit: 25 };
      if (search) params.search = search;
      const r = await api.get(`/api/admin/projects/${slug}/play/players`, { params });
      setPlayers(r.data.players || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch { toast.error('Erreur lors du chargement des joueurs'); }
    finally { setListLoading(false); }
  }, [slug, page, search]);

  const fetchCategories = useCallback(async () => {
    if (!slug) return;
    setCatLoading(true);
    try {
      const r = await api.get(`/api/admin/projects/${slug}/play/categories`);
      setCategories(r.data.categories || []);
    } catch { /* silent */ }
    finally { setCatLoading(false); }
  }, [slug]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { setSelectedIds(new Set()); }, [players]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Debounced user lookup for the "specific players" category picker.
  useEffect(() => {
    if (!catUserQuery.trim()) { setCatUserResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/api/users', { params: { search: catUserQuery.trim(), limit: 8 } });
        setCatUserResults(r.data.users || []);
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(t);
  }, [catUserQuery]);

  const showConfirm = (cfg) => setDialog({ ...cfg, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  // ── Bulk selection ───────────────────────────────────────────────────────
  const allOnPageSelected = players.length > 0 && players.every(p => selectedIds.has(p.id));
  const toggleSelect = (id) => setSelectedIds(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAllOnPage = () => setSelectedIds(allOnPageSelected ? new Set() : new Set(players.map(p => p.id)));

  const bulkBan = (willBan) => {
    const ids = [...selectedIds];
    showConfirm({
      title: willBan ? `Bannir ${ids.length} joueur(s)` : `Débannir ${ids.length} joueur(s)`,
      description: willBan ? 'Ils ne pourront plus se connecter à ce jeu.' : 'Ils pourront à nouveau se connecter à ce jeu.',
      variant: willBan ? 'destructive' : 'accent',
      onConfirm: async () => {
        await Promise.all(ids.map(id => api[willBan ? 'patch' : 'delete'](`/api/admin/projects/${slug}/play/players/${id}/ban`).catch(() => {})));
        toast.success(willBan ? 'Joueurs bannis' : 'Joueurs débannis');
        setSelectedIds(new Set());
        fetchPlayers();
      },
    });
  };

  const bulkRevoke = () => {
    const ids = [...selectedIds];
    showConfirm({
      title: `Déconnecter ${ids.length} joueur(s)`,
      description: 'Ils devront se reconnecter sur tous leurs appareils.',
      variant: 'destructive',
      onConfirm: async () => {
        await Promise.all(ids.map(id => api.delete(`/api/admin/projects/${slug}/play/players/${id}/tokens`).catch(() => {})));
        toast.success('Sessions révoquées');
        setSelectedIds(new Set());
      },
    });
  };

  const submitBulkUpdate = async (e) => {
    e.preventDefault();
    if (!bulkCategory) { toast.error('Choisissez une catégorie'); return; }
    try { JSON.parse(bulkData); } catch { toast.error('JSON invalide'); return; }
    setBulkSaving(true);
    try {
      const r = await api.post(`/api/admin/projects/${slug}/play/saves/bulk`, {
        user_ids: [...selectedIds], category: bulkCategory, data: bulkData,
      });
      toast.success(`${r.data.updated} joueur(s) mis à jour`);
      setBulkPanel(false);
      setSelectedIds(new Set());
      fetchPlayers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Échec de la mise à jour groupée'); }
    finally { setBulkSaving(false); }
  };

  // ── Detail view ──────────────────────────────────────────────────────────
  const openPlayer = async (player) => {
    setActivePlayer(player);
    setDetailLoading(true);
    try {
      const r = await api.get(`/api/admin/projects/${slug}/play/players/${player.id}`);
      setActivePlayer(r.data.player);
      setSaves(r.data.saves || {});
    } catch { toast.error('Erreur lors du chargement du joueur'); }
    finally { setDetailLoading(false); }
  };

  const closePlayer = () => { setActivePlayer(null); fetchPlayers(); };

  const saveCat = async (category) => {
    setSavingCat(s => ({ ...s, [category]: true }));
    try {
      await api.patch(`/api/admin/projects/${slug}/play/players/${activePlayer.id}/saves/${category}`, { data: saves[category] || '{}' });
      toast.success(`Slot "${category}" enregistré`);
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur lors de la sauvegarde'); }
    finally { setSavingCat(s => ({ ...s, [category]: false })); }
  };

  const deleteSlot = (category) => {
    showConfirm({
      title: 'Supprimer ce slot de sauvegarde',
      description: `Supprimer définitivement les données "${category}" de "${activePlayer.username}" ? Cette action est irréversible.`,
      variant: 'destructive',
      onConfirm: async () => {
        await api.delete(`/api/admin/projects/${slug}/play/players/${activePlayer.id}/saves/${category}`);
        toast.success(`Slot "${category}" supprimé`);
        setSaves(s => { const next = { ...s }; delete next[category]; return next; });
      },
    });
  };

  const revokeTokens = (player) => {
    showConfirm({
      title: 'Déconnecter le joueur',
      description: `Révoquer toutes les sessions de "${player.username}" ? Il devra se reconnecter sur tous ses appareils.`,
      variant: 'destructive',
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
        ? `Bannir "${player.username}" de "${selectedProject.name}" ? Il ne pourra plus se connecter ni jouer à ce jeu.`
        : `Retirer le bannissement de "${player.username}" pour "${selectedProject.name}" ?`,
      variant: willBan ? 'destructive' : 'accent',
      onConfirm: async () => {
        if (willBan) await api.patch(`/api/admin/projects/${slug}/play/players/${player.id}/ban`);
        else await api.delete(`/api/admin/projects/${slug}/play/players/${player.id}/ban`);
        toast.success(willBan ? `"${player.username}" banni de ce jeu` : `"${player.username}" débanni`);
        setPlayers(p => p.map(x => x.id === player.id ? { ...x, banned: willBan } : x));
        if (activePlayer?.id === player.id) setActivePlayer(a => ({ ...a, banned: willBan }));
      },
    });
  };

  const deletePlayer = (player) => {
    showConfirm({
      title: 'Supprimer le joueur',
      description: `Supprimer définitivement "${player.username}" et toutes ses sauvegardes pour ce jeu ? Cette action est irréversible.`,
      variant: 'destructive',
      onConfirm: async () => {
        await api.delete(`/api/admin/projects/${slug}/play/players/${player.id}`);
        toast.success(`Joueur "${player.username}" supprimé`);
        setPlayers(p => p.filter(x => x.id !== player.id));
        if (activePlayer?.id === player.id) setActivePlayer(null);
      },
    });
  };

  // ── Category creation/deletion ───────────────────────────────────────────
  const submitCreateCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error('Le nom est requis'); return; }
    if (catForm.player_scope === 'specific' && catUserPicked.length === 0) {
      toast.error('Sélectionnez au moins un joueur'); return;
    }
    setCreatingCat(true);
    try {
      await api.post(`/api/admin/projects/${slug}/play/categories`, {
        name: catForm.name.trim().toLowerCase(),
        label: catForm.label.trim() || catForm.name.trim(),
        player_scope: catForm.player_scope,
        target_user_ids: catForm.player_scope === 'specific' ? catUserPicked.map(u => u.id) : [],
      });
      toast.success('Catégorie créée');
      setCatForm({ name: '', label: '', player_scope: 'all' });
      setCatUserPicked([]);
      setShowCreateCat(false);
      fetchCategories();
    } catch (err) { toast.error(err.response?.data?.detail || 'Échec de la création'); }
    finally { setCreatingCat(false); }
  };

  const deleteCategory = (cat) => {
    showConfirm({
      title: 'Supprimer cette catégorie',
      description: `Les slots de sauvegarde existants sous "${cat.name}" ne seront pas supprimés, mais plus aucune nouvelle donnée ne pourra être écrite sous ce nom tant qu'elle n'est pas recréée.`,
      variant: 'destructive',
      onConfirm: async () => {
        await api.delete(`/api/admin/projects/${slug}/play/categories/${cat.id}`);
        toast.success('Catégorie supprimée');
        fetchCategories();
      },
    });
  };

  if (!slug) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (activePlayer) {
    const p = activePlayer;
    // Only show categories this player can actually use — "all players" ones,
    // plus "specific" ones that explicitly target them. Showing every project
    // category regardless of scope was the bug: a category scoped to one
    // player appeared as editable on every player's page, and since players
    // outside the scope never had a slot there, there was nothing to delete
    // either — just a card that shouldn't have been visible at all.
    const relevantCategories = categories.filter(cat =>
      cat.player_scope === 'all' || (cat.target_user_ids || []).includes(p.id)
    );
    return (
      <>
        <div className="max-w-4xl">
          <button onClick={closePlayer} className="flex items-center gap-2 text-sm text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white mb-6 transition-colors">
            <ChevronLeft size={14} /> Back to players
          </button>

          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 mb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center text-lg font-bold text-[#4ECDC4] shrink-0">
                  {p.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">{p.username}</h2>
                    {p.banned && <span className="text-[10px] font-bold text-red-500 border border-red-200 bg-red-50 px-1.5 py-0.5 uppercase tracking-wide">Banned</span>}
                  </div>
                  <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">{p.email}</p>
                  <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] mt-0.5">
                    Joined {fmt(p.created_at)} · Last seen {fmt(p.last_seen)}
                    {p.nickname && ` · Nickname: ${p.nickname}`}
                    {p.guild && ` · Guild: ${p.guild.name} (${p.guild.role})`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button variant="secondary" size="sm" icon={ShieldOff} onClick={() => revokeTokens(p)}>Disconnect</Button>
                {canDelete && (
                  p.banned
                    ? <Button variant="secondary" size="sm" icon={ShieldCheck} onClick={() => toggleBan(p)}>Unban</Button>
                    : <Button variant="danger" size="sm" icon={Ban} onClick={() => toggleBan(p)}>Ban</Button>
                )}
                {canDelete && <Button variant="danger" size="sm" icon={Trash2} onClick={() => deletePlayer(p)}>Delete</Button>}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Save slots</h3>
              <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">{relevantCategories.length} of {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} apply to this player</p>
            </div>
            {detailLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" />
              </div>
            ) : relevantCategories.length === 0 ? (
              <EmptyState icon={Tag} title="No save categories apply to this player" description={categories.length === 0 ? "Create one in the Categories tab before this player can have any save data." : "This project has categories, but none of them are scoped to 'all players' or to this player specifically."} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relevantCategories.map(cat => {
                  const hasSlot = saves[cat.name] !== undefined;
                  return (
                    <div key={cat.id} className="rounded-xl bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#4ECDC4] uppercase tracking-wide">
                          {cat.label}
                          {cat.player_scope === 'specific' && (
                            <span className="normal-case font-semibold text-[9px] text-[#6C5CE7] bg-[#6C5CE7]/10 px-1.5 py-0.5 rounded-full tracking-normal">specific</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => saveCat(cat.name)} disabled={savingCat[cat.name]}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-[#4ECDC4]/10 text-[#4ECDC4] hover:bg-[#4ECDC4]/20 rounded transition-colors disabled:opacity-50">
                            {savingCat[cat.name] ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
                            {hasSlot ? 'Save' : 'Create'}
                          </button>
                          {hasSlot && (
                            <button onClick={() => deleteSlot(cat.name)} title="Delete this slot" className="p-1 text-[#A1A1A6] hover:text-red-500 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {!hasSlot && <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">No slot yet — editing and saving will create one.</p>}
                      <textarea
                        value={saves[cat.name] ?? '{}'}
                        onChange={e => setSaves(s => ({ ...s, [cat.name]: e.target.value }))}
                        rows={6}
                        spellCheck={false}
                        className="rounded-lg w-full text-xs font-mono bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] text-[#3A3A3C] dark:text-[#d4d4d8]"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog isOpen={dialog.open} onClose={closeConfirm} onConfirm={handleConfirm} title={dialog.title} description={dialog.description} loading={confirmLoading} variant={dialog.variant} />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CATEGORIES TAB
  // ═══════════════════════════════════════════════════════════════════════
  if (view === 'categories') {
    return (
      <>
        <div className="max-w-4xl space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="rounded-lg w-10 h-10 bg-[#6C5CE7]/10 flex items-center justify-center">
                <Tag size={20} className="text-[#6C5CE7]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Save Categories</h1>
                <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">{selectedProject.name} — no data slots exist until a category is defined here.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setView('players')}>Back to players</Button>
              <Button size="sm" icon={Plus} onClick={() => setShowCreateCat(v => !v)}>{showCreateCat ? 'Cancel' : 'New category'}</Button>
            </div>
          </div>

          {showCreateCat && (
            <Card>
              <CardBody>
                <form onSubmit={submitCreateCategory} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase mb-1">Name (key)</label>
                      <input required value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="inventory" className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7]" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase mb-1">Display label</label>
                      <input value={catForm.label} onChange={e => setCatForm(f => ({ ...f, label: e.target.value }))}
                        placeholder="Inventory" className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase mb-1.5">Applies to</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setCatForm(f => ({ ...f, player_scope: 'all' }))}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors ${catForm.player_scope === 'all' ? 'bg-[#4ECDC4]/10 border-[#4ECDC4] text-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa]'}`}>
                        <UsersRound size={12} className="inline mr-1.5" />All players
                      </button>
                      <button type="button" onClick={() => setCatForm(f => ({ ...f, player_scope: 'specific' }))}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold border transition-colors ${catForm.player_scope === 'specific' ? 'bg-[#4ECDC4]/10 border-[#4ECDC4] text-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa]'}`}>
                        <PencilLine size={12} className="inline mr-1.5" />Specific players
                      </button>
                    </div>
                  </div>
                  {catForm.player_scope === 'specific' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase mb-1.5">Players</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {catUserPicked.map(u => (
                          <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-[#4ECDC4]/10 text-[#4ECDC4] px-2 py-1 rounded-full">
                            @{u.username}
                            <button type="button" onClick={() => setCatUserPicked(p => p.filter(x => x.id !== u.id))}><X size={11} /></button>
                          </span>
                        ))}
                      </div>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6]" />
                        <input value={catUserQuery} onChange={e => setCatUserQuery(e.target.value)} placeholder="Search by username or email…"
                          className="rounded-lg w-full pl-9 pr-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7]" />
                      </div>
                      {catUserResults.length > 0 && (
                        <div className="mt-1 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden">
                          {catUserResults.filter(u => !catUserPicked.some(p => p.id === u.id)).map(u => (
                            <button type="button" key={u.id}
                              onClick={() => { setCatUserPicked(p => [...p, u]); setCatUserQuery(''); setCatUserResults([]); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] text-[#1D1D1F] dark:text-[#e4e4e7]">
                              @{u.username} <span className="text-[#A1A1A6]">· {u.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <Button type="submit" size="sm" loading={creatingCat}>Create category</Button>
                </form>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Defined categories ({categories.length})</h3></CardHeader>
            <CardBody>
              {catLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : categories.length === 0 ? (
                <EmptyState icon={Tag} title="No categories yet" description="Create one above — nothing is available for players to save to until you do." />
              ) : (
                <div className="space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] px-4 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{cat.label} <span className="text-xs font-mono text-[#A1A1A6] font-normal">({cat.name})</span></p>
                        <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">
                          {cat.player_scope === 'all'
                            ? 'All players'
                            : `Specific: ${(cat.target_usernames || []).map(u => `@${u}`).join(', ') || 'none'}`}
                        </p>
                      </div>
                      <button onClick={() => deleteCategory(cat)} className="p-1.5 text-[#A1A1A6] hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <ConfirmDialog isOpen={dialog.open} onClose={closeConfirm} onConfirm={handleConfirm} title={dialog.title} description={dialog.description} loading={confirmLoading} variant={dialog.variant} />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PLAYERS LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-3">
                <div className="rounded-lg w-9 h-9 bg-[#4ECDC4]/10 flex items-center justify-center">
                  <Users size={16} className="text-[#4ECDC4]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Players</h3>
                  <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">{total} player{total !== 1 ? 's' : ''} — {selectedProject.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={Tag} onClick={() => setView('categories')}>Categories</Button>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchPlayers} />
              </div>
            </div>
          </CardHeader>

          <CardBody>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a] pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search by pseudo, email…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="rounded-lg w-full pl-9 pr-4 py-2 text-sm bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all"
                />
              </div>
              <DensityToggle density={density} onChange={setDensity} className="ml-auto" />
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/30 flex-wrap">
                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{selectedIds.size} selected</span>
                <div className="flex-1" />
                <Button size="sm" variant="secondary" icon={PencilLine} onClick={() => {
                  setBulkPanel(v => !v);
                  const eligible = categories.find(cat => cat.player_scope === 'all' || (cat.target_user_ids || []).some(id => selectedIds.has(id)));
                  setBulkCategory(eligible?.name || '');
                }}>Update data</Button>
                <Button size="sm" variant="secondary" icon={ShieldOff} onClick={bulkRevoke}>Disconnect</Button>
                {canDelete && <Button size="sm" variant="secondary" icon={ShieldCheck} onClick={() => bulkBan(false)}>Unban</Button>}
                {canDelete && <Button size="sm" variant="danger" icon={Ban} onClick={() => bulkBan(true)}>Ban</Button>}
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white">Clear</button>
              </div>
            )}

            {bulkPanel && (() => {
              // Only offer categories that actually apply to at least one of the
              // selected players — an "all players" category always qualifies;
              // a "specific" one only if it targets someone currently selected.
              // Picking one that applies to none of them would silently update
              // zero players, which is confusing to diagnose after the fact.
              const bulkEligibleCategories = categories.filter(cat =>
                cat.player_scope === 'all' || (cat.target_user_ids || []).some(id => selectedIds.has(id))
              );
              const chosenCat = bulkEligibleCategories.find(c => c.name === bulkCategory);
              const partialScope = chosenCat?.player_scope === 'specific';
              const willApplyCount = partialScope
                ? [...selectedIds].filter(id => (chosenCat.target_user_ids || []).includes(id)).length
                : selectedIds.size;
              return (
                <form onSubmit={submitBulkUpdate} className="rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#F5F5F7] dark:bg-[#111118] p-4 mb-4 space-y-3">
                  <p className="text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Apply the same save data to {selectedIds.size} player(s)</p>
                  {bulkEligibleCategories.length === 0 ? (
                    <p className="text-xs text-[#A1A1A6]">No category applies to the selected player(s) — create one in the Categories tab, or select players a "specific" category actually targets.</p>
                  ) : (
                    <>
                      <Select size="sm" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                        {bulkEligibleCategories.map(c => <option key={c.id} value={c.name}>{c.label}{c.player_scope === 'specific' ? ' (specific)' : ''}</option>)}
                      </Select>
                      {partialScope && willApplyCount < selectedIds.size && (
                        <p className="text-[11px] text-[#F2994A]">This category only targets {willApplyCount} of the {selectedIds.size} selected player(s) — the rest will be skipped.</p>
                      )}
                      <textarea value={bulkData} onChange={e => setBulkData(e.target.value)} rows={5} spellCheck={false}
                        className="rounded-lg w-full text-xs font-mono bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] text-[#3A3A3C] dark:text-[#d4d4d8]" />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" loading={bulkSaving}>Apply to {willApplyCount} selected</Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setBulkPanel(false)}>Cancel</Button>
                      </div>
                    </>
                  )}
                </form>
              );
            })()}

            {listLoading && players.length === 0 ? (
              <div className={density === 'compact' ? 'space-y-1.5' : 'space-y-3'}>
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : players.length === 0 ? (
              <EmptyState icon={Users} title={search ? 'No players match your search' : 'No players yet'} description={search ? 'Try a different search.' : 'Players appear here after their first in-game save.'} />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} className="w-3.5 h-3.5 rounded" />
                  <span className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase">Select all on page</span>
                </div>
                <div className={density === 'compact' ? 'space-y-1' : 'space-y-2'}>
                  {players.map(player => (
                    <div
                      key={player.id}
                      onClick={() => openPlayer(player)}
                      className={`rounded-xl bg-white dark:bg-[#151520] border flex items-center gap-3 cursor-pointer transition-all ${density === 'compact' ? 'px-3 py-2' : 'px-4 py-3'} ${player.banned ? 'border-red-200 dark:border-red-900/40' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'}`}
                    >
                      <input type="checkbox" checked={selectedIds.has(player.id)} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleSelect(player.id); }} className="w-3.5 h-3.5 rounded shrink-0" />
                      <div className="w-8 h-8 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center text-xs font-bold text-[#4ECDC4] shrink-0">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{player.username}</p>
                          {player.banned && <span className="text-[9px] font-bold text-red-500 border border-red-200 bg-red-50 px-1.5 py-0.5 uppercase tracking-wide shrink-0">Banned</span>}
                        </div>
                        {density !== 'compact' && <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] truncate">{player.email}</p>}
                      </div>
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="flex items-center gap-1 text-xs text-[#A1A1A6] dark:text-[#71717a]"><Calendar size={11} /> {fmt(player.created_at)}</p>
                        <p className="flex items-center gap-1 text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-0.5"><Clock size={10} /> {fmt(player.last_seen)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white disabled:opacity-40 transition-colors">← Prev</button>
                <span className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Page {page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white disabled:opacity-40 transition-colors">Next →</button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog isOpen={dialog.open} onClose={closeConfirm} onConfirm={handleConfirm} title={dialog.title} description={dialog.description} loading={confirmLoading} variant={dialog.variant} />
    </>
  );
};
