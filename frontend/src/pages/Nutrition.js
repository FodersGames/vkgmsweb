import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { PublicButton } from '../ui/PublicButton';
import {
  Coffee, Sun, MoonStars, Cookie, CaretLeft, CaretRight, Plus, Trash, X,
  MagnifyingGlass, Camera, ChartBar, CalendarBlank, Target, ForkKnife, Warning,
  Calculator, Star, BookmarkSimple,
} from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

const API = process.env.REACT_APP_BACKEND_URL || '';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: '#F2994A' },
  { id: 'lunch', label: 'Lunch', icon: Sun, color: '#4ECDC4' },
  { id: 'dinner', label: 'Dinner', icon: MoonStars, color: '#6C5CE7' },
  { id: 'snack', label: 'Snacks', icon: Cookie, color: '#EB5757' },
];

const MACRO_COLORS = { protein: '#2F80ED', carbs: '#F2994A', fat: '#9B59B6' };

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());
const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toDateStr(dt);
};
const formatDateLabel = (dateStr) => {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

function CalorieRing({ consumed, goal }) {
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const r = 54, c = 2 * Math.PI * r;
  const over = goal > 0 && consumed > goal;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EDEDEF" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={over ? '#EB5757' : '#4ECDC4'}
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - pct * c}
          style={{ transition: 'stroke-dashoffset 0.7s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-medium text-[#1D1D1F] tabular-nums leading-none">{Math.round(consumed)}</span>
        <span className="text-[10px] text-[#A1A1A6] mt-1">/ {Math.round(goal)} kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, goal, color }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[#3A3A3C]">{label}</span>
        <span className="text-xs text-[#A1A1A6] tabular-nums">{Math.round(value)}g / {Math.round(goal)}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#EDEDEF] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, transition: 'width 0.7s ease' }} />
      </div>
    </div>
  );
}

function ErrorBanner({ children }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs">
      <Warning size={12} className="shrink-0" />{children}
    </div>
  );
}

