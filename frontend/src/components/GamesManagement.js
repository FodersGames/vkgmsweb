import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Gamepad2, Plus, Trash2, Edit2, Save, X, Upload, Image as ImageIcon } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATFORMS = [
  { id: 'steam', label: 'Steam' },
  { id: 'google_play', label: 'Google Play' },
  { id: 'apple', label: 'App Store' },
  { id: 'pc', label: 'PC' },
  { id: 'web', label: 'Web' },
  { id: 'android', label: 'Android' },
];

export const GamesManagement = () => {
  const { token, hasPermission } = useAuth();
  const [games, setGames] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', logo_url: '', screenshots: [], platforms: [], status: 'draft', featured: false });

  useEffect(() => { fetchGames(); /* eslint-disable-next-line */ }, []);

  const fetchGames = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/website/games`, { headers: { Authorization: `Bearer ${token}` } });
      setGames(r.data.games);
    } catch (e) { console.error(e); }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${API_URL}/api/upload`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      return r.data.url;
    } catch (e) { toast.error('Upload failed'); return null; }
    finally { setUploading(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setForm(p => ({ ...p, logo_url: url }));
  };

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setForm(p => ({ ...p, screenshots: [...p.screenshots, url] }));
  };

  const togglePlatform = (platformId) => {
    setForm(p => {
      const exists = p.platforms.find(pl => pl.name === platformId);
      if (exists) return { ...p, platforms: p.platforms.filter(pl => pl.name !== platformId) };
      return { ...p, platforms: [...p.platforms, { name: platformId, url: '' }] };
    });
  };

  const setPlatformUrl = (platformId, url) => {
    setForm(p => ({ ...p, platforms: p.platforms.map(pl => pl.name === platformId ? { ...pl, url } : pl) }));
  };

  const resetForm = () => {
    setForm({ name: '', description: '', logo_url: '', screenshots: [], platforms: [], status: 'draft', featured: false });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (game) => {
    setForm({ name: game.name, description: game.description, logo_url: game.logo_url || '', screenshots: game.screenshots || [],
              platforms: game.platforms || [], status: game.status, featured: game.featured || false });
    setEditing(game.slug);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/api/website/games/${editing}`, form, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Game updated');
      } else {
        await axios.post(`${API_URL}/api/website/games`, form, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Game created');
      }
      resetForm();
      fetchGames();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (slug) => {
    if (!window.confirm('Delete this game?')) return;
    try {
      await axios.delete(`${API_URL}/api/website/games/${slug}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Game deleted');
      fetchGames();
    } catch (e) { toast.error('Failed to delete'); }
  };

  return (
    <div className="max-w-5xl">
      <div className="bg-[#151520] rounded-xl border border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a3c] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4ECDC4] to-[#2CB5AC] flex items-center justify-center"><Gamepad2 size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-[#e4e4e7]">Games Management</h3><p className="text-xs text-[#71717a]">Manage games displayed on the website</p></div>
          </div>
          {hasPermission('create_games') && (
            <button onClick={() => { showForm ? resetForm() : setShowForm(true); }} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"
              data-testid="create-game-button">{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Cancel' : 'New Game'}</button>
          )}
        </div>

        {showForm && (
          <div className="p-6 bg-[#1c1c2e] border-b border-[#2a2a3c]">
            <form onSubmit={handleSubmit} data-testid="game-form">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Game Name</label>
                    <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-[#0d0d14] border border-[#2a2a3c] text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none"
                      required data-testid="game-name-input" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                      className="w-full bg-[#0d0d14] border border-[#2a2a3c] text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none"
                      data-testid="game-status-select">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                    className="w-full bg-[#0d0d14] border border-[#2a2a3c] text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none resize-none"
                    required data-testid="game-description-input" />
                </div>

                {/* Logo */}
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Logo</label>
                  <div className="flex items-center gap-3">
                    {form.logo_url && <img src={form.logo_url.startsWith('/') ? `${API_URL}${form.logo_url}` : form.logo_url} alt="logo" className="w-16 h-16 rounded-lg object-cover border border-[#2a2a3c]" />}
                    <label className="cursor-pointer bg-[#0d0d14] border border-[#2a2a3c] hover:border-[#4ECDC4]/50 rounded-lg px-4 py-2.5 text-sm text-[#71717a] flex items-center gap-2">
                      <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Logo'}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Screenshots */}
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Screenshots</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.screenshots.map((s, i) => (
                      <div key={i} className="relative group">
                        <img src={s.startsWith('/') ? `${API_URL}${s}` : s} alt="" className="w-20 h-14 rounded-lg object-cover border border-[#2a2a3c]" />
                        <button type="button" onClick={() => setForm(p => ({ ...p, screenshots: p.screenshots.filter((_, j) => j !== i) }))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} className="text-white" /></button>
                      </div>
                    ))}
                    <label className="cursor-pointer w-20 h-14 bg-[#0d0d14] border border-dashed border-[#2a2a3c] hover:border-[#4ECDC4]/50 rounded-lg flex items-center justify-center">
                      <ImageIcon size={16} className="text-[#71717a]" />
                      <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Platforms */}
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Platforms</label>
                  <div className="space-y-2">
                    {PLATFORMS.map(p => {
                      const active = form.platforms.find(pl => pl.name === p.id);
                      return (
                        <div key={p.id} className="flex items-center gap-3">
                          <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all text-sm ${active ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'border-[#2a2a3c] text-[#71717a]'}`}>
                            <input type="checkbox" checked={!!active} onChange={() => togglePlatform(p.id)} className="w-3.5 h-3.5 rounded" />
                            {p.label}
                          </label>
                          {active && (
                            <input type="url" value={active.url} onChange={e => setPlatformUrl(p.id, e.target.value)} placeholder={`${p.label} URL`}
                              className="flex-1 bg-[#0d0d14] border border-[#2a2a3c] text-[#e4e4e7] rounded-lg text-sm px-3 py-2 focus:border-[#4ECDC4] focus:outline-none" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Featured */}
                <label className="flex items-center gap-3 px-4 py-3 bg-[#0d0d14] border border-[#2a2a3c] rounded-lg cursor-pointer hover:border-[#4ECDC4]/30 transition-all" data-testid="featured-toggle">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} className="w-4 h-4 rounded" />
                  <div>
                    <span className="text-sm text-[#e4e4e7] font-medium">Featured Game</span>
                    <p className="text-xs text-[#71717a]">Display this game on the homepage</p>
                  </div>
                </label>

                <button type="submit" disabled={loading} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                  data-testid="submit-game-button">{editing ? <Save size={14} /> : <Plus size={14} />}{loading ? 'Saving...' : editing ? 'Save Changes' : 'Create Game'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#71717a] mb-4 uppercase tracking-wider">Games ({games.length})</div>
          {games.length === 0 ? (
            <div className="text-center py-12 text-[#71717a]">No games yet.</div>
          ) : (
            <div className="space-y-3" data-testid="games-list">
              {games.map(g => (
                <div key={g.slug} className="bg-[#1c1c2e] border border-[#2a2a3c] rounded-xl p-4 hover:border-[#4ECDC4]/20 transition-all">
                  <div className="flex items-center gap-4">
                    {g.logo_url ? <img src={g.logo_url.startsWith('/') ? `${API_URL}${g.logo_url}` : g.logo_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-[#2a2a3c]" /> :
                      <div className="w-14 h-14 rounded-lg bg-[#0d0d14] border border-[#2a2a3c] flex items-center justify-center"><Gamepad2 size={20} className="text-[#71717a]" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[#e4e4e7]">{g.name}</h4>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${g.status === 'published' ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#71717a]/15 text-[#71717a]'}`}>{g.status}</span>
                        {g.featured && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase bg-[#F2994A]/15 text-[#F2994A]">Featured</span>}
                      </div>
                      <p className="text-xs text-[#71717a] truncate">{g.description}</p>
                      {g.platforms?.length > 0 && <div className="flex gap-1 mt-1">{g.platforms.map((p, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#0d0d14] border border-[#2a2a3c] rounded text-[#71717a]">{p.name}</span>)}</div>}
                    </div>
                    <div className="flex gap-2">
                      {hasPermission('edit_games') && <button onClick={() => startEdit(g)} className="p-2 border border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg text-[#71717a] hover:text-[#4ECDC4] transition-all" data-testid={`edit-game-${g.slug}`}><Edit2 size={14} /></button>}
                      {hasPermission('delete_games') && <button onClick={() => handleDelete(g.slug)} className="p-2 border border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400 transition-all" data-testid={`delete-game-${g.slug}`}><Trash2 size={14} /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
