import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Edit2, Trash2, Save, X, Search,
  Eye, EyeOff, Star, Gamepad2,
} from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, EmptyState, Select } from '../ui';
import { SHOP_BADGES } from '../constants/shopBadges';

// Same badge definitions the public shop renders — plus the admin-only
// "no badge" option, which isn't a real badge so it doesn't belong in the
// shared list.
const BADGE_OPTIONS = [{ value: '', label: '— No badge —' }, ...SHOP_BADGES];

// ── Form defaults ─────────────────────────────────────────────────────────────
// Category/sub-category were retired: a second, hand-maintained cross-game
// taxonomy (Weapons/Skins/…) on top of "which game is this for" was one
// filtering axis too many. Products now only ever belong to a game — the
// Shop's Type tabs (Games/Applications/Software) come from the game itself.
const defaultForm = {
  name: '', description: '', price: '', image_url: '',
  badge: '', discount_pct: '', game_slug: '', project_slug: '', variable: '', amount: '',
  active: true, featured: false,
};

const IN = 'w-full rounded-lg bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] text-sm px-3 py-2.5 focus:outline-none focus:border-[#4ECDC4] focus:ring-2 focus:ring-[#4ECDC4]/20 transition-all placeholder:text-[#A1A1A6] dark:placeholder:text-[#52525b]';
const LBL = 'block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-[0.14em] mb-1.5';

