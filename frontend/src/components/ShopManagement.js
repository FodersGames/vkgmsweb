import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  ShoppingBag, Plus, Edit2, Trash2, Save, X, Settings, Package,
  Eye, EyeOff, Tag, Link2, Upload, Download, Palette,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BADGE_OPTIONS = ['', 'NEW', 'SALE', 'LIMITED', 'HOT', 'POPULAR'];

const defaultForm = {
  name: '', description: '', price: '', image_url: '',
  badge: '', discount_pct: '', project_slug: '', variable: '', amount: '', active: true,
};

const defaultSettings = {
  shop_title:        '',
  banner_url:        '',
  banner_title:      '',
  banner_subtitle:   '',
  banner_height:     'md',
  banner_overlay:    'rgba(0,0,0,0.55)',
  primary_color:     '#6C5CE7',
  accent_color:      '#A29BFE',
  background_color:  '',
  surface_color:     '',
  border_color:      '',
  text_color:        '',
  text_muted_color:  '',
  price_color:       '',
  bg_texture_url:    '',
  bg_texture_opacity: 0.05,
  card_style:        'rounded',
  card_shadow:       'sm',
};

// Champs exportables (on exclut les meta côté serveur)
const EXPORT_KEYS = Object.keys(defaultSettings);

// ─── ColorRow ─────────────────────────────────────────────────────────────────
const ColorRow = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs font-semibold text-[#71717a] mb-1.5 uppercase tracking-wider">{label}</label>
    <div className="flex gap-2 items-center">
      <input
        type="color"
        value={value || '#000000'}
        onChange={e => onChange(e.target.value)}
        className="w-10 h-10 rounded cursor-pointer border border-zinc-200 dark:border-[#2a2a3c] bg-transparent shrink-0"
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#6C5CE7] focus:outline-none transition-all"
      />
    </div>
  </div>
);