function PhotoPicker({ preview, onChange }) {
  const ref = useRef(null);
  return (
    <div>
      <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
        Photo <span className="normal-case font-normal text-[#A1A1A6]">(optional)</span>
      </label>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-[#D2D2D7] hover:border-[#BFBFC4] transition-colors text-left"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#F5F5F7] border border-[#D2D2D7] flex items-center justify-center">
          {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <Camera size={16} className="text-[#A1A1A6]" />}
        </div>
        <span className="text-xs text-[#6E6E73]">{preview ? 'Change photo' : 'Add a photo'}</span>
      </button>
      <input ref={ref} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={onChange} />
    </div>
  );
}

function AddEntryModal({ mealType, date, token, onClose, onAdded }) {
  const mealMeta = MEAL_TYPES.find(m => m.id === mealType);
  const [mode, setMode] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [grams, setGrams] = useState(100);
  const [manual, setManual] = useState({ name: '', quantity_g: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [addingFavId, setAddingFavId] = useState(null);

  useEffect(() => {
    if (mode !== 'favorites') return;
    setFavoritesLoading(true);
    fetch(`${API}/api/nutrition/favorites`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setFavorites(data.favorites || []))
      .finally(() => setFavoritesLoading(false));
  }, [mode, token]);

  const deleteFavorite = async (id) => {
    setFavorites(fs => fs.filter(f => f.id !== id));
    await fetch(`${API}/api/nutrition/favorites/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  };

  const addFromFavorite = async (fav) => {
    setAddingFavId(fav.id);
    try {
      await fetch(`${API}/api/nutrition/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: fav.name, meal_type: mealType, quantity_g: fav.quantity_g, photo_url: fav.photo_url || '',
          calories: fav.calories, protein_g: fav.protein_g, carbs_g: fav.carbs_g, fat_g: fav.fat_g,
          logged_at: `${date}T12:00:00`,
        }),
      });
      onAdded();
      onClose();
    } finally {
      setAddingFavId(null);
    }
  };

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`${API}/api/nutrition/search?q=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [query, mode, token]);

  const scaled = selected ? {
    calories: (selected.calories_per_100g * grams) / 100,
    protein_g: (selected.protein_per_100g * grams) / 100,
    carbs_g: (selected.carbs_per_100g * grams) / 100,
    fat_g: (selected.fat_per_100g * grams) / 100,
  } : null;

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhoto = async () => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      const r = await fetch(`${API}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await r.json();
      return data.url || '';
    } finally {
      setUploading(false);
    }
  };

  const postEntry = async (payload) => {
    setSaving(true);
    setError('');
    try {
      let photo_url = '';
      if (photoFile) photo_url = await uploadPhoto();
      await fetch(`${API}/api/nutrition/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, meal_type: mealType, photo_url, logged_at: `${date}T12:00:00` }),
      });
      onAdded();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const submitSearch = () => {
    if (!selected || !scaled) return;
    postEntry({
      name: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
      quantity_g: grams,
      calories: scaled.calories, protein_g: scaled.protein_g, carbs_g: scaled.carbs_g, fat_g: scaled.fat_g,
    });
  };

  const submitManual = (e) => {
    e.preventDefault();
    if (!manual.name.trim()) { setError('Please enter a name.'); return; }
    postEntry({
      name: manual.name.trim(),
      quantity_g: manual.quantity_g ? Number(manual.quantity_g) : null,
      calories: Number(manual.calories) || 0,
      protein_g: Number(manual.protein_g) || 0,
      carbs_g: Number(manual.carbs_g) || 0,
      fat_g: Number(manual.fat_g) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D1D1F]/40" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div className="animate-appear rounded-2xl liquid-glass w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7]/60 shrink-0">
          <div>
            <p className="text-[11px] font-mono mb-0.5" style={{ color: mealMeta.color }}>// add to {mealMeta.label.toLowerCase()}</p>
            <h3 className="font-display text-lg font-medium text-[#1D1D1F]">New entry</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 pt-4 shrink-0">
          <div className="inline-flex rounded-full bg-[#EDEDEF] p-1 gap-1 w-full">
            {[{ id: 'favorites', label: 'Favorites' }, { id: 'search', label: 'Search food' }, { id: 'manual', label: 'Manual entry' }].map(t => (
              <button
                key={t.id} type="button"
                onClick={() => { setMode(t.id); setSelected(null); setError(''); }}
                className={`flex-1 px-3 py-2 rounded-full text-xs font-semibold transition-all ${mode === t.id ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {mode === 'favorites' ? (
            favoritesLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-[#F5F5F7] animate-pulse" />)}</div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-8">
                <BookmarkSimple size={22} className="mx-auto mb-3 text-[#D2D2D7]" />
                <p className="text-xs text-[#A1A1A6]">No favorites yet.<br />Star an entry from your day to save it here.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto -mx-1 px-1">
                {favorites.map(f => (
                  <div key={f.id} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F5F5F7] border border-transparent hover:border-[#D2D2D7] transition-all">
                    <button
                      type="button" onClick={() => addFromFavorite(f)} disabled={addingFavId === f.id}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#F5F5F7] border border-[#D2D2D7] flex items-center justify-center">
                        {f.photo_url ? (
                          <img src={f.photo_url.startsWith('/') ? `${API}${f.photo_url}` : f.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ForkKnife size={13} className="text-[#A1A1A6]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1D1D1F] truncate">{f.name}</p>
                        <p className="text-[11px] text-[#A1A1A6] truncate">{f.quantity_g ? `${f.quantity_g}g · ` : ''}{Math.round(f.calories)} kcal</p>
                      </div>
                    </button>
                    <button type="button" onClick={() => deleteFavorite(f.id)} className="text-[#BFBFC4] hover:text-red-500 transition-colors shrink-0">
                      <Trash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : mode === 'search' ? (
            selected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7]">
                  {selected.image_url ? (
                    <img src={selected.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shrink-0"><ForkKnife size={16} className="text-[#A1A1A6]" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1D1D1F] truncate">{selected.name}</p>
                    {selected.brand && <p className="text-xs text-[#A1A1A6] truncate">{selected.brand}</p>}
                  </div>
                  <button type="button" onClick={() => setSelected(null)} className="text-xs font-semibold text-[#A1A1A6] hover:text-[#1D1D1F] shrink-0">Change</button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Quantity (grams)</label>
                  <input
                    type="number" min="1" value={grams}
                    onChange={e => setGrams(Number(e.target.value) || 0)}
                    className="w-full rounded-lg px-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'kcal', value: scaled.calories, color: '#1D1D1F' },
                    { label: 'Protein', value: scaled.protein_g, color: MACRO_COLORS.protein },
                    { label: 'Carbs', value: scaled.carbs_g, color: MACRO_COLORS.carbs },
                    { label: 'Fat', value: scaled.fat_g, color: MACRO_COLORS.fat },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg py-2 bg-[#F5F5F7] border border-[#D2D2D7]">
                      <p className="text-sm font-bold tabular-nums" style={{ color: m.color }}>{Math.round(m.value)}</p>
                      <p className="text-[9px] text-[#A1A1A6] uppercase tracking-wide">{m.label}</p>
                    </div>
                  ))}
                </div>

                <PhotoPicker preview={photoPreview} onChange={handlePhoto} />
                {error && <ErrorBanner>{error}</ErrorBanner>}
                <PublicButton onClick={submitSearch} disabled={saving || uploading} className="w-full">
                  {saving || uploading ? 'Adding…' : 'Add entry'}
                </PublicButton>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6]" />
                  <input
                    autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. banana, chicken breast, oats…"
                    className="w-full rounded-lg pl-9 pr-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
                  />
                </div>
                {searching ? (
                  <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-[#F5F5F7] animate-pulse" />)}</div>
                ) : results.length > 0 ? (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
                    {results.map(r => (
                      <button
                        key={r.id + r.name} type="button"
                        onClick={() => { setSelected(r); setGrams(100); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F5F5F7] border border-transparent hover:border-[#D2D2D7] transition-all text-left"
                      >
                        {r.image_url ? (
                          <img src={r.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] flex items-center justify-center shrink-0"><ForkKnife size={13} className="text-[#A1A1A6]" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#1D1D1F] truncate">{r.name}</p>
                          <p className="text-[11px] text-[#A1A1A6] truncate">{r.brand ? `${r.brand} · ` : ''}{Math.round(r.calories_per_100g)} kcal/100g</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query.trim().length >= 2 ? (
                  <p className="text-xs text-[#A1A1A6] text-center py-6">No results. Try another search, or switch to manual entry.</p>
                ) : (
                  <p className="text-xs text-[#A1A1A6] text-center py-6">Start typing to search a public food database.</p>
                )}
              </div>
            )
          ) : (
            <form onSubmit={submitManual} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Name *</label>
                <input
                  required value={manual.name}
                  onChange={e => setManual(m => ({ ...m, name: e.target.value }))}
                  placeholder="e.g. Homemade pasta"
                  className="w-full rounded-lg px-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                  Quantity (grams) <span className="normal-case font-normal text-[#A1A1A6]">(optional)</span>
                </label>
                <input
                  type="number" min="0" value={manual.quantity_g}
                  onChange={e => setManual(m => ({ ...m, quantity_g: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'calories', label: 'Calories', unit: 'kcal' },
                  { key: 'protein_g', label: 'Protein', unit: 'g' },
                  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
                  { key: 'fat_g', label: 'Fat', unit: 'g' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">{f.label}</label>
                    <div className="relative">
                      <input
                        type="number" min="0" value={manual[f.key]}
                        onChange={e => setManual(m => ({ ...m, [f.key]: e.target.value }))}
                        className="w-full rounded-lg pr-9 pl-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#A1A1A6]">{f.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <PhotoPicker preview={photoPreview} onChange={handlePhoto} />
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <PublicButton type="submit" disabled={saving || uploading} className="w-full">
                {saving || uploading ? 'Adding…' : 'Add entry'}
              </PublicButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', hint: 'Little to no exercise' },
  { id: 'light', label: 'Lightly active', hint: '1–3 workouts/week' },
  { id: 'moderate', label: 'Moderately active', hint: '3–5 workouts/week' },
  { id: 'active', label: 'Active', hint: '6–7 workouts/week' },
  { id: 'very_active', label: 'Very active', hint: 'Physical job or 2x/day training' },
];
const GOAL_TYPES = [
  { id: 'lose', label: 'Lose weight' },
  { id: 'maintain', label: 'Maintain' },
  { id: 'gain', label: 'Gain weight' },
];

function GoalsModal({ goals, token, onClose, onSave }) {
  const [form, setForm] = useState(goals);
  const [saving, setSaving] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [profile, setProfile] = useState({
    weight_kg: goals.weight_kg || '',
    height_cm: goals.height_cm || '',
    age: goals.age || '',
    sex: goals.sex || 'male',
    activity_level: goals.activity_level || 'moderate',
    goal_type: goals.goal_type || 'maintain',
  });
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, ...profile };
      await fetch(`${API}/api/nutrition/goals`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const runEstimate = async () => {
    if (!profile.weight_kg || !profile.height_cm || !profile.age) {
      setEstimateError('Please fill in weight, height and age.');
      return;
    }
    setEstimating(true);
    setEstimateError('');
    try {
      const r = await fetch(`${API}/api/nutrition/goals/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          weight_kg: Number(profile.weight_kg), height_cm: Number(profile.height_cm), age: Number(profile.age),
          sex: profile.sex, activity_level: profile.activity_level, goal_type: profile.goal_type,
        }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setForm(f => ({ ...f, ...data }));
    } catch {
      setEstimateError('Could not calculate. Please try again.');
    } finally {
      setEstimating(false);
    }
  };

  const field = (key, label, unit) => (
    <div key={key}>
      <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number" min="0" value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
          className="w-full rounded-lg pr-10 pl-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#A1A1A6]">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D1D1F]/40" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div className="animate-appear rounded-2xl liquid-glass w-full max-w-sm overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7]/60 shrink-0">
          <h3 className="font-display text-lg font-medium text-[#1D1D1F]">Daily goals</h3>
          <button onClick={onClose} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <button
            type="button"
            onClick={() => setShowCalculator(s => !s)}
            className="w-full flex items-center gap-2.5 p-3 rounded-lg bg-[#4ECDC4]/8 border border-[#4ECDC4]/20 text-left hover:bg-[#4ECDC4]/12 transition-colors"
          >
            <Calculator size={15} className="text-[#4ECDC4] shrink-0" />
            <span className="text-xs font-semibold text-[#1D1D1F] flex-1">Calculate for me</span>
            <span className="text-[10px] text-[#A1A1A6]">{showCalculator ? 'Hide' : 'Show'}</span>
          </button>

          {showCalculator && (
            <div className="space-y-3 pb-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Weight</label>
                  <input type="number" min="0" placeholder="kg" value={profile.weight_kg}
                    onChange={e => setProfile(p => ({ ...p, weight_kg: e.target.value }))}
                    className="w-full rounded-lg px-2.5 py-2 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Height</label>
                  <input type="number" min="0" placeholder="cm" value={profile.height_cm}
                    onChange={e => setProfile(p => ({ ...p, height_cm: e.target.value }))}
                    className="w-full rounded-lg px-2.5 py-2 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Age</label>
                  <input type="number" min="0" placeholder="yrs" value={profile.age}
                    onChange={e => setProfile(p => ({ ...p, age: e.target.value }))}
                    className="w-full rounded-lg px-2.5 py-2 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]" />
                </div>
              </div>

              <div className="flex rounded-lg overflow-hidden border border-[#D2D2D7]">
                {[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }].map(s => (
                  <button
                    key={s.id} type="button" onClick={() => setProfile(p => ({ ...p, sex: s.id }))}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${profile.sex === s.id ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#6E6E73] hover:text-[#1D1D1F]'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Activity level</label>
                <select
                  value={profile.activity_level}
                  onChange={e => setProfile(p => ({ ...p, activity_level: e.target.value }))}
                  className="w-full rounded-lg px-2.5 py-2 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
                >
                  {ACTIVITY_LEVELS.map(a => <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Goal</label>
                <div className="flex rounded-lg overflow-hidden border border-[#D2D2D7]">
                  {GOAL_TYPES.map(g => (
                    <button
                      key={g.id} type="button" onClick={() => setProfile(p => ({ ...p, goal_type: g.id }))}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${profile.goal_type === g.id ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#6E6E73] hover:text-[#1D1D1F]'}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {estimateError && <ErrorBanner>{estimateError}</ErrorBanner>}

              <button
                type="button" onClick={runEstimate} disabled={estimating}
                className="w-full rounded-lg py-2.5 text-xs font-semibold bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white transition-colors disabled:opacity-50"
              >
                {estimating ? 'Calculating…' : 'Calculate targets'}
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4 pt-1">
            {field('daily_calories', 'Calories', 'kcal')}
            <div className="grid grid-cols-3 gap-3">
              {field('daily_protein_g', 'Protein', 'g')}
              {field('daily_carbs_g', 'Carbs', 'g')}
              {field('daily_fat_g', 'Fat', 'g')}
            </div>
            <PublicButton type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save goals'}
            </PublicButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ stats, loading, range, onRangeChange, goal }) {
  return (
    <div className="rounded-xl liquid-glass p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ChartBar size={15} className="text-[#4ECDC4]" />
          <h2 className="text-sm font-bold text-[#1D1D1F]">Calories over time</h2>
        </div>
        <div className="inline-flex rounded-full bg-[#EDEDEF] p-1 gap-1">
          {[7, 30].map(d => (
            <button
              key={d} onClick={() => onRangeChange(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${range === d ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-64 rounded-lg bg-[#F5F5F7] animate-pulse" />
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={stats} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDEDEF" vertical={false} />
              <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 10, fill: '#A1A1A6' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#A1A1A6' }} axisLine={false} tickLine={false} />
              {goal > 0 && <ReferenceLine y={goal} stroke="#4ECDC4" strokeDasharray="4 4" />}
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #D2D2D7', fontSize: 12 }}
                formatter={(v) => [`${Math.round(v)} kcal`, 'Calories']}
              />
              <Bar dataKey="calories" radius={[4, 4, 0, 0]} fill="#4ECDC4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const DEFAULT_GOALS = {
  daily_calories: 2000, daily_protein_g: 120, daily_carbs_g: 250, daily_fat_g: 65,
  weight_kg: null, height_cm: null, age: null, sex: null, activity_level: null, goal_type: null,
};
const DEFAULT_TOTALS = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

export default function Nutrition() {
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [date, setDate] = useState(todayStr());
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState(DEFAULT_TOTALS);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [showGoals, setShowGoals] = useState(false);
  const [view, setView] = useState('today');
  const [statsRange, setStatsRange] = useState(7);
  const [stats, setStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    document.title = 'Food Journal — Vakar Games';
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/login');
  }, [authLoading, user, navigate]);

  const loadDay = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/nutrition/entries?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setEntries(data.entries || []);
      setTotals(data.totals || DEFAULT_TOTALS);
    } finally {
      setLoading(false);
    }
  }, [date, token]);

  const loadGoals = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/nutrition/goals`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setGoals(data);
    } catch { /* keep defaults */ }
  }, [token]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const r = await fetch(`${API}/api/nutrition/entries/stats?days=${statsRange}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setStats(data.days || []);
    } finally {
      setStatsLoading(false);
    }
  }, [statsRange, token]);

  useEffect(() => { loadGoals(); }, [loadGoals]);
  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => { if (view === 'history') loadStats(); }, [view, loadStats]);

  const deleteEntry = async (id) => {
    setEntries(es => es.filter(e => e.id !== id));
    try {
      await fetch(`${API}/api/nutrition/entries/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    } finally {
      loadDay();
    }
  };

  const [favoritedIds, setFavoritedIds] = useState(new Set());
  const saveAsFavorite = async (entry) => {
    setFavoritedIds(s => new Set(s).add(entry.id));
    try {
      await fetch(`${API}/api/nutrition/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: entry.name, meal_type: entry.meal_type, quantity_g: entry.quantity_g, photo_url: entry.photo_url || '',
          calories: entry.calories, protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g,
        }),
      });
    } catch {
      setFavoritedIds(s => { const n = new Set(s); n.delete(entry.id); return n; });
    }
  };

  const entriesByMeal = useMemo(() => {
    const map = { breakfast: [], lunch: [], dinner: [], snack: [] };
    entries.forEach(e => { (map[e.meal_type] || map.snack).push(e); });
    return map;
  }, [entries]);

  if (authLoading || !user) return null;

  return (
    <div className="bg-[#F5F5F7] min-h-screen flex flex-col">
      <PublicNav />

      <div className="pt-[52px] flex-1">
        <div className="bg-white border-b border-[#D2D2D7] px-6 pt-14 pb-8">
          <div className="max-w-2xl mx-auto">
            <p className="text-[12px] font-mono text-[#4ECDC4] mb-2">// food journal</p>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="font-display text-3xl font-medium tracking-[-0.01em] text-[#1D1D1F]">What did you eat?</h1>
              <div className="inline-flex w-full sm:w-auto rounded-full bg-[#EDEDEF] p-1 gap-1">
                {[{ id: 'today', label: 'Today' }, { id: 'history', label: 'History' }].map(t => (
                  <button
                    key={t.id} onClick={() => setView(t.id)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-full text-xs font-semibold transition-all ${view === t.id ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
          {view === 'today' ? (
            <>
              <div className="flex items-center justify-between">
                <button onClick={() => setDate(d => addDays(d, -1))} className="p-2 rounded-full hover:bg-white text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
                  <CaretLeft size={16} />
                </button>
                <div className="flex items-center gap-2">
                  <CalendarBlank size={14} className="text-[#A1A1A6]" />
                  <span className="text-sm font-semibold text-[#1D1D1F]">{formatDateLabel(date)}</span>
                </div>
                <button
                  onClick={() => setDate(d => addDays(d, 1))}
                  disabled={date >= todayStr()}
                  className="p-2 rounded-full hover:bg-white text-[#6E6E73] hover:text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <CaretRight size={16} />
                </button>
              </div>

              <div className="rounded-xl liquid-glass p-6 flex flex-col sm:flex-row items-center gap-6">
                <CalorieRing consumed={totals.calories} goal={goals.daily_calories} />
                <div className="flex-1 w-full space-y-3">
                  <MacroBar label="Protein" value={totals.protein_g} goal={goals.daily_protein_g} color={MACRO_COLORS.protein} />
                  <MacroBar label="Carbs" value={totals.carbs_g} goal={goals.daily_carbs_g} color={MACRO_COLORS.carbs} />
                  <MacroBar label="Fat" value={totals.fat_g} goal={goals.daily_fat_g} color={MACRO_COLORS.fat} />
                  <button onClick={() => setShowGoals(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors pt-1">
                    <Target size={11} />Edit goals
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-white/60 animate-pulse" />)}</div>
              ) : (
                MEAL_TYPES.map(mt => {
                  const list = entriesByMeal[mt.id];
                  const subtotal = list.reduce((s, e) => s + (e.calories || 0), 0);
                  return (
                    <div key={mt.id} className="rounded-xl liquid-glass overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${mt.color}1a` }}>
                            <mt.icon size={15} style={{ color: mt.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1D1D1F]">{mt.label}</p>
                            {list.length > 0 && <p className="text-[11px] text-[#A1A1A6]">{Math.round(subtotal)} kcal</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => setAddingFor(mt.id)}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white transition-colors"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      {list.length > 0 && (
                        <div className="border-t border-[#D2D2D7]/60 divide-y divide-[#D2D2D7]/60">
                          {list.map(e => (
                            <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#F5F5F7] border border-[#D2D2D7] flex items-center justify-center">
                                {e.photo_url ? (
                                  <img src={e.photo_url.startsWith('/') ? `${API}${e.photo_url}` : e.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <mt.icon size={14} style={{ color: mt.color }} className="opacity-40" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#1D1D1F] truncate">{e.name}</p>
                                <p className="text-[11px] text-[#A1A1A6]">
                                  {e.quantity_g ? `${e.quantity_g}g · ` : ''}P {Math.round(e.protein_g)}g · C {Math.round(e.carbs_g)}g · F {Math.round(e.fat_g)}g
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-[#1D1D1F] tabular-nums shrink-0">{Math.round(e.calories)}</span>
                              <button
                                onClick={() => saveAsFavorite(e)}
                                disabled={favoritedIds.has(e.id)}
                                title={favoritedIds.has(e.id) ? 'Saved to favorites' : 'Save to favorites'}
                                className={`transition-colors shrink-0 ${favoritedIds.has(e.id) ? 'text-amber-400' : 'text-[#BFBFC4] hover:text-amber-400'}`}
                              >
                                <Star size={13} weight={favoritedIds.has(e.id) ? 'fill' : 'regular'} />
                              </button>
                              <button onClick={() => deleteEntry(e.id)} className="text-[#BFBFC4] hover:text-red-500 transition-colors shrink-0">
                                <Trash size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <HistoryView stats={stats} loading={statsLoading} range={statsRange} onRangeChange={setStatsRange} goal={goals.daily_calories} />
          )}
        </div>
      </div>

      <SiteFooter />

      {addingFor && (
        <AddEntryModal mealType={addingFor} date={date} token={token} onClose={() => setAddingFor(null)} onAdded={loadDay} />
      )}
      {showGoals && (
        <GoalsModal goals={goals} token={token} onClose={() => setShowGoals(false)} onSave={setGoals} />
      )}
    </div>
  );
}
