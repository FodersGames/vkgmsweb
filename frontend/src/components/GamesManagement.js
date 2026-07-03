import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Gamepad2, Plus, Trash2, Edit2, Save, X, Upload, Image as ImageIcon } from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Badge, Input, Textarea, Select } from '../ui';

const PLATFORMS = [
  { id: 'steam', label: 'Steam' },
  { id: 'google_play', label: 'Google Play' },
  { id: 'apple', label: 'App Store' },
  { id: 'pc', label: 'PC' },
  { id: 'web', label: 'Web' },
  { id: 'android', label: 'Android' },
];

const statusVariant = { published: 'success', coming_soon: 'purple', draft: 'default' };
const statusLabel = { published: 'Published', coming_soon: 'Coming Soon', draft: 'Draft' };

export const GamesManagement = () => {
  const { token, hasPermission } = useAuth();
  const [games, setGames] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', logo_url: '', screenshots: [], platforms: [], status: 'draft', featured: false, price_cents: 0 });
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  useEffect(() => { fetchGames(); /* eslint-disable-next-line */ }, []);

  const fetchGames = async () => {
    try { const r = await api.get(`/api/website/games`); setGames(r.data.games); } catch (e) {}
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api.post(`/api/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return r.data.url;
    } catch (e) { toast.error('Upload failed'); return null; }
    finally { setUploading(false); }
  };

  const handleLogoUpload = async (e) => { const url = await uploadFile(e.target.files[0]); if (url) setForm(p => ({ ...p, logo_url: url })); };
  const handleScreenshotUpload = async (e) => { const url = await uploadFile(e.target.files[0]); if (url) setForm(p => ({ ...p, screenshots: [...p.screenshots, url] })); };

  const togglePlatform = (platformId) => {
    setForm(p => {
      const exists = p.platforms.find(pl => pl.name === platformId);
      if (exists) return { ...p, platforms: p.platforms.filter(pl => pl.name !== platformId) };
      return { ...p, platforms: [...p.platforms, { name: platformId, url: '' }] };
    });
  };

  const setPlatformUrl = (platformId, url) => setForm(p => ({ ...p, platforms: p.platforms.map(pl => pl.name === platformId ? { ...pl, url } : pl) }));

  const resetForm = () => { setForm({ name: '', description: '', logo_url: '', screenshots: [], platforms: [], status: 'draft', featured: false, price_cents: 0 }); setEditing(null); setShowForm(false); };

  const startEdit = (game) => {
    setForm({ name: game.name, description: game.description, logo_url: game.logo_url || '', screenshots: game.screenshots || [], platforms: game.platforms || [], status: game.status, featured: game.featured || false, price_cents: game.price_cents || 0 });
    setEditing(game.slug); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editing) { await api.put(`/api/website/games/${editing}`, form); toast.success('Game updated'); }
      else { await api.post(`/api/website/games`, form); toast.success('Game created'); }
      resetForm(); fetchGames();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = (slug, name) => {
    showConfirm({
      title: 'Delete game',
      description: `"${name}" will be permanently removed from the website.`,
      onConfirm: async () => { await api.delete(`/api/website/games/${slug}`); toast.success('Game deleted'); fetchGames(); },
    });
  };

  return (
    <>
    <div className="max-w-5xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4ECDC418' }}>
              <Gamepad2 size={16} style={{ color: '#4ECDC4' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Games Management</h3>
              <p className="text-xs text-gray-500">Manage games displayed on the website</p>
            </div>
          </div>
          {hasPermission('create_games') && (
            <Button icon={showForm ? X : Plus} onClick={() => showForm ? resetForm() : setShowForm(true)} data-testid="create-game-button">
              {showForm ? 'Cancel' : 'New Game'}
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <div className="px-6 py-5 bg-gray-50 border-b border-gray-200">
            <form onSubmit={handleSubmit} data-testid="game-form">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input label="Game Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required data-testid="game-name-input" />
                  <Select label="Status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} data-testid="game-status-select">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="coming_soon">Coming Soon</option>
                  </Select>
                </div>

                <Textarea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} required data-testid="game-description-input" />

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Logo</p>
                  <div className="flex items-center gap-3">
                    {form.logo_url && <img src={form.logo_url.startsWith('/') ? `${API_URL}${form.logo_url}` : form.logo_url} alt="logo" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />}
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" icon={Upload} loading={uploading} as="span">Upload Logo</Button>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Screenshots</p>
                  <div className="flex flex-wrap gap-2">
                    {form.screenshots.map((s, i) => (
                      <div key={i} className="relative group">
                        <img src={s.startsWith('/') ? `${API_URL}${s}` : s} alt="" className="w-20 h-14 rounded-lg object-cover border border-gray-200" />
                        <button type="button" onClick={() => setForm(p => ({ ...p, screenshots: p.screenshots.filter((_, j) => j !== i) }))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="cursor-pointer w-20 h-14 bg-gray-100 border border-dashed border-gray-200 hover:border-brand-400/50 rounded-lg flex items-center justify-center transition-colors">
                      <ImageIcon size={16} className="text-gray-500" />
                      <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Platforms</p>
                  <div className="space-y-2">
                    {PLATFORMS.map(p => {
                      const active = form.platforms.find(pl => pl.name === p.id);
                      return (
                        <div key={p.id} className="flex items-center gap-3">
                          <label className={`flex items-center gap-2 px-3 h-9 border rounded-lg cursor-pointer transition-colors text-sm shrink-0 ${active ? 'border-brand-400 bg-brand-50 text-brand-400' : 'border-gray-200 text-gray-500'}`}>
                            <input type="checkbox" checked={!!active} onChange={() => togglePlatform(p.id)} className="w-3.5 h-3.5 rounded" />
                            {p.label}
                          </label>
                          {active && (
                            <Input type="url" value={active.url} onChange={e => setPlatformUrl(p.id, e.target.value)} placeholder={`${p.label} URL`} wrapperClassName="flex-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Game Price</p>
                  <div className="relative max-w-[180px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price_cents === 0 ? '' : (form.price_cents / 100).toFixed(2)}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setForm(p => ({ ...p, price_cents: isNaN(val) ? 0 : Math.round(val * 100) }));
                      }}
                      placeholder="0.00 (free)"
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-brand-400"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Leave empty or 0 for a free game. Price used for Stripe checkout.</p>
                </div>

                <label className="flex items-center gap-3 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg cursor-pointer hover:border-brand-400/30 transition-colors" data-testid="featured-toggle">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} className="w-4 h-4 rounded accent-brand-400" />
                  <div>
                    <span className="text-sm text-gray-900 font-medium">Featured Game</span>
                    <p className="text-xs text-gray-500">Display this game on the homepage</p>
                  </div>
                </label>

                <Button type="submit" loading={loading} icon={editing ? Save : Plus} data-testid="submit-game-button">
                  {loading ? 'Saving…' : editing ? 'Save Changes' : 'Create Game'}
                </Button>
              </div>
            </form>
          </div>
        )}

        <CardBody>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Games ({games.length})
          </p>
          {games.length === 0 ? (
            <EmptyState icon={Gamepad2} title="No games yet" description="Add your first game to display it on the website." />
          ) : (
            <div className="space-y-2" data-testid="games-list">
              {games.map(g => (
                <div key={g.slug} className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-brand-400/20 transition-colors">
                  {g.logo_url
                    ? <img src={g.logo_url.startsWith('/') ? `${API_URL}${g.logo_url}` : g.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />
                    : <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0"><Gamepad2 size={18} className="text-gray-500" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-900">{g.name}</h4>
                      <Badge variant={statusVariant[g.status] || 'default'}>{statusLabel[g.status] || g.status}</Badge>
                      {g.featured && <Badge variant="orange">Featured</Badge>}
                      {g.price_cents > 0 && <Badge variant="default">${(g.price_cents / 100).toFixed(2)}</Badge>}
                      {(g.price_cents === 0 || !g.price_cents) && <Badge variant="success">Free</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{g.description}</p>
                    {g.platforms?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {g.platforms.map((p, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-500">{p.name}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {hasPermission('edit_games') && <Button variant="secondary" size="sm" icon={Edit2} onClick={() => startEdit(g)} data-testid={`edit-game-${g.slug}`} />}
                    {hasPermission('delete_games') && <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(g.slug, g.name)} data-testid={`delete-game-${g.slug}`} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
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
