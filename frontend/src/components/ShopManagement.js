import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Edit2, Trash2, Save, X, Package, Tag,
  Eye, EyeOff, Star, Shield, Zap, Heart, Leaf, Flame, Target, Trophy, Rocket, Gem,
  Key, Lock, Wrench, Hammer, Globe, Sparkles, Box, Layers, Users,
  Award, Map, Cpu, Music, Moon, Sun, Gift, ChevronDown, Gamepad2,
} from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardBody, EmptyState } from '../ui';

// ── Badge system ──────────────────────────────────────────────────────────────
const BADGE_OPTIONS = [
  { value: '',          label: '— No badge —' },
  { value: 'NEW',       label: 'New',          color: '#4ECDC4' },
  { value: 'SALE',      label: 'Sale',          color: '#EB5757' },
  { value: 'LIMITED',   label: 'Limited',       color: '#F2994A' },
  { value: 'HOT',       label: 'Hot 🔥',        color: '#FF6B6B' },
  { value: 'POPULAR',   label: 'Popular',       color: '#A29BFE' },
  { value: 'BEST',      label: 'Best Value',    color: '#F59E0B' },
  { value: 'BUNDLE',    label: 'Bundle',        color: '#6C5CE7' },
  { value: 'EXCLUSIVE', label: '✦ Exclusive',   color: '#1C1917' },
];

// ── Icons ────────────────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  package: Package, shield: Shield, zap: Zap, heart: Heart, leaf: Leaf,
  flame: Flame, target: Target, trophy: Trophy, rocket: Rocket, gem: Gem,
  key: Key, lock: Lock, wrench: Wrench, hammer: Hammer, globe: Globe,
  sparkles: Sparkles, box: Box, layers: Layers, users: Users, award: Award,
  map: Map, cpu: Cpu, music: Music, moon: Moon, sun: Sun,
  gift: Gift, tag: Tag, star: Star,
};

const CategoryIcon = ({ name, size = 14, className = '' }) => {
  const Comp = CATEGORY_ICONS[name] || Package;
  return <Comp size={size} className={className} />;
};