export const ShopManagement = () => {
  const { token } = useAuth();
  const [games, setGames]             = useState([]);
  const [projects, setProjects]       = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [products, setProducts]       = useState([]);
  const [settings, setSettings]       = useState(defaultSettings);
  const [subTab, setSubTab]           = useState('products');
  const [showForm, setShowForm]       = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm]               = useState(defaultForm);
  const [loading, setLoading]         = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Import theme modal
  const [showImport, setShowImport]   = useState(false);
  const [importJson, setImportJson]   = useState('');

  useEffect(() => { fetchGames(); fetchProjects(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (selectedGame) { fetchProducts(); fetchSettings(); } /* eslint-disable-next-line */ }, [selectedGame]);

  const fetchGames = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/website/games`, { headers: { Authorization: `Bearer ${token}` } });
      setGames(r.data.games || []);
      if (r.data.games?.length > 0 && !selectedGame) setSelectedGame(r.data.games[0]);
    } catch (e) {}
  };

  const fetchProjects = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
      setProjects(r.data.projects || []);
    } catch (e) {}
  };

  const fetchProducts = async () => {
    if (!selectedGame) return;
    try {
      const r = await axios.get(`${API_URL}/api/shop/${selectedGame.slug}/products/admin`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(r.data.products || []);
    } catch (e) {}
  };

  const fetchSettings = async () => {
    if (!selectedGame) return;
    try {
      const r = await axios.get(`${API_URL}/api/shop/${selectedGame.slug}/settings`, { headers: { Authorization: `Bearer ${token}` } });
      setSettings({ ...defaultSettings, ...r.data });
    } catch (e) {}
  };

  const handleImageUpload = async (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await axios.post(`${API_URL}/api/upload`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setter(r.data.url);
      toast.success('Image uploaded');
    } catch (e) { toast.error('Upload failed'); }
    finally { setUploadingImage(false); }
  };

  const openCreate = () => { setEditingProduct(null); setForm(defaultForm); setShowForm(true); };
  const openEdit   = (p) => {
    setEditingProduct(p);
    setForm({ name: p.name, description: p.description || '', price: (p.price / 100).toFixed(2),
              image_url: p.image_url || '', badge: p.badge || '', discount_pct: p.discount_pct ?? '',
              project_slug: p.project_slug, variable: p.variable, amount: p.amount, active: p.active });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, price: Math.round(parseFloat(form.price) * 100),
                      discount_pct: form.discount_pct !== '' ? parseInt(form.discount_pct) : null,
                      badge: form.badge || null };
    try {
      if (editingProduct) {
        await axios.put(`${API_URL}/api/shop/${selectedGame.slug}/products/${editingProduct.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Product updated');
      } else {
        await axios.post(`${API_URL}/api/shop/${selectedGame.slug}/products`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Product created');
      }
      setShowForm(false); fetchProducts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/shop/${selectedGame.slug}/products/${product.id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Product deleted'); fetchProducts();
    } catch (e) { toast.error('Failed to delete'); }
  };

  const toggleActive = async (product) => {
    try {
      await axios.put(`${API_URL}/api/shop/${selectedGame.slug}/products/${product.id}`, { active: !product.active }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(product.active ? 'Product hidden' : 'Product visible'); fetchProducts();
    } catch (e) { toast.error('Failed'); }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/shop/${selectedGame.slug}/settings`, settings, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Settings saved');
    } catch (e) { toast.error('Failed to save settings'); }
    finally { setLoading(false); }
  };

  // ── Import / Export ────────────────────────────────────────────────────────
  const handleExportTheme = () => {
    const exportable = Object.fromEntries(EXPORT_KEYS.map(k => [k, settings[k] ?? defaultSettings[k]]));
    navigator.clipboard.writeText(JSON.stringify(exportable, null, 2))
      .then(() => toast.success('Theme code copied to clipboard!'));
  };

  const handleImportTheme = () => {
    try {
      const parsed = JSON.parse(importJson);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      const filtered = Object.fromEntries(EXPORT_KEYS.filter(k => k in parsed).map(k => [k, parsed[k]]));
      setSettings(s => ({ ...s, ...filtered }));
      setShowImport(false);
      setImportJson('');
      toast.success('Theme imported — click Save Settings to apply.');
    } catch {
      toast.error('JSON invalide — vérifie le format.');
    }
  };

  const setSetting = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const inputClass = 'w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#6C5CE7] focus:outline-none transition-all';
  const labelClass = 'block text-xs font-semibold text-[#71717a] mb-1.5 uppercase tracking-wider';
  const sectionTitle = (label) => (
    <div className="col-span-full flex items-center gap-2 pt-2">
      <div className="h-px flex-1 bg-zinc-200 dark:bg-[#2a2a3c]" />
      <span className="text-[10px] font-bold tracking-widest text-[#71717a] uppercase">{label}</span>
      <div className="h-px flex-1 bg-zinc-200 dark:bg-[#2a2a3c]" />
    </div>
  );

  return (
    <div className="max-w-5xl space-y-4">
      {/* Game selector */}
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-[#71717a] uppercase tracking-wider shrink-0">Game Shop :</label>
          <div className="flex flex-wrap gap-2">
            {games.map(g => (
              <button key={g.slug} onClick={() => setSelectedGame(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedGame?.slug === g.slug ? 'bg-[#6C5CE7] text-white' : 'bg-slate-100 dark:bg-[#1c1c2e] text-zinc-600 dark:text-[#71717a] hover:bg-slate-200 dark:hover:bg-[#2a2a3c]'}`}>
                {g.name}
              </button>
            ))}
            {games.length === 0 && <span className="text-sm text-[#71717a]">No games found — create a game first.</span>}
          </div>
        </div>
      </div>

      {selectedGame && (
        <>
          {/* Sub-tabs */}
          <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
            <div className="flex border-b border-zinc-200 dark:border-[#2a2a3c]">
              {[{ id: 'products', label: 'Products', icon: Package }, { id: 'settings', label: 'Shop Theme', icon: Palette }].map(t => (
                <button key={t.id} onClick={() => setSubTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${subTab === t.id ? 'border-[#6C5CE7] text-[#6C5CE7]' : 'border-transparent text-[#71717a] hover:text-zinc-700 dark:hover:text-[#e4e4e7]'}`}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>

            {/* ══ Products tab ══ */}
            {subTab === 'products' && (
              <div>
                <div className="px-5 py-3.5 flex justify-between items-center border-b border-zinc-200 dark:border-[#2a2a3c]">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={16} className="text-[#6C5CE7]" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">{selectedGame.name} — {products.length} product(s)</span>
                  </div>
                  <button onClick={openCreate} className="bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all">
                    <Plus size={14} />Add Product
                  </button>
                </div>

                {showForm && (
                  <div className="p-5 bg-slate-50 dark:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c]">
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
                            <label className="shrink-0 cursor-pointer px-3 py-2.5 bg-slate-200 dark:bg-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-[#3a3a4c] transition-all whitespace-nowrap">
                              {uploadingImage ? '...' : 'Upload'}
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, url => setForm(f => ({ ...f, image_url: url })))} />
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
                          <label className={labelClass}>Backend Project</label>
                          <select value={form.project_slug} onChange={e => setForm({ ...form, project_slug: e.target.value })} className={inputClass} required>
                            <option value="">— Select a project —</option>
                            {projects.map(p => <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Variable to send</label>
                          <input type="text" value={form.variable} onChange={e => setForm({ ...form, variable: e.target.value })} className={inputClass} required placeholder="gold, skin_dragon, dlc_pack1..." />
                        </div>
                        <div>
                          <label className={labelClass}>Amount</label>
                          <input type="text" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputClass} required placeholder="100, legendary, true..." />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className={`${labelClass} mb-0`}>Active (visible in shop)</label>
                          <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                            className={`w-10 h-5.5 rounded-full transition-all relative ${form.active ? 'bg-[#6C5CE7]' : 'bg-zinc-300 dark:bg-[#2a2a3c]'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : ''}`} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={loading} className="bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                          <Save size={14} />{loading ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 dark:bg-[#0d0d14] text-zinc-600 dark:text-[#71717a] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2">
                          <X size={14} />Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="p-5">
                  {products.length === 0 ? (
                    <div className="text-center py-12 text-[#71717a]">
                      <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No products yet for {selectedGame.name}.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {products.map(p => (
                        <div key={p.id} className={`bg-slate-50 dark:bg-[#1c1c2e] border rounded-xl p-4 flex items-center gap-4 transition-all ${p.active ? 'border-zinc-200 dark:border-[#2a2a3c]' : 'border-zinc-200/50 dark:border-[#2a2a3c]/50 opacity-60'}`}>
                          {p.image_url && <img src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url} alt={p.name} className="w-14 h-14 object-cover rounded-lg shrink-0 border border-zinc-200 dark:border-[#2a2a3c]" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-zinc-900 dark:text-[#e4e4e7]">{p.name}</span>
                              {p.badge && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#6C5CE7]/20 text-[#A29BFE] uppercase">{p.badge}</span>}
                              {!p.active && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-zinc-200 dark:bg-[#2a2a3c] text-[#71717a]">HIDDEN</span>}
                            </div>
                            <div className="text-xs text-[#71717a] mt-0.5">{p.description}</div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-sm font-bold text-[#6C5CE7]">€{(p.price / 100).toFixed(2)}</span>
                              <span className="text-xs text-[#71717a]">→ {p.amount}x {p.variable}</span>
                              <span className="text-xs text-[#71717a]">project: {p.project_slug}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => { const url = `${window.location.origin}/shop/${selectedGame.slug}?product=${p.id}`; navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')); }}
                              title="Copy product link" className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/30 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all"><Link2 size={14} /></button>
                            <button onClick={() => toggleActive(p)} title={p.active ? 'Hide' : 'Show'}
                              className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/30 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all">{p.active ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                            <button onClick={() => openEdit(p)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/30 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(p)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ Theme / Settings tab ══ */}
            {subTab === 'settings' && (
              <div className="p-5 space-y-6">

                {/* Import / Export bar */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#1c1c2e] rounded-xl border border-zinc-200 dark:border-[#2a2a3c]">
                  <Settings size={14} className="text-[#71717a] shrink-0" />
                  <span className="text-xs text-[#71717a] flex-1">Importe un code de thème ou exporte le thème actuel.</span>
                  <button onClick={() => setShowImport(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg text-xs font-semibold transition-all">
                    <Upload size={12} />Import
                  </button>
                  <button onClick={handleExportTheme}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-[#2a2a3c] hover:bg-slate-300 dark:hover:bg-[#3a3a4c] text-zinc-700 dark:text-[#e4e4e7] rounded-lg text-xs font-semibold transition-all">
                    <Download size={12} />Export
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* ── BANNER ── */}
                  {sectionTitle('Bannière')}

                  <div className="md:col-span-2">
                    <label className={labelClass}>Titre du shop</label>
                    <input type="text" value={settings.shop_title} onChange={e => setSetting('shop_title', e.target.value)} className={inputClass} placeholder={`${selectedGame.name} Shop`} />
                  </div>
                  <div>
                    <label className={labelClass}>Sous-titre</label>
                    <input type="text" value={settings.banner_subtitle} onChange={e => setSetting('banner_subtitle', e.target.value)} className={inputClass} placeholder="Achète et reçois tes items en jeu instantanément." />
                  </div>
                  <div>
                    <label className={labelClass}>Hauteur de bannière</label>
                    <div className="flex gap-2">
                      {[['sm','Petite'],['md','Moyenne'],['lg','Grande']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => setSetting('banner_height', v)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-all ${settings.banner_height === v ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]' : 'bg-slate-100 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a]'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Image de bannière</label>
                    <div className="flex gap-2">
                      <input type="text" value={settings.banner_url} onChange={e => setSetting('banner_url', e.target.value)} className={inputClass} placeholder="https://... ou upload" />
                      <label className="shrink-0 cursor-pointer px-3 py-2.5 bg-slate-200 dark:bg-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-[#3a3a4c] transition-all whitespace-nowrap">
                        {uploadingImage ? '...' : 'Upload'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, url => setSetting('banner_url', url))} />
                      </label>
                    </div>
                    {settings.banner_url && <img src={settings.banner_url.startsWith('/') ? `${API_URL}${settings.banner_url}` : settings.banner_url} alt="banner" className="mt-2 h-20 w-full object-cover rounded-lg border border-zinc-200 dark:border-[#2a2a3c]" />}
                  </div>
                  <div>
                    <label className={labelClass}>Overlay bannière (rgba)</label>
                    <input type="text" value={settings.banner_overlay} onChange={e => setSetting('banner_overlay', e.target.value)} className={inputClass} placeholder="rgba(0,0,0,0.55)" />
                    <p className="text-[10px] text-[#71717a] mt-1">Assombrit ou colore le fond de la bannière.</p>
                  </div>

                  {/* ── COULEURS PRINCIPALES ── */}
                  {sectionTitle('Couleurs principales')}

                  <ColorRow label="Couleur primaire (boutons)" value={settings.primary_color} onChange={v => setSetting('primary_color', v)} placeholder="#6C5CE7" />
                  <ColorRow label="Couleur accent" value={settings.accent_color} onChange={v => setSetting('accent_color', v)} placeholder="#A29BFE" />
                  <ColorRow label="Couleur des prix (vide = primaire)" value={settings.price_color} onChange={v => setSetting('price_color', v)} placeholder="#6C5CE7" />

                  {/* ── FOND & CARTES ── */}
                  {sectionTitle('Fond & Cartes')}

                  <ColorRow label="Fond de page (vide = défaut)" value={settings.background_color} onChange={v => setSetting('background_color', v)} placeholder="#f4f4f8" />
                  <ColorRow label="Fond des cartes (vide = défaut)" value={settings.surface_color} onChange={v => setSetting('surface_color', v)} placeholder="#ffffff" />
                  <ColorRow label="Bordure des cartes (vide = défaut)" value={settings.border_color} onChange={v => setSetting('border_color', v)} placeholder="#e4e4e7" />

                  <div>
                    <label className={labelClass}>Ombre des cartes</label>
                    <div className="flex gap-2 flex-wrap">
                      {[['none','Aucune'],['sm','Légère'],['md','Moyenne'],['glow','Glow']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => setSetting('card_shadow', v)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${settings.card_shadow === v ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]' : 'bg-slate-100 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a]'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Style des cartes</label>
                    <div className="flex gap-2">
                      {[['rounded','Arrondi'],['sharp','Carré']].map(([v,l]) => (
                        <button key={v} type="button" onClick={() => setSetting('card_style', v)}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-all ${settings.card_style === v ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]' : 'bg-slate-100 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a]'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── TEXTE ── */}
                  {sectionTitle('Texte')}

                  <ColorRow label="Couleur du texte principal (vide = défaut)" value={settings.text_color} onChange={v => setSetting('text_color', v)} placeholder="#18181b" />
                  <ColorRow label="Couleur du texte secondaire (vide = défaut)" value={settings.text_muted_color} onChange={v => setSetting('text_muted_color', v)} placeholder="#71717a" />

                  {/* ── TEXTURE DE FOND ── */}
                  {sectionTitle('Texture de fond (optionnel)')}

                  <div className="md:col-span-2">
                    <label className={labelClass}>URL de la texture (image répétée)</label>
                    <input type="text" value={settings.bg_texture_url} onChange={e => setSetting('bg_texture_url', e.target.value)} className={inputClass} placeholder="https://... (PNG transparent recommandé)" />
                  </div>
                  <div>
                    <label className={labelClass}>Opacité de la texture ({Math.round((settings.bg_texture_opacity || 0) * 100)}%)</label>
                    <input type="range" min="0" max="0.5" step="0.01" value={settings.bg_texture_opacity}
                      onChange={e => setSetting('bg_texture_opacity', parseFloat(e.target.value))}
                      className="w-full accent-[#6C5CE7]" />
                  </div>

                  {/* ── PREVIEW ── */}
                  {sectionTitle('Aperçu rapide')}
                  <div className="md:col-span-2 rounded-xl overflow-hidden border border-zinc-200 dark:border-[#2a2a3c]">
                    {/* Mini bannière */}
                    <div style={{
                      background: settings.banner_url
                        ? `${settings.banner_overlay}, url(${settings.banner_url.startsWith('/') ? API_URL + settings.banner_url : settings.banner_url}) center/cover`
                        : `linear-gradient(135deg, ${settings.primary_color}, ${settings.accent_color})`,
                      minHeight: 80,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="text-white font-black text-lg tracking-widest uppercase">{settings.shop_title || selectedGame.name}</span>
                    </div>
                    {/* Mini card */}
                    <div style={{ backgroundColor: settings.background_color || undefined }} className={!settings.background_color ? 'bg-zinc-100 dark:bg-[#0d0d14]' : ''}>
                      <div className="p-4 flex gap-3">
                        <div className="w-16 h-16 rounded shrink-0" style={{
                          backgroundColor: settings.surface_color || '#e5e7eb',
                          borderRadius: settings.card_style === 'rounded' ? 8 : 2,
                          border: `1px solid ${settings.border_color || '#d1d5db'}`,
                          boxShadow: settings.card_shadow === 'glow' ? `0 0 12px ${settings.primary_color}50` :
                                     settings.card_shadow === 'md' ? '0 4px 12px rgba(0,0,0,0.2)' :
                                     settings.card_shadow === 'none' ? 'none' : '0 1px 4px rgba(0,0,0,0.1)',
                        }} />
                        <div className="flex-1">
                          <div className="h-2.5 rounded mb-1.5 w-3/4" style={{ backgroundColor: settings.text_color ? `${settings.text_color}80` : '#d1d5db' }} />
                          <div className="h-2 rounded mb-3 w-1/2" style={{ backgroundColor: settings.text_muted_color ? `${settings.text_muted_color}60` : '#e5e7eb' }} />
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black" style={{ color: settings.price_color || settings.primary_color }}>€9.99</span>
                            <span className="px-3 py-1 text-xs font-bold text-white rounded" style={{
                              backgroundColor: settings.primary_color,
                              borderRadius: settings.card_style === 'rounded' ? 6 : 2,
                            }}>Buy</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <button onClick={saveSettings} disabled={loading} className="bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition-all">
                  <Save size={14} />{loading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}
          </div>

          {/* Public link */}
          <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-0.5">Public shop link</p>
              <code className="text-sm text-[#6C5CE7] font-mono">/shop/{selectedGame.slug}</code>
            </div>
            <a href={`/shop/${selectedGame.slug}`} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-slate-100 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-700 dark:text-[#e4e4e7] rounded-lg text-sm font-medium hover:border-[#6C5CE7]/40 transition-all">
              Open Shop ↗
            </a>
          </div>
        </>
      )}

      {/* ══ Import Theme Modal ══ */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#151520] rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-[#2a2a3c]">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a3c] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center"><Upload size={16} className="text-[#6C5CE7]" /></div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-[#e4e4e7] text-sm">Importer un thème</h3>
                  <p className="text-xs text-[#71717a]">Colle le code JSON du thème ci-dessous</p>
                </div>
              </div>
              <button onClick={() => { setShowImport(false); setImportJson(''); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1c1c2e] transition-all"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
                rows={12}
                placeholder={'{\n  "primary_color": "#C0392B",\n  "background_color": "#0A0806",\n  ...\n}'}
                className="w-full bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-xl text-xs font-mono px-4 py-3 focus:outline-none focus:border-[#6C5CE7] resize-none transition-all"
              />
              <div className="flex gap-3">
                <button onClick={handleImportTheme} className="flex-1 bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white rounded-lg py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Upload size={14} />Appliquer le thème
                </button>
                <button onClick={() => { setShowImport(false); setImportJson(''); }} className="px-5 py-2.5 bg-slate-100 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm font-semibold">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
