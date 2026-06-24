import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Edit2, Trash2, Save, X, Settings, Package,
  Eye, EyeOff, Link2, Upload, Download, Palette, Gift, Tag, Star,
  Shield, Zap, Heart, Leaf, Flame, Target, Trophy, Rocket, Gem,
  Key, Lock, Wrench, Hammer, Globe, Sparkles, Box, Layers, Users,
  Award, Map, Cpu, Music, Moon, Sun, ChevronDown,
} from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardBody, EmptyState } from '../ui';

const BADGE_OPTIONS = ['', 'NEW', 'SALE', 'LIMITED', 'HOT', 'POPULAR'];

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
        className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg text-sm text-zinc-700 dark:text-[#e4e4e7] hover:border-[#6C5CE7]/40 transition-all w-full">
        <Comp size={15} className="text-[#6C5CE7] shrink-0" />
        <span className="flex-1 text-left capitalize">{value || 'Choose icon…'}</span>
        <ChevronDown size={12} className="text-[#71717a] shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl shadow-xl z-30 grid grid-cols-7 gap-1 min-w-[240px]">
          {Object.entries(CATEGORY_ICONS).map(([name, IC]) => (
            <button key={name} type="button" title={name}
              onClick={() => { onChange(name); setOpen(false); }}
              className={`p-2 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-[#2a2a3c] transition-all ${value === name ? 'bg-[#6C5CE7]/15 text-[#6C5CE7]' : 'text-zinc-500 dark:text-[#71717a]'}`}>
              <IC size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const defaultForm = {
  name: '', description: '', price: '', image_url: '',
  badge: '', discount_pct: '', project_slug: '', variable: '', amount: '',
  active: true, category: '', featured: false,
};

const defaultSettings = {
  shop_title: '', banner_url: '', banner_title: '', banner_subtitle: '',
  banner_height: 'md', banner_overlay: 'rgba(0,0,0,0.55)',
  primary_color: '#6C5CE7', accent_color: '#A29BFE',
  background_color: '', surface_color: '', border_color: '',
  text_color: '', text_muted_color: '', price_color: '',
  bg_texture_url: '', bg_texture_opacity: 0.05,
  card_style: 'rounded', card_shadow: 'sm',
  featured_section_title: 'Featured Offers',
  footer_text: '', categories: [],
};

const defaultGift = {
  active: false, title: 'Daily Gift', description: '',
  image_url: '', project_slug: '', variable: '', amount: '',
};

const EXPORT_KEYS = Object.keys(defaultSettings);

// ─── Style presets ────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: 'default', label: 'Default', emoji: '✨',
    theme: { primary_color: '#6C5CE7', accent_color: '#A29BFE', background_color: '', surface_color: '', border_color: '', text_color: '', text_muted_color: '', price_color: '', card_style: 'rounded', card_shadow: 'sm', banner_overlay: 'rgba(0,0,0,0.55)' },
  },
  {
    id: 'pro', label: 'Pro Dark', emoji: '🖤',
    theme: { primary_color: '#0984E3', accent_color: '#74B9FF', background_color: '#080C14', surface_color: '#101520', border_color: '#1C2538', text_color: '#E4E4F0', text_muted_color: '#5A6480', price_color: '#74B9FF', card_style: 'sharp', card_shadow: 'sm', banner_overlay: 'rgba(8,12,20,0.75)' },
  },
  {
    id: 'cartoon', label: 'Cartoon', emoji: '🎨',
    theme: { primary_color: '#FF6B6B', accent_color: '#FFE66D', background_color: '#FFF5E4', surface_color: '#FFFFFF', border_color: '#FFD93D', text_color: '#2C3E50', text_muted_color: '#7F8C8D', price_color: '#E74C3C', card_style: 'rounded', card_shadow: 'md', banner_overlay: 'rgba(0,0,0,0.25)' },
  },
  {
    id: 'space', label: 'Space / Neon', emoji: '🚀',
    theme: { primary_color: '#00CEC9', accent_color: '#6C5CE7', background_color: '#060C1E', surface_color: '#0D1528', border_color: '#1A2744', text_color: '#E4F2FF', text_muted_color: '#6B8CC7', price_color: '#00CEC9', card_style: 'sharp', card_shadow: 'glow', banner_overlay: 'rgba(6,12,30,0.75)' },
  },
  {
    id: 'fantasy', label: 'Fantasy', emoji: '🔮',
    theme: { primary_color: '#A29BFE', accent_color: '#FD79A8', background_color: '#0D0B1A', surface_color: '#1A1530', border_color: '#2D2560', text_color: '#E8E0FF', text_muted_color: '#8B7EC8', price_color: '#FD79A8', card_style: 'rounded', card_shadow: 'glow', banner_overlay: 'rgba(13,11,26,0.7)' },
  },
  {
    id: 'apocalyptic', label: 'Apocalyptic', emoji: '☠️',
    theme: { primary_color: '#C0392B', accent_color: '#E67E22', background_color: '#0A0806', surface_color: '#13100A', border_color: '#3D2B15', text_color: '#D4C5A9', text_muted_color: '#7A6A55', price_color: '#E67E22', card_style: 'sharp', card_shadow: 'glow', banner_overlay: 'rgba(10,5,0,0.82)' },
  },
  {
    id: 'brawlstars', label: 'Brawl Stars', emoji: '💎',
    theme: { primary_color: '#B24BF3', accent_color: '#FFDA44', background_color: '#1A1033', surface_color: '#231545', border_color: '#3B2A6E', text_color: '#E8E0FF', text_muted_color: '#9B8EC4', price_color: '#FFDA44', card_style: 'rounded', card_shadow: 'glow', banner_overlay: 'rgba(26,16,51,0.7)' },
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
const ColorRow = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs font-semibold text-[#71717a] mb-1.5 uppercase tracking-wider">{label}</label>
    <div className="flex gap-2 items-center">
      <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
        className="w-10 h-10 rounded cursor-pointer border border-zinc-200 dark:border-[#2a2a3c] bg-transparent shrink-0" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#6C5CE7] focus:outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-[#52525b]" />
    </div>
  </div>
);

const SectionDivider = ({ label }) => (
  <div className="col-span-full flex items-center gap-2 pt-3">
    <div className="h-px flex-1 bg-zinc-200 dark:bg-[#2a2a3c]" />
    <span className="text-[10px] font-bold tracking-widest text-[#71717a] uppercase px-1">{label}</span>
    <div className="h-px flex-1 bg-zinc-200 dark:bg-[#2a2a3c]" />
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────
export const ShopManagement = () => {
  const { token } = useAuth();
  const [games, setGames]           = useState([]);
  const [projects, setProjects]     = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [products, setProducts]     = useState([]);
  const [settings, setSettings]     = useState(defaultSettings);
  const [gift, setGift]             = useState(defaultGift);
  const [subTab, setSubTab]         = useState('products');
  const [showForm, setShowForm]     = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm]             = useState(defaultForm);
  const [loading, setLoading]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [dialog, setDialog]         = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');

  // Category editor
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatIcon, setNewCatIcon]   = useState('package');

  useEffect(() => { fetchGames(); fetchProjects(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (selectedGame) { fetchProducts(); fetchSettings(); fetchGift(); } /* eslint-disable-next-line */ }, [selectedGame]);

  const fetchGames = async () => {
    try {
      const r = await api.get(`/api/website/games`);
      setGames(r.data.games || []);
      if (r.data.games?.length > 0 && !selectedGame) setSelectedGame(r.data.games[0]);
    } catch (e) {}
  };
  const fetchProjects = async () => {
    try {
      const r = await api.get(`/api/projects`);
      setProjects(r.data.projects || []);
    } catch (e) {}
  };
  const fetchProducts = async () => {
    if (!selectedGame) return;
    try {
      const r = await api.get(`/api/shop/${selectedGame.slug}/products/admin`);
      setProducts(r.data.products || []);
    } catch (e) {}
  };
  const fetchSettings = async () => {
    if (!selectedGame) return;
    try {
      const r = await api.get(`/api/shop/${selectedGame.slug}/settings`);
      setSettings({ ...defaultSettings, ...r.data });
    } catch (e) {}
  };
  const fetchGift = async () => {
    if (!selectedGame) return;
    try {
      const r = await api.get(`/api/shop/${selectedGame.slug}/daily-gift/admin`);
      setGift({ ...defaultGift, ...r.data });
    } catch (e) {}
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
    } catch (e) { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const openCreate = () => { setEditingProduct(null); setForm(defaultForm); setShowForm(true); };
  const openEdit   = (p) => {
    setEditingProduct(p);
    setForm({ name: p.name, description: p.description || '', price: (p.price / 100).toFixed(2),
              image_url: p.image_url || '', badge: p.badge || '', discount_pct: p.discount_pct ?? '',
              project_slug: p.project_slug, variable: p.variable, amount: p.amount,
              active: p.active, category: p.category || '', featured: p.featured || false });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, price: Math.round(parseFloat(form.price) * 100),
                      discount_pct: form.discount_pct !== '' ? parseInt(form.discount_pct) : null,
                      badge: form.badge || null, category: form.category || null };
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
        toast.success('Deleted');
        fetchProducts();
      },
    });
  };

  const toggleActive = async (p) => {
    try {
      await api.put(`/api/shop/${selectedGame.slug}/products/${p.id}`, { active: !p.active });
      fetchProducts();
    } catch (e) { toast.error('Failed'); }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await api.put(`/api/shop/${selectedGame.slug}/settings`, settings);
      toast.success('Theme saved');
    } catch (e) { toast.error('Failed to save'); }
    finally { setLoading(false); }
  };

  const saveGift = async () => {
    setLoading(true);
    try {
      await api.put(`/api/shop/${selectedGame.slug}/daily-gift`, gift);
      toast.success('Daily gift saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
    finally { setLoading(false); }
  };

  const handleExport = () => {
    const out = Object.fromEntries(EXPORT_KEYS.map(k => [k, settings[k] ?? defaultSettings[k]]));
    navigator.clipboard.writeText(JSON.stringify(out, null, 2)).then(() => toast.success('Theme code copied!'));
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      const filtered = Object.fromEntries(EXPORT_KEYS.filter(k => k in parsed).map(k => [k, parsed[k]]));
      setSettings(s => ({ ...s, ...filtered }));
      setShowImport(false); setImportJson('');
      toast.success('Theme imported — save to apply.');
    } catch { toast.error('Invalid JSON.'); }
  };

  const applyPreset = (preset) => {
    setSettings(s => ({ ...s, ...preset.theme }));
    toast.success(`"${preset.label}" preset applied — save to apply.`);
  };

  const addCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (settings.categories.some(c => c.id === id)) { toast.error('Category already exists'); return; }
    const newCat = { id, label, icon: newCatIcon };
    const updated = { ...settings, categories: [...settings.categories, newCat] };
    setSettings(updated);
    setNewCatLabel(''); setNewCatIcon('package');
    try {
      await api.put(`/api/shop/${selectedGame.slug}/settings`, updated);
      toast.success('Category added');
    } catch (e) { toast.error('Added locally — click Save Theme to persist'); }
  };

  const removeCategory = async (id) => {
    const updated = { ...settings, categories: settings.categories.filter(c => c.id !== id) };
    setSettings(updated);
    try {
      await api.put(`/api/shop/${selectedGame.slug}/settings`, updated);
      toast.success('Category removed');
    } catch (e) { toast.error('Removed locally — click Save Theme to persist'); }
  };

  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const inputClass = 'w-full bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#6C5CE7] focus:outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-[#52525b]';
  const labelClass = 'block text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] mb-1.5 uppercase tracking-widest';

  const TABS = [
    { id: 'products',  label: 'Products',    icon: Package },
    { id: 'theme',     label: 'Theme',        icon: Palette },
    { id: 'daily',     label: 'Daily Gift',   icon: Gift },
  ];

  return (
    <>
    <div className="max-w-5xl space-y-4">
      {/* Game selector */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest shrink-0">Game Shop:</label>
          <div className="flex flex-wrap gap-2">
            {games.map(g => (
              <button key={g.slug} onClick={() => setSelectedGame(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${selectedGame?.slug === g.slug ? 'bg-[#6C5CE7] text-white' : 'bg-zinc-100 dark:bg-[#1c1c2e] text-zinc-600 dark:text-[#71717a] hover:bg-zinc-200 dark:hover:bg-[#2a2a3c]'}`}>
                {g.name}
              </button>
            ))}
            {games.length === 0 && <span className="text-sm text-[#71717a]">No games found — create a game first.</span>}
          </div>
        </div>
      </Card>

      {selectedGame && (
        <>
          <Card className="overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-[#2a2a3c]">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setSubTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${subTab === t.id ? 'border-[#6C5CE7] text-[#6C5CE7]' : 'border-transparent text-[#71717a] hover:text-zinc-700 dark:hover:text-[#e4e4e7]'}`}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>

            {/* ══════════════════════════════════════════════════════
                PRODUCTS TAB
            ══════════════════════════════════════════════════════ */}
            {subTab === 'products' && (
              <div>
                <div className="px-5 py-3.5 flex justify-between items-center border-b border-zinc-200 dark:border-[#2a2a3c]">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[#6C5CE7]" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">
                      {selectedGame.name} — {products.length} product(s)
                    </span>
                  </div>
                  <Button variant="purple" icon={Plus} onClick={openCreate}>Add Product</Button>
                </div>

                {/* Product form */}
                {showForm && (
                  <div className="p-5 bg-zinc-50 dark:bg-[#111118] border-b border-zinc-200 dark:border-[#2a2a3c]">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Product Name</label>
                          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} required />
                        </div>
                        <div>
                          <label className={labelClass}>Price (€)</label>
                          <input type="number" step="0.01" min="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className={inputClass} required placeholder="9.99" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Description</label>
                          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputClass} resize-none h-20`} placeholder="Short description shown on the product card..." />
                        </div>
                        <div>
                          <label className={labelClass}>Product Image</label>
                          <div className="flex gap-2">
                            <input type="text" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className={inputClass} placeholder="https://... or upload" />
                            <label className="shrink-0 cursor-pointer px-3 py-2.5 bg-zinc-200 dark:bg-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm hover:bg-zinc-300 dark:hover:bg-[#3a3a4c] transition-all">
                              {uploading ? '...' : 'Upload'}
                              <input type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, url => setForm(f => ({ ...f, image_url: url })))} />
                            </label>
                          </div>
                          {form.image_url && <img src={form.image_url.startsWith('/') ? `${API_URL}${form.image_url}` : form.image_url} alt="preview" className="mt-2 h-20 w-20 object-cover rounded-lg border border-zinc-200 dark:border-[#2a2a3c]" />}
                        </div>
                        <div>
                          <label className={labelClass}>Badge</label>
                          <select value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })} className={inputClass}>
                            {BADGE_OPTIONS.map(b => <option key={b} value={b}>{b || '— None —'}</option>)}
                          </select>
                        </div>
                        {form.badge === 'SALE' && (
                          <div>
                            <label className={labelClass}>Discount %</label>
                            <input type="number" min="1" max="99" value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: e.target.value })} className={inputClass} placeholder="20" />
                          </div>
                        )}
                        <div>
                          <label className={labelClass}>Category</label>
                          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass}>
                            <option value="">— No category —</option>
                            {settings.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Backend Project</label>
                          <select value={form.project_slug} onChange={e => setForm({ ...form, project_slug: e.target.value })} className={inputClass} required>
                            <option value="">— Select a project —</option>
                            {projects.map(p => <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Variable to send</label>
                          <input type="text" value={form.variable} onChange={e => setForm({ ...form, variable: e.target.value })} className={inputClass} required placeholder="gold, skin_dragon..." />
                        </div>
                        <div>
                          <label className={labelClass}>Amount</label>
                          <input type="text" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputClass} required placeholder="100, legendary, true..." />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Featured</label>
                            <button type="button" onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
                              className={`w-10 h-5 rounded-full transition-all relative ${form.featured ? 'bg-[#6C5CE7]' : 'bg-zinc-300 dark:bg-[#2a2a3c]'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.featured ? 'left-5' : 'left-0.5'}`} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Active</label>
                            <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                              className={`w-10 h-5 rounded-full transition-all relative ${form.active ? 'bg-[#6C5CE7]' : 'bg-zinc-300 dark:bg-[#2a2a3c]'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.active ? 'left-5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button variant="purple" type="submit" loading={loading} icon={Save}>
                          {loading ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
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
                      {products.map(p => (
                        <div key={p.id} className={`bg-zinc-50 dark:bg-[#111118] border rounded-xl p-3 flex items-center gap-3 transition-all ${p.active ? 'border-zinc-200 dark:border-[#2a2a3c]' : 'border-zinc-200/40 dark:border-[#2a2a3c]/40 opacity-60'}`}>
                          {p.image_url && <img src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded-lg shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-zinc-900 dark:text-[#e4e4e7]">{p.name}</span>
                              {p.featured && <Star size={11} className="text-yellow-400 fill-yellow-400" />}
                              {p.badge && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#6C5CE7]/20 text-[#A29BFE] uppercase">{p.badge}</span>}
                              {p.category && (() => { const cat = settings.categories.find(c => c.id === p.category); return cat ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-zinc-200 dark:bg-[#2a2a3c] text-[#71717a]">
                                  <CategoryIcon name={cat.icon} size={10} />{cat.label}
                                </span>) : null; })()}
                              {!p.active && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-zinc-200 dark:bg-[#2a2a3c] text-[#71717a]">HIDDEN</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-sm font-bold text-[#6C5CE7]">€{(p.price / 100).toFixed(2)}</span>
                              <span className="text-xs text-[#71717a]">→ {p.amount}× {p.variable}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/shop/${selectedGame.slug}?product=${p.id}`).then(() => toast.success('Link copied!')); }}
                              className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/40 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all"><Link2 size={13} /></button>
                            <button onClick={() => toggleActive(p)}
                              className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/40 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all">{p.active ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                            <button onClick={() => openEdit(p)}
                              className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/40 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(p)}
                              className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400 transition-all"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                THEME TAB
            ══════════════════════════════════════════════════════ */}
            {subTab === 'theme' && (
              <div className="p-5 space-y-5">

                {/* Style presets */}
                <div>
                  <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-3">Quick Style Presets</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => applyPreset(p)}
                        className="flex items-center gap-2 px-3 py-2.5 bg-zinc-100 dark:bg-[#1c1c2e] hover:bg-zinc-200 dark:hover:bg-[#2a2a3c] border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/40 rounded-xl text-sm font-medium text-zinc-700 dark:text-[#e4e4e7] transition-all text-left">
                        <span className="text-base">{p.emoji}</span>
                        <span className="truncate text-xs">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Import / Export */}
                <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-[#111118] rounded-xl border border-zinc-200 dark:border-[#2a2a3c]">
                  <Settings size={13} className="text-[#71717a] shrink-0" />
                  <span className="text-xs text-[#71717a] flex-1">Import a JSON theme code or export the current theme.</span>
                  <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg text-xs font-semibold transition-all"><Upload size={11} />Import</button>
                  <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 dark:bg-[#2a2a3c] hover:bg-zinc-300 dark:hover:bg-[#3a3a4c] text-zinc-700 dark:text-[#e4e4e7] rounded-lg text-xs font-semibold transition-all"><Download size={11} />Export</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <SectionDivider label="Banner" />

                  <div className="md:col-span-2">
                    <label className={labelClass}>Shop Title</label>
                    <input type="text" value={settings.shop_title} onChange={e => set('shop_title', e.target.value)} className={inputClass} placeholder={`${selectedGame.name} Shop`} />
                  </div>
                  <div>
                    <label className={labelClass}>Subtitle</label>
                    <input type="text" value={settings.banner_subtitle} onChange={e => set('banner_subtitle', e.target.value)} className={inputClass} placeholder="Buy items and get them in-game instantly." />
                  </div>
                  <div>
                    <label className={labelClass}>Banner Height</label>
                    <div className="flex gap-2">
                      {[['sm','Small'],['md','Medium'],['lg','Large']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => set('banner_height', v)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${settings.banner_height === v ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]' : 'bg-zinc-100 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Banner Image</label>
                    <div className="flex gap-2">
                      <input type="text" value={settings.banner_url} onChange={e => set('banner_url', e.target.value)} className={inputClass} placeholder="https://... or upload" />
                      <label className="shrink-0 cursor-pointer px-3 py-2.5 bg-zinc-200 dark:bg-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm hover:bg-zinc-300 dark:hover:bg-[#3a3a4c] transition-all">
                        {uploading ? '...' : 'Upload'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, url => set('banner_url', url))} />
                      </label>
                    </div>
                    {settings.banner_url && <img src={settings.banner_url.startsWith('/') ? `${API_URL}${settings.banner_url}` : settings.banner_url} alt="banner" className="mt-2 h-20 w-full object-cover rounded-lg" />}
                  </div>
                  <div>
                    <label className={labelClass}>Banner Overlay (rgba)</label>
                    <input type="text" value={settings.banner_overlay} onChange={e => set('banner_overlay', e.target.value)} className={inputClass} placeholder="rgba(0,0,0,0.55)" />
                  </div>

                  <SectionDivider label="Colors" />

                  <ColorRow label="Primary Color (buttons)" value={settings.primary_color} onChange={v => set('primary_color', v)} placeholder="#6C5CE7" />
                  <ColorRow label="Accent Color" value={settings.accent_color} onChange={v => set('accent_color', v)} placeholder="#A29BFE" />
                  <ColorRow label="Price Color (empty = primary)" value={settings.price_color} onChange={v => set('price_color', v)} placeholder="#6C5CE7" />
                  <ColorRow label="Page Background (empty = default)" value={settings.background_color} onChange={v => set('background_color', v)} placeholder="#f4f4f8" />
                  <ColorRow label="Card Background (empty = default)" value={settings.surface_color} onChange={v => set('surface_color', v)} placeholder="#ffffff" />
                  <ColorRow label="Card Border (empty = default)" value={settings.border_color} onChange={v => set('border_color', v)} placeholder="#e4e4e7" />
                  <ColorRow label="Primary Text (empty = default)" value={settings.text_color} onChange={v => set('text_color', v)} placeholder="#18181b" />
                  <ColorRow label="Secondary Text (empty = default)" value={settings.text_muted_color} onChange={v => set('text_muted_color', v)} placeholder="#71717a" />

                  <SectionDivider label="Cards" />

                  <div>
                    <label className={labelClass}>Card Style</label>
                    <div className="flex gap-2">
                      {[['rounded','Rounded'],['sharp','Sharp']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => set('card_style', v)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-all ${settings.card_style === v ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]' : 'bg-zinc-100 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Card Shadow</label>
                    <div className="flex gap-2 flex-wrap">
                      {[['none','None'],['sm','Light'],['md','Medium'],['glow','Glow']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => set('card_shadow', v)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${settings.card_shadow === v ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]' : 'bg-zinc-100 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a]'}`}>{l}</button>
                      ))}
                    </div>
                  </div>

                  <SectionDivider label="Background Texture (optional)" />

                  <div className="md:col-span-2">
                    <label className={labelClass}>Texture URL (repeated image)</label>
                    <input type="text" value={settings.bg_texture_url} onChange={e => set('bg_texture_url', e.target.value)} className={inputClass} placeholder="https://... (transparent PNG recommended)" />
                  </div>
                  <div>
                    <label className={labelClass}>Texture Opacity ({Math.round((settings.bg_texture_opacity || 0) * 100)}%)</label>
                    <input type="range" min="0" max="0.5" step="0.01" value={settings.bg_texture_opacity}
                      onChange={e => set('bg_texture_opacity', parseFloat(e.target.value))}
                      className="w-full accent-[#6C5CE7]" />
                  </div>

                  <SectionDivider label="Sections & Text" />

                  <div>
                    <label className={labelClass}>Featured Section Title</label>
                    <input type="text" value={settings.featured_section_title} onChange={e => set('featured_section_title', e.target.value)} className={inputClass} placeholder="Featured Offers" />
                  </div>
                  <div>
                    <label className={labelClass}>Footer Text</label>
                    <input type="text" value={settings.footer_text} onChange={e => set('footer_text', e.target.value)} className={inputClass} placeholder="Secure payments powered by Stripe." />
                  </div>

                  <SectionDivider label="Categories" />

                  <div className="md:col-span-2 space-y-3">
                    {/* Existing categories */}
                    {settings.categories.length === 0
                      ? <p className="text-xs text-[#71717a]">No categories yet. Add one below.</p>
                      : <div className="flex flex-wrap gap-2">
                          {settings.categories.map(c => (
                            <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-full text-sm">
                              <CategoryIcon name={c.icon} size={13} className="text-[#6C5CE7]" />
                              <span className="font-medium text-zinc-700 dark:text-[#e4e4e7]">{c.label}</span>
                              <span className="text-[#71717a] text-xs opacity-60">#{c.id}</span>
                              <button onClick={() => removeCategory(c.id)} className="text-[#71717a] hover:text-red-400 transition-colors ml-0.5"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                    }
                    {/* Add new category */}
                    <div className="flex gap-2 items-start">
                      <div className="w-44 shrink-0">
                        <IconPicker value={newCatIcon} onChange={setNewCatIcon} />
                      </div>
                      <input type="text" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                        className={`${inputClass} flex-1`} placeholder="Category name (e.g. Weapons)" />
                      <Button variant="purple" icon={Plus} onClick={addCategory} className="shrink-0">Add</Button>
                    </div>
                  </div>

                  {/* Live preview */}
                  <SectionDivider label="Live Preview" />
                  <div className="md:col-span-2 rounded-xl overflow-hidden border border-zinc-200 dark:border-[#2a2a3c]">
                    <div style={{ background: settings.banner_url ? `${settings.banner_overlay}, url(${settings.banner_url.startsWith('/') ? API_URL + settings.banner_url : settings.banner_url}) center/cover` : `linear-gradient(135deg, ${settings.primary_color}, ${settings.accent_color})`, minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-white font-black text-lg tracking-widest uppercase">{settings.shop_title || selectedGame.name}</span>
                    </div>
                    <div className="p-3 flex gap-3" style={settings.background_color ? { backgroundColor: settings.background_color } : undefined}>
                      <div className="w-16 h-16 rounded shrink-0" style={{ backgroundColor: settings.surface_color || '#e5e7eb', borderRadius: settings.card_style === 'rounded' ? 8 : 2, border: `1px solid ${settings.border_color || '#d1d5db'}`, boxShadow: settings.card_shadow === 'glow' ? `0 0 12px ${settings.primary_color}55` : settings.card_shadow === 'md' ? '0 4px 12px rgba(0,0,0,0.2)' : settings.card_shadow === 'none' ? 'none' : '0 1px 4px rgba(0,0,0,0.1)' }} />
                      <div className="flex-1">
                        <div className="h-2.5 rounded mb-1.5 w-3/4" style={{ backgroundColor: settings.text_color ? `${settings.text_color}80` : '#d1d5db' }} />
                        <div className="h-2 rounded mb-3 w-1/2" style={{ backgroundColor: settings.text_muted_color ? `${settings.text_muted_color}60` : '#e5e7eb' }} />
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black" style={{ color: settings.price_color || settings.primary_color }}>€9.99</span>
                          <span className="px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: settings.primary_color, borderRadius: settings.card_style === 'rounded' ? 6 : 2 }}>Buy</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button variant="purple" loading={loading} icon={Save} onClick={saveSettings}>
                  {loading ? 'Saving...' : 'Save Theme'}
                </Button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                DAILY GIFT TAB
            ══════════════════════════════════════════════════════ */}
            {subTab === 'daily' && (
              <div className="p-5 space-y-5">
                <div className="p-4 bg-zinc-50 dark:bg-[#111118] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] text-sm text-[#71717a]">
                  <p className="font-semibold text-zinc-700 dark:text-[#e4e4e7] mb-1">How it works</p>
                  <p>Each player can claim the gift once per day. The reset happens at midnight UTC (server-side — cannot be bypassed). Once claimed, the item is automatically delivered to the player's account.</p>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-[#111118] rounded-xl border border-zinc-200 dark:border-[#2a2a3c]">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Daily Gift Active</p>
                    <p className="text-xs text-[#71717a]">Show the daily gift banner on the shop page</p>
                  </div>
                  <button onClick={() => setGift(g => ({ ...g, active: !g.active }))}
                    className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${gift.active ? 'bg-[#6C5CE7]' : 'bg-zinc-300 dark:bg-[#2a2a3c]'}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${gift.active ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>Gift Title</label>
                    <input type="text" value={gift.title} onChange={e => setGift(g => ({ ...g, title: e.target.value }))} className={inputClass} placeholder="Daily Gift" />
                  </div>
                  <div>
                    <label className={labelClass}>Description</label>
                    <input type="text" value={gift.description} onChange={e => setGift(g => ({ ...g, description: e.target.value }))} className={inputClass} placeholder="Your free daily reward!" />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Gift Image</label>
                    <div className="flex gap-2">
                      <input type="text" value={gift.image_url} onChange={e => setGift(g => ({ ...g, image_url: e.target.value }))} className={inputClass} placeholder="https://... or upload" />
                      <label className="shrink-0 cursor-pointer px-3 py-2.5 bg-zinc-200 dark:bg-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm hover:bg-zinc-300 dark:hover:bg-[#3a3a4c] transition-all">
                        {uploading ? '...' : 'Upload'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, url => setGift(g => ({ ...g, image_url: url })))} />
                      </label>
                    </div>
                    {gift.image_url && <img src={gift.image_url.startsWith('/') ? `${API_URL}${gift.image_url}` : gift.image_url} alt="gift" className="mt-2 h-20 w-20 object-cover rounded-xl border border-zinc-200 dark:border-[#2a2a3c]" />}
                  </div>
                  <div>
                    <label className={labelClass}>Backend Project</label>
                    <select value={gift.project_slug} onChange={e => setGift(g => ({ ...g, project_slug: e.target.value }))} className={inputClass} required={gift.active}>
                      <option value="">— Select a project —</option>
                      {projects.map(p => <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Variable to send</label>
                    <input type="text" value={gift.variable} onChange={e => setGift(g => ({ ...g, variable: e.target.value }))} className={inputClass} placeholder="gold, daily_chest..." />
                  </div>
                  <div>
                    <label className={labelClass}>Amount</label>
                    <input type="text" value={gift.amount} onChange={e => setGift(g => ({ ...g, amount: e.target.value }))} className={inputClass} placeholder="100, true, legendary..." />
                  </div>
                </div>

                <Button variant="purple" loading={loading} icon={Gift} onClick={saveGift}>
                  {loading ? 'Saving...' : 'Save Daily Gift'}
                </Button>
              </div>
            )}
          </Card>

          {/* Public link */}
          <Card className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest mb-0.5">Public Shop URL</p>
              <code className="text-sm text-[#6C5CE7] font-mono">/shop/{selectedGame.slug}</code>
            </div>
            <a href={`/shop/${selectedGame.slug}`} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-zinc-100 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-700 dark:text-[#e4e4e7] rounded-lg text-sm font-medium hover:border-[#6C5CE7]/40 transition-all">
              Open Shop ↗
            </a>
          </Card>
        </>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#151520] rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-[#2a2a3c]">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a3c] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center"><Upload size={16} className="text-[#6C5CE7]" /></div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-[#e4e4e7] text-sm">Import Theme</h3>
                  <p className="text-xs text-[#71717a]">Paste the theme JSON code below</p>
                </div>
              </div>
              <button onClick={() => { setShowImport(false); setImportJson(''); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-all"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea value={importJson} onChange={e => setImportJson(e.target.value)} rows={12}
                placeholder={'{\n  "primary_color": "#C0392B",\n  "background_color": "#0A0806",\n  ...\n}'}
                className="w-full bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-xl text-xs font-mono px-4 py-3 focus:outline-none focus:border-[#6C5CE7] resize-none transition-all" />
              <div className="flex gap-3">
                <Button variant="purple" icon={Upload} onClick={handleImport} className="flex-1 justify-center">Apply Theme</Button>
                <Button variant="secondary" onClick={() => { setShowImport(false); setImportJson(''); }}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
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
