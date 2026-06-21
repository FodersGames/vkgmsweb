import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { ShoppingBag, Plus, Edit2, Trash2, Save, X, Settings, Package, Eye, EyeOff, Tag } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BADGE_OPTIONS = ['', 'NEW', 'SALE', 'LIMITED', 'HOT', 'POPULAR'];
const CARD_STYLES = ['rounded', 'sharp'];

const defaultForm = {
  name: '',
  description: '',
  price: '',
  image_url: '',
  badge: '',
  discount_pct: '',
  project_slug: '',
  variable: '',
  amount: '',
  active: true,
};

const defaultSettings = {
  shop_title: '',
  primary_color: '#6C5CE7',
  accent_color: '#A29BFE',
  banner_url: '',
  banner_title: '',
  banner_subtitle: '',
  card_style: 'rounded',
};

export const ShopManagement = () => {
  const { token } = useAuth();
  const [games, setGames] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [subTab, setSubTab] = useState('products');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchGames();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedGame) {
      fetchProducts();
      fetchSettings();
    }
  }, [selectedGame]);

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

  const openCreate = () => {
    setEditingProduct(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: (p.price / 100).toFixed(2),
      image_url: p.image_url || '',
      badge: p.badge || '',
      discount_pct: p.discount_pct ?? '',
      project_slug: p.project_slug,
      variable: p.variable,
      amount: p.amount,
      active: p.active,
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
        await axios.put(`${API_URL}/api/shop/${selectedGame.slug}/products/${editingProduct.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Product updated');
      } else {
        await axios.post(`${API_URL}/api/shop/${selectedGame.slug}/products`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Product created');
      }
      setShowForm(false);
      fetchProducts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/shop/${selectedGame.slug}/products/${product.id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Product deleted');
      fetchProducts();
    } catch (e) { toast.error('Failed to delete'); }
  };

  const toggleActive = async (product) => {
    try {
      await axios.put(`${API_URL}/api/shop/${selectedGame.slug}/products/${product.id}`, { active: !product.active }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(product.active ? 'Product hidden' : 'Product visible');
      fetchProducts();
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

  const inputClass = 'w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#6C5CE7] focus:outline-none transition-all';
  const labelClass = 'block text-xs font-semibold text-[#71717a] mb-1.5 uppercase tracking-wider';

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
              {[{ id: 'products', label: 'Products', icon: Package }, { id: 'settings', label: 'Shop Settings', icon: Settings }].map(t => (
                <button key={t.id} onClick={() => setSubTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${subTab === t.id ? 'border-[#6C5CE7] text-[#6C5CE7]' : 'border-transparent text-[#71717a] hover:text-zinc-700 dark:hover:text-[#e4e4e7]'}`}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>

            {/* ── Products tab ── */}
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

                {/* Product form */}
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

                {/* Product list */}
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
                          {p.image_url && (
                            <img src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url} alt={p.name} className="w-14 h-14 object-cover rounded-lg shrink-0 border border-zinc-200 dark:border-[#2a2a3c]" />
                          )}
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
                            <button onClick={() => toggleActive(p)} title={p.active ? 'Hide' : 'Show'} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/30 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all">
                              {p.active ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button onClick={() => openEdit(p)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#6C5CE7]/30 rounded-lg text-[#71717a] hover:text-[#6C5CE7] transition-all">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(p)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400 transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Settings tab ── */}
            {subTab === 'settings' && (
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Shop Title</label>
                    <input type="text" value={settings.shop_title} onChange={e => setSettings({ ...settings, shop_title: e.target.value })} className={inputClass} placeholder={`${selectedGame.name} Shop`} />
                  </div>
                  <div>
                    <label className={labelClass}>Primary Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-zinc-200 dark:border-[#2a2a3c] bg-transparent" />
                      <input type="text" value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} className={inputClass} placeholder="#6C5CE7" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Accent Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={settings.accent_color} onChange={e => setSettings({ ...settings, accent_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-zinc-200 dark:border-[#2a2a3c] bg-transparent" />
                      <input type="text" value={settings.accent_color} onChange={e => setSettings({ ...settings, accent_color: e.target.value })} className={inputClass} placeholder="#A29BFE" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Banner Image URL</label>
                    <div className="flex gap-2">
                      <input type="text" value={settings.banner_url} onChange={e => setSettings({ ...settings, banner_url: e.target.value })} className={inputClass} placeholder="https://... or upload" />
                      <label className="shrink-0 cursor-pointer px-3 py-2.5 bg-slate-200 dark:bg-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-[#3a3a4c] transition-all whitespace-nowrap">
                        {uploadingImage ? '...' : 'Upload'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, url => setSettings(s => ({ ...s, banner_url: url })))} />
                      </label>
                    </div>
                    {settings.banner_url && <img src={settings.banner_url.startsWith('/') ? `${API_URL}${settings.banner_url}` : settings.banner_url} alt="banner" className="mt-2 h-24 w-full object-cover rounded-lg border border-zinc-200 dark:border-[#2a2a3c]" />}
                  </div>
                  <div>
                    <label className={labelClass}>Banner Title</label>
                    <input type="text" value={settings.banner_title} onChange={e => setSettings({ ...settings, banner_title: e.target.value })} className={inputClass} placeholder="Welcome to the shop!" />
                  </div>
                  <div>
                    <label className={labelClass}>Banner Subtitle</label>
                    <input type="text" value={settings.banner_subtitle} onChange={e => setSettings({ ...settings, banner_subtitle: e.target.value })} className={inputClass} placeholder="Buy items and get them in-game instantly." />
                  </div>
                  <div>
                    <label className={labelClass}>Card Style</label>
                    <div className="flex gap-3">
                      {CARD_STYLES.map(s => (
                        <button key={s} type="button" onClick={() => setSettings({ ...settings, card_style: s })}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all capitalize ${settings.card_style === s ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]' : 'bg-slate-100 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a]'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live preview chips */}
                  <div className="md:col-span-2 p-4 bg-slate-100 dark:bg-[#0d0d14] rounded-xl border border-zinc-200 dark:border-[#2a2a3c]">
                    <div className="text-xs font-semibold text-[#71717a] mb-3 uppercase tracking-wider flex items-center gap-1.5"><Tag size={12} />Color preview</div>
                    <div className="flex gap-3 flex-wrap">
                      <span className="px-3 py-1.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: settings.primary_color }}>Primary</span>
                      <span className="px-3 py-1.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: settings.accent_color }}>Accent</span>
                      <span className="px-3 py-1.5 rounded-full text-sm font-semibold border" style={{ color: settings.primary_color, borderColor: settings.primary_color }}>Button</span>
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
    </div>
  );
};