// ── Main component ────────────────────────────────────────────────────────────
export const ShopManagement = () => {
  const [games,    setGames]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);

  const [search,       setSearch]       = useState('');
  const [filterGame,   setFilterGame]   = useState('');

  const [showForm,        setShowForm]        = useState(false);
  const [editingProduct,  setEditingProduct]  = useState(null);
  const [form,     setForm]     = useState(defaultForm);
  const [loading,  setLoading]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dialog,   setDialog]   = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const fetchProducts = useCallback(async () => {
    try {
      const r = await api.get('/api/shop/products/admin');
      setProducts(r.data.products || []);
    } catch { toast.error('Failed to load products'); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [gr, pr] = await Promise.all([api.get('/api/website/games'), api.get('/api/projects')]);
        setGames(gr.data.games || []);
        setProjects(pr.data.projects || []);
      } catch {}
    })();
    fetchProducts();
  }, [fetchProducts]);

  const uploadFile = async (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post(`/api/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setter(r.data.url);
      toast.success('Image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const openCreate = () => { setEditingProduct(null); setForm(defaultForm); setShowForm(true); };
  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name, description: p.description || '',
      price: (p.price / 100).toFixed(2),
      image_url: p.image_url || '', badge: p.badge || '',
      discount_pct: p.discount_pct ?? '',
      game_slug: p.game_slug || '', project_slug: p.project_slug, variable: p.variable, amount: p.amount,
      active: p.active, featured: p.featured || false,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      price: Math.round(parseFloat(form.price) * 100),
      discount_pct: form.discount_pct !== '' ? parseInt(form.discount_pct) : null,
      badge: form.badge || null,
    };
    try {
      if (editingProduct) {
        await api.put(`/api/shop/products/${editingProduct.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post(`/api/shop/products`, payload);
        toast.success('Product created');
      }
      setShowForm(false); fetchProducts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save product'); }
    finally { setLoading(false); }
  };

  const handleDelete = (p) => {
    showConfirm({
      title: 'Delete product',
      description: `"${p.name}" will be permanently removed from the shop.`,
      onConfirm: async () => {
        await api.delete(`/api/shop/products/${p.id}`);
        toast.success('Deleted'); fetchProducts();
      },
    });
  };

  const toggleActive = async (p) => {
    try {
      await api.put(`/api/shop/products/${p.id}`, { active: !p.active });
      fetchProducts();
    } catch { toast.error('Failed to update'); }
  };

  const gameName = (slug) => games.find(g => g.slug === slug)?.name || slug;

  const filtered = products.filter(p => {
    if (filterGame && p.game_slug !== filterGame) return false;
    const q = search.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
    <div className="p-6 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-lg w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center">
            <ShoppingBag size={20} className="text-[#4ECDC4]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Shop</h1>
            <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">
              {products.length} product{products.length !== 1 ? 's' : ''} across {games.length} game{games.length !== 1 ? 's' : ''} — one unified catalog
            </p>
          </div>
        </div>
        <Button icon={showForm ? X : Plus} onClick={() => showForm ? setShowForm(false) : openCreate()}>
          {showForm ? 'Cancel' : 'Add Product'}
        </Button>
      </div>

      {/* ── Product form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="p-5 rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LBL}>Product Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={IN} required placeholder="100 Gold Coins" />
              </div>
              <div>
                <label className={LBL}>Price ($)</label>
                <input type="number" step="0.01" min="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={IN} required placeholder="9.99" />
              </div>
              <div className="md:col-span-2">
                <label className={LBL}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${IN} resize-none h-16`} placeholder="Short description shown on the product card..." />
              </div>

              {/* Product image */}
              <div className="md:col-span-2">
                <label className={LBL}>Product Image</label>
                <div className="flex gap-2">
                  <input type="text" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className={IN} placeholder="https://... or upload" />
                  <label className="rounded-full shrink-0 cursor-pointer px-3 py-2.5 bg-[#1D1D1F] dark:bg-[#e4e4e7] hover:bg-[#3A3A3C] dark:hover:bg-white text-white dark:text-[#0e0e15] text-sm font-semibold transition-colors">
                    {uploading ? '…' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, url => setForm(f => ({ ...f, image_url: url })))} />
                  </label>
                </div>
                {form.image_url && (
                  <img
                    src={form.image_url.startsWith('/') ? `${API_URL}${form.image_url}` : form.image_url}
                    alt="preview"
                    className="rounded-xl mt-2 h-16 w-16 object-cover border border-[#D2D2D7] dark:border-[#2a2a3c]"
                  />
                )}
              </div>

              {/* Game */}
              <div>
                <label className={LBL}>Game</label>
                <select value={form.game_slug} onChange={e => setForm(f => ({ ...f, game_slug: e.target.value }))} className={IN} required>
                  <option value="">— Select a game —</option>
                  {games.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
                </select>
              </div>

              {/* Badge */}
              <div>
                <label className={LBL}>Badge</label>
                <div className="flex flex-wrap gap-1.5">
                  {BADGE_OPTIONS.map(b => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, badge: b.value }))}
                      className={`rounded px-2.5 py-1 text-[10px] font-bold border transition-all ${
                        form.badge === b.value
                          ? 'border-[#1D1D1F] dark:border-[#e4e4e7] bg-[#1D1D1F] dark:bg-[#e4e4e7] text-white dark:text-[#0e0e15]'
                          : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
                      }`}
                      style={form.badge === b.value && b.bg ? { backgroundColor: b.bg, borderColor: b.bg } : {}}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount — only when badge is SALE */}
              {form.badge === 'SALE' && (
                <div>
                  <label className={LBL}>Display Discount %</label>
                  <input type="number" min="1" max="99" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} className={IN} placeholder="20" />
                  <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-1">Shown on badge label only — does not affect price.</p>
                </div>
              )}

              {/* Backend project */}
              <div>
                <label className={LBL}>Delivers into project</label>
                <select value={form.project_slug} onChange={e => setForm(f => ({ ...f, project_slug: e.target.value }))} className={IN} required>
                  <option value="">— Select a project —</option>
                  {projects.map(p => <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>)}
                </select>
              </div>
              <div>
                <label className={LBL}>Variable to send</label>
                <input type="text" value={form.variable} onChange={e => setForm(f => ({ ...f, variable: e.target.value }))} className={IN} required placeholder="gold, skin_dragon…" />
              </div>
              <div>
                <label className={LBL}>Amount</label>
                <input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={IN} required placeholder="100, legendary, true…" />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 md:col-span-2">
                {[{ key: 'featured', label: 'Featured' }, { key: 'active', label: 'Active' }].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                      className={`rounded-full w-9 h-5 relative transition-colors ${form[key] ? 'bg-[#4ECDC4]' : 'bg-[#D2D2D7] dark:bg-[#2a2a3c]'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white shadow transition-all ${form[key] ? 'left-4' : 'left-0.5'}`} />
                    </button>
                    <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" loading={loading} icon={Save}>
                {loading ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Product'}
              </Button>
              <Button variant="secondary" type="button" icon={X} onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a]" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg w-full pl-8 pr-3 py-2.5 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] bg-white dark:bg-[#151520]"
          />
        </div>
        <Select value={filterGame} onChange={e => setFilterGame(e.target.value)} wrapperClassName="w-48 shrink-0">
          <option value="">All games</option>
          {games.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
        </Select>
      </div>

      {/* ── Product list ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5">
        {products.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No products yet" description="Add your first product to start selling — across any game." />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#A1A1A6] dark:text-[#71717a] text-center py-6">No product matches your filters.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => {
              const badge = BADGE_OPTIONS.find(b => b.value === p.badge);
              return (
                <div
                  key={p.id}
                  className={`rounded-xl flex items-center gap-3 p-3 border transition-all ${
                    p.active ? 'bg-white dark:bg-[#151520] border-[#D2D2D7] dark:border-[#2a2a3c]' : 'bg-[#F5F5F7] dark:bg-[#111118] border-[#D2D2D7] dark:border-[#2a2a3c] opacity-60'
                  }`}
                >
                  {p.image_url && (
                    <img
                      src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url}
                      alt={p.name}
                      className="rounded-xl w-11 h-11 object-cover shrink-0 border border-[#D2D2D7] dark:border-[#2a2a3c]"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#1D1D1F] dark:text-[#e4e4e7]">{p.name}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#4ECDC4]/10 text-[#379E96]">
                        <Gamepad2 size={9} />{gameName(p.game_slug)}
                      </span>
                      {p.featured && <Star size={11} className="text-[#F59E0B] fill-[#F59E0B]" />}
                      {badge?.value && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 text-white" style={{ backgroundColor: badge.bg }}>
                          {badge.label}
                        </span>
                      )}
                      {!p.active && <span className="rounded-xl text-[10px] font-bold text-[#A1A1A6] dark:text-[#71717a] bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] px-1.5 py-0.5">Hidden</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">${(p.price / 100).toFixed(2)}</span>
                      <span className="text-xs text-[#A1A1A6] dark:text-[#71717a]">→ {p.amount}× {p.variable} ({p.project_slug})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(p)}
                      className="rounded-xl p-2 border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] text-[#A1A1A6] dark:text-[#71717a] hover:text-[#1D1D1F] dark:hover:text-white transition-all"
                      title={p.active ? 'Hide' : 'Show'}
                    >
                      {p.active ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button onClick={() => openEdit(p)} className="rounded-xl p-2 border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] text-[#A1A1A6] dark:text-[#71717a] hover:text-[#1D1D1F] dark:hover:text-white transition-all"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(p)} className="rounded-xl p-2 border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-red-200 text-[#A1A1A6] dark:text-[#71717a] hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Public shop link */}
      <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className={LBL}>Public Shop URL</p>
          <code className="text-sm text-[#4ECDC4] font-mono">/shop</code>
        </div>
        <a
          href="/shop"
          target="_blank"
          rel="noreferrer"
          className="rounded-full px-4 py-2 border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white text-sm font-semibold transition-all"
        >
          Open Shop ↗
        </a>
      </div>
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
