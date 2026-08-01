import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Edit2, Trash2, Save, X, Package, Tag, Search,
  Eye, EyeOff, Star, Shield, Zap, Heart, Leaf, Flame, Target, Trophy, Rocket, Gem,
  Key, Lock, Wrench, Hammer, Globe, Sparkles, Box, Layers, Users,
  Award, Map, Cpu, Music, Moon, Sun, Gift, ChevronDown, Gamepad2, Settings2,
} from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, EmptyState, Select } from '../ui';

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
  { value: 'EXCLUSIVE', label: '✦ Exclusive',   color: '#1D1D1F' },
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
        className="rounded-xl flex items-center gap-2 px-3 py-2.5 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-[#e4e4e7] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] transition-all w-full">
        <Comp size={14} className="text-[#4ECDC4] shrink-0" />
        <span className="flex-1 text-left capitalize text-[#6E6E73] dark:text-[#a1a1aa]">{value || 'Icon…'}</span>
        <ChevronDown size={12} className="text-[#A1A1A6] dark:text-[#71717a] shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-lg z-30 grid grid-cols-7 gap-1 min-w-[240px]">
          {Object.entries(CATEGORY_ICONS).map(([name, IC]) => (
            <button key={name} type="button" title={name}
              onClick={() => { onChange(name); setOpen(false); }}
              className={`rounded-lg p-2 flex items-center justify-center hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition-all ${value === name ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'text-[#6E6E73] dark:text-[#a1a1aa]'}`}>
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
  badge: '', discount_pct: '', game_slug: '', project_slug: '', variable: '', amount: '',
  active: true, category: '', subcategory: '', featured: false,
};

const IN = 'w-full rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm px-3 py-2.5 focus:outline-none focus:border-[#4ECDC4] focus:ring-2 focus:ring-[#4ECDC4]/20 transition-all placeholder:text-[#A1A1A6]';
const LBL = 'block text-[10px] font-semibold text-[#A1A1A6] uppercase tracking-[0.14em] mb-1.5';

// ── Main component ────────────────────────────────────────────────────────────
export const ShopManagement = () => {
  const [games,    setGames]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [search,       setSearch]       = useState('');
  const [filterGame,   setFilterGame]   = useState('');
  const [filterCat,    setFilterCat]    = useState('');

  const [showForm,        setShowForm]        = useState(false);
  const [showCategories,  setShowCategories]  = useState(false);
  const [editingProduct,  setEditingProduct]  = useState(null);
  const [form,     setForm]     = useState(defaultForm);
  const [loading,  setLoading]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dialog,   setDialog]   = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Category management state
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatIcon, setNewCatIcon]   = useState('package');
  const [savingCats, setSavingCats]   = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const [newSubLabel, setNewSubLabel] = useState('');

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

  const fetchCategories = useCallback(async () => {
    try {
      const r = await api.get('/api/shop/settings');
      setCategories(r.data.categories || []);
    } catch { setCategories([]); }
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
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

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
      active: p.active, category: p.category || '', subcategory: p.subcategory || '', featured: p.featured || false,
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
      subcategory: form.subcategory || null,
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

  const saveCategories = async (updated) => {
    await api.put(`/api/shop/settings`, { categories: updated });
    setCategories(updated);
  };

  const addCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (categories.some(c => c.id === id)) { toast.error('Category already exists'); return; }
    const newCat = { id, label, icon: newCatIcon, subcategories: [] };
    setSavingCats(true);
    try {
      await saveCategories([...categories, newCat]);
      setNewCatLabel(''); setNewCatIcon('package');
      toast.success('Category added');
    } catch { toast.error('Failed to add category'); }
    finally { setSavingCats(false); }
  };

  const removeCategory = async (id) => {
    try {
      await saveCategories(categories.filter(c => c.id !== id));
      if (expandedCat === id) setExpandedCat(null);
      toast.success('Category removed');
    } catch { toast.error('Failed to remove category'); }
  };

  const addSubcategory = async (catId) => {
    const label = newSubLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const updated = categories.map(c => {
      if (c.id !== catId) return c;
      const subs = c.subcategories || [];
      if (subs.some(s => s.id === id)) { toast.error('Sub-category already exists'); return c; }
      return { ...c, subcategories: [...subs, { id, label }] };
    });
    try {
      await saveCategories(updated);
      setNewSubLabel('');
      toast.success('Sub-category added');
    } catch { toast.error('Failed to add sub-category'); }
  };

  const removeSubcategory = async (catId, subId) => {
    const updated = categories.map(c => c.id !== catId ? c : {
      ...c, subcategories: (c.subcategories || []).filter(s => s.id !== subId),
    });
    try {
      await saveCategories(updated);
      toast.success('Sub-category removed');
    } catch { toast.error('Failed to remove sub-category'); }
  };

  const gameName = (slug) => games.find(g => g.slug === slug)?.name || slug;

  const filtered = products.filter(p => {
    if (filterGame && p.game_slug !== filterGame) return false;
    if (filterCat && p.category !== filterCat) return false;
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
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={Settings2} onClick={() => setShowCategories(v => !v)}>
            {showCategories ? 'Close Categories' : 'Manage Categories'}
          </Button>
          <Button icon={showForm ? X : Plus} onClick={() => showForm ? setShowForm(false) : openCreate()}>
            {showForm ? 'Cancel' : 'Add Product'}
          </Button>
        </div>
      </div>

      {/* ── Categories panel ─────────────────────────────────────────────── */}
      {showCategories && (
        <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 space-y-5">
          <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
            One category list, shared across every game. Each category can have optional sub-categories for finer filtering.
          </p>

          {categories.length === 0 ? (
            <p className="text-sm text-[#A1A1A6] dark:text-[#71717a]">No categories yet. Add one below.</p>
          ) : (
            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className="rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c]">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F5F5F7] dark:bg-[#111118]">
                    <CategoryIcon name={c.icon} size={13} className="text-[#4ECDC4]" />
                    <span className="font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] text-sm flex-1">{c.label}</span>
                    <span className="text-[#A1A1A6] dark:text-[#71717a] text-xs">{(c.subcategories || []).length} sub</span>
                    <button
                      onClick={() => setExpandedCat(expandedCat === c.id ? null : c.id)}
                      className="rounded-xl text-xs text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white px-2 py-0.5 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] transition-colors"
                    >
                      {expandedCat === c.id ? 'Collapse' : 'Sub-categories'}
                    </button>
                    <button onClick={() => removeCategory(c.id)} className="text-[#A1A1A6] dark:text-[#71717a] hover:text-red-500 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                  {expandedCat === c.id && (
                    <div className="px-4 py-3 border-t border-[#D2D2D7] dark:border-[#2a2a3c] space-y-2">
                      {(c.subcategories || []).length === 0 ? (
                        <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">No sub-categories yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(c.subcategories || []).map(s => (
                            <div key={s.id} className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] text-xs">
                              <span className="text-[#1D1D1F] dark:text-[#e4e4e7] font-medium">{s.label}</span>
                              <button onClick={() => removeSubcategory(c.id, s.id)} className="text-[#A1A1A6] dark:text-[#71717a] hover:text-red-500 transition-colors ml-0.5">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 items-center mt-2">
                        <input
                          type="text"
                          value={newSubLabel}
                          onChange={e => setNewSubLabel(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubcategory(c.id))}
                          className={`${IN} flex-1`}
                          placeholder="Sub-category name (e.g. Premium Pass)"
                        />
                        <Button icon={Plus} onClick={() => addSubcategory(c.id)} className="shrink-0">Add</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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
              <Button icon={Plus} onClick={addCategory} loading={savingCats} className="shrink-0">Add</Button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-1">Shown on badge label only — does not affect price.</p>
                </div>
              )}

              {/* Category */}
              <div>
                <label className={LBL}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: '' }))} className={IN}>
                  <option value="">— No category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {/* Sub-category */}
              {form.category && (() => {
                const cat = categories.find(c => c.id === form.category);
                const subs = cat?.subcategories || [];
                if (subs.length === 0) return null;
                return (
                  <div>
                    <label className={LBL}>Sub-category</label>
                    <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} className={IN}>
                      <option value="">— No sub-category —</option>
                      {subs.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                );
              })()}

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
        <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} wrapperClassName="w-48 shrink-0">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
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
              const cat = categories.find(c => c.id === p.category);
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
                        <span className="text-[9px] font-bold px-1.5 py-0.5 text-white" style={{ backgroundColor: badge.color }}>
                          {badge.label}
                        </span>
                      )}
                      {cat && (
                        <span className="rounded-xl inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa]">
                          <CategoryIcon name={cat.icon} size={9} />{cat.label}
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