const IconPicker = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const Comp = CATEGORY_ICONS[value] || Package;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-sm text-[#1C1917] hover:border-[#C9C3BB] transition-all w-full">
        <Comp size={14} className="text-[#4ECDC4] shrink-0" />
        <span className="flex-1 text-left capitalize text-[#78716C]">{value || 'Icon…'}</span>
        <ChevronDown size={12} className="text-[#A8A29E] shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-[#E8E3DB] shadow-lg z-30 grid grid-cols-7 gap-1 min-w-[240px]">
          {Object.entries(CATEGORY_ICONS).map(([name, IC]) => (
            <button key={name} type="button" title={name}
              onClick={() => { onChange(name); setOpen(false); }}
              className={`p-2 flex items-center justify-center hover:bg-[#F9F7F4] transition-all ${value === name ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'text-[#78716C]'}`}>
              <IC size={15} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Form defaults ─────────────────────────────────────────────────────────────
const defaultForm = {
  name: '', description: '', price: '', image_url: '',
  badge: '', discount_pct: '', project_slug: '', variable: '', amount: '',
  active: true, category: '', featured: false,
};

// ── Shared input class ────────────────────────────────────────────────────────
const IN = 'w-full bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] text-sm px-3 py-2.5 focus:outline-none focus:border-[#4ECDC4] focus:ring-2 focus:ring-[#4ECDC4]/20 transition-all placeholder:text-[#A8A29E]';
const LBL = 'block text-[10px] font-semibold text-[#A8A29E] uppercase tracking-[0.14em] mb-1.5';

// ── Categories state (per game) ───────────────────────────────────────────────
const defaultCategories = [];

// ── Main component ────────────────────────────────────────────────────────────
export const ShopManagement = () => {
  const { token } = useAuth();
  const [games, setGames]             = useState([]);
  const [projects, setProjects]       = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [products, setProducts]       = useState([]);
  const [categories, setCategories]   = useState(defaultCategories);
  const [subTab, setSubTab]           = useState('products');
  const [showForm, setShowForm]       = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm]               = useState(defaultForm);
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [dialog, setDialog]           = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Category management state
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatIcon, setNewCatIcon]   = useState('package');
  const [savingCats, setSavingCats]   = useState(false);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  useEffect(() => { fetchGames(); fetchProjects(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (selectedGame) { fetchProducts(); fetchCategories(); } /* eslint-disable-next-line */ }, [selectedGame]);

  const fetchGames = async () => {
    try {
      const r = await api.get(`/api/website/games`);
      setGames(r.data.games || []);
      if (r.data.games?.length > 0 && !selectedGame) setSelectedGame(r.data.games[0]);
    } catch (e) {}
  };
  const fetchProjects = async () => {
    try { const r = await api.get(`/api/projects`); setProjects(r.data.projects || []); } catch (e) {}
  };
  const fetchProducts = async () => {
    if (!selectedGame) return;
    try {
      const r = await api.get(`/api/shop/products/admin?game_slug=${selectedGame.slug}`);
      setProducts(r.data.products || []);
    } catch (e) {}
  };
  const fetchCategories = async () => {
    if (!selectedGame) return;
    try {
      // Categories stored in old per-game shop settings — keep fetching for backward compat
      const r = await api.get(`/api/shop/${selectedGame.slug}/settings`);
      setCategories(r.data.categories || []);
    } catch (e) { setCategories([]); }
  };

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
      project_slug: p.project_slug, variable: p.variable, amount: p.amount,
      active: p.active, category: p.category || '', featured: p.featured || false,
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
      category: form.category || null,
      game_slug: selectedGame.slug,
    };
    try {
      if (editingProduct) {
        await api.put(`/api/shop/${selectedGame.slug}/products/${editingProduct.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post(`/api/shop/${selectedGame.slug}/products`, payload);
        toast.success('Product created');
      }
      setShowForm(false); fetchProducts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = (p) => {
    showConfirm({
      title: 'Delete product',
      description: `"${p.name}" will be permanently removed from the shop.`,
      onConfirm: async () => {
        await api.delete(`/api/shop/${selectedGame.slug}/products/${p.id}`);
        toast.success('Deleted'); fetchProducts();
      },
    });
  };

  const toggleActive = async (p) => {
    try {
      await api.put(`/api/shop/${selectedGame.slug}/products/${p.id}`, { active: !p.active });
      fetchProducts();
    } catch { toast.error('Failed'); }
  };

  const addCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (categories.some(c => c.id === id)) { toast.error('Category already exists'); return; }
    const newCat = { id, label, icon: newCatIcon };
    const updated = [...categories, newCat];
    setSavingCats(true);
    try {
      await api.put(`/api/shop/${selectedGame.slug}/settings`, { categories: updated });
      setCategories(updated); setNewCatLabel(''); setNewCatIcon('package');
      toast.success('Category added');
    } catch { toast.error('Failed'); }
    finally { setSavingCats(false); }
  };

  const removeCategory = async (id) => {
    const updated = categories.filter(c => c.id !== id);
    try {
      await api.put(`/api/shop/${selectedGame.slug}/settings`, { categories: updated });
      setCategories(updated); toast.success('Category removed');
    } catch { toast.error('Failed'); }
  };

  const badgeCfg = BADGE_OPTIONS.find(b => b.value === form.badge);

  return (
    <>
    <div className="max-w-5xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#1C1917]">Shop Management</h2>
          <p className="text-xs text-[#A8A29E]">Manage in-app purchase products for each game</p>
        </div>
      </div>

      {/* Game selector */}
      <div className="bg-white border border-[#E8E3DB] p-4">
        <p className={LBL}>Select game</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {games.map(g => (
            <button
              key={g.slug}
              onClick={() => { setSelectedGame(g); setShowForm(false); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold border transition-colors ${
                selectedGame?.slug === g.slug
                  ? 'bg-[#1C1917] text-white border-[#1C1917]'
                  : 'bg-[#F9F7F4] text-[#78716C] border-[#E8E3DB] hover:border-[#C9C3BB] hover:text-[#1C1917]'
              }`}
            >
              <Gamepad2 size={12} />{g.name}
            </button>
          ))}
          {games.length === 0 && <span className="text-sm text-[#A8A29E]">No games found — create a game first.</span>}
        </div>
      </div>

      {selectedGame && (
        <>
          {/* Sub-tabs */}
          <div className="flex border-b border-[#E8E3DB]">
            {[{ id: 'products', label: 'Products', icon: Package }, { id: 'categories', label: 'Categories', icon: Tag }].map(t => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                  subTab === t.id ? 'border-[#1C1917] text-[#1C1917]' : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                <t.icon size={13} />{t.label}
              </button>
            ))}
          </div>

          {/* ── PRODUCTS TAB ───────────────────────────────────────────────── */}
          {subTab === 'products' && (
            <div className="bg-white border border-[#E8E3DB]">
              {/* Toolbar */}
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#E8E3DB]">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-[#4ECDC4]" />
                  <span className="text-sm font-semibold text-[#1C1917]">
                    {selectedGame.name} — {products.length} product{products.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Button icon={showForm ? X : Plus} onClick={() => showForm ? setShowForm(false) : openCreate()}>
                  {showForm ? 'Cancel' : 'Add Product'}
                </Button>
              </div>

              {/* Product form */}
              {showForm && (
                <div className="p-5 bg-[#F9F7F4] border-b border-[#E8E3DB]">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={LBL}>Product Name</label>
                        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={IN} required placeholder="100 Gold Coins" />
                      </div>
                      <div>
                        <label className={LBL}>Price (€)</label>
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
                          <label className="shrink-0 cursor-pointer px-3 py-2.5 bg-[#1C1917] hover:bg-[#2D2926] text-white text-sm font-semibold transition-colors">
                            {uploading ? '…' : 'Upload'}
                            <input type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, url => setForm(f => ({ ...f, image_url: url })))} />
                          </label>
                        </div>
                        {form.image_url && (
                          <img
                            src={form.image_url.startsWith('/') ? `${API_URL}${form.image_url}` : form.image_url}
                            alt="preview"
                            className="mt-2 h-16 w-16 object-cover border border-[#E8E3DB]"
                          />
                        )}
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
                              className={`px-2.5 py-1 text-[10px] font-bold border transition-all ${
                                form.badge === b.value
                                  ? 'border-[#1C1917] bg-[#1C1917] text-white'
                                  : 'border-[#E8E3DB] text-[#78716C] hover:border-[#C9C3BB]'
                              }`}
                              style={form.badge === b.value && b.color ? { backgroundColor: b.color, borderColor: b.color } : {}}
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
                          <p className="text-[10px] text-[#A8A29E] mt-1">Shown on badge label only — does not affect price.</p>
                        </div>
                      )}

                      {/* Category */}
                      <div>
                        <label className={LBL}>Category</label>
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={IN}>
                          <option value="">— No category —</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>

                      {/* Backend project */}
                      <div>
                        <label className={LBL}>Backend Project</label>
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
                              className={`w-9 h-5 relative transition-colors ${form[key] ? 'bg-[#4ECDC4]' : 'bg-[#E8E3DB]'}`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 bg-white shadow transition-all ${form[key] ? 'left-4' : 'left-0.5'}`} />
                            </button>
                            <span className="text-xs font-semibold text-[#78716C]">{label}</span>
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

              {/* Product list */}
              <div className="p-5">
                {products.length === 0 ? (
                  <EmptyState icon={ShoppingBag} title={`No products yet for ${selectedGame.name}`} description="Add a product to start selling." />
                ) : (
                  <div className="space-y-2">
                    {products.map(p => {
                      const badge = BADGE_OPTIONS.find(b => b.value === p.badge);
                      const cat = categories.find(c => c.id === p.category);
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 p-3 border transition-all ${
                            p.active ? 'bg-white border-[#E8E3DB]' : 'bg-[#F9F7F4] border-[#E8E3DB] opacity-60'
                          }`}
                        >
                          {p.image_url && (
                            <img
                              src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url}
                              alt={p.name}
                              className="w-11 h-11 object-cover shrink-0 border border-[#E8E3DB]"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[#1C1917]">{p.name}</span>
                              {p.featured && <Star size={11} className="text-[#F59E0B] fill-[#F59E0B]" />}
                              {badge?.value && (
                                <span
                                  className="text-[9px] font-black px-1.5 py-0.5 text-white"
                                  style={{ backgroundColor: badge.color }}
                                >
                                  {badge.label}
                                </span>
                              )}
                              {cat && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#78716C]">
                                  <CategoryIcon name={cat.icon} size={9} />{cat.label}
                                </span>
                              )}
                              {!p.active && <span className="text-[10px] font-bold text-[#A8A29E] bg-[#F9F7F4] border border-[#E8E3DB] px-1.5 py-0.5">Hidden</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-sm font-black text-[#1C1917]">€{(p.price / 100).toFixed(2)}</span>
                              <span className="text-xs text-[#A8A29E]">→ {p.amount}× {p.variable} ({p.project_slug})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleActive(p)}
                              className="p-2 border border-[#E8E3DB] hover:border-[#C9C3BB] text-[#A8A29E] hover:text-[#1C1917] transition-all"
                              title={p.active ? 'Hide' : 'Show'}
                            >
                              {p.active ? <Eye size={13} /> : <EyeOff size={13} />}
                            </button>
                            <button onClick={() => openEdit(p)} className="p-2 border border-[#E8E3DB] hover:border-[#C9C3BB] text-[#A8A29E] hover:text-[#1C1917] transition-all"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(p)} className="p-2 border border-[#E8E3DB] hover:border-red-200 text-[#A8A29E] hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CATEGORIES TAB ────────────────────────────────────────────── */}
          {subTab === 'categories' && (
            <div className="bg-white border border-[#E8E3DB] p-5 space-y-5">
              <p className="text-xs text-[#78716C]">
                Categories group products in the shop. They appear as filter tabs on the shop page.
              </p>

              {/* Existing categories */}
              {categories.length === 0 ? (
                <p className="text-sm text-[#A8A29E]">No categories yet. Add one below.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F9F7F4] border border-[#E8E3DB] text-sm"
                    >
                      <CategoryIcon name={c.icon} size={13} className="text-[#4ECDC4]" />
                      <span className="font-semibold text-[#1C1917]">{c.label}</span>
                      <span className="text-[#A8A29E] text-xs">#{c.id}</span>
                      <button onClick={() => removeCategory(c.id)} className="text-[#A8A29E] hover:text-red-500 transition-colors ml-0.5">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new */}
              <div>
                <p className={LBL}>Add Category</p>
                <div className="flex gap-2 items-center">
                  <div className="w-40 shrink-0">
                    <IconPicker value={newCatIcon} onChange={setNewCatIcon} />
                  </div>
                  <input
                    type="text"
                    value={newCatLabel}
                    onChange={e => setNewCatLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                    className={`${IN} flex-1`}
                    placeholder="Category name (e.g. Weapons)"
                  />
                  <Button icon={Plus} onClick={addCategory} loading={savingCats} className="shrink-0">
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Public shop link */}
          <div className="bg-white border border-[#E8E3DB] px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className={LBL}>Public Shop URL</p>
              <code className="text-sm text-[#4ECDC4] font-mono">/shop?game={selectedGame.slug}</code>
            </div>
            <a
              href={`/shop?game=${selectedGame.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 border border-[#E8E3DB] hover:border-[#C9C3BB] text-[#78716C] hover:text-[#1C1917] text-sm font-semibold transition-all"
            >
              Open Shop ↗
            </a>
          </div>
        </>
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
