import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || '';

const TOOL_OPTIONS = [
  { id: 'turbowarp', label: 'TurboWarp' },
  { id: 'scratch', label: 'Scratch' },
  { id: 'unity', label: 'Unity' },
  { id: 'unreal', label: 'Unreal Engine' },
  { id: 'blender', label: 'Blender' },
  { id: 'godot', label: 'Godot' },
  { id: 'figma', label: 'Figma' },
  { id: 'canva', label: 'Canva' },
  { id: 'illustrator', label: 'Illustrator' },
  { id: 'photoshop', label: 'Photoshop' },
  { id: 'aftereffects', label: 'After Effects' },
  { id: 'premiere', label: 'Premiere Pro' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'github', label: 'GitHub' },
  { id: 'notion', label: 'Notion' },
  { id: 'discord', label: 'Discord' },
];

const DEPARTMENTS = ['Development', 'Art & Design', 'Game Design', 'Marketing', 'Community', 'Sound', 'Writing', 'Other'];
const CONTRACT_TYPES = ['Volunteer', 'Internship', 'Part-time', 'Full-time', 'Freelance'];

const EMPTY_FORM = {
  title: '',
  department: DEPARTMENTS[0],
  contract_type: CONTRACT_TYPES[0],
  location: 'Remote',
  description: '',
  requirements: [],
  tools: [],
  is_open: true,
};

function ToolIcon({ toolId, size = 18 }) {
  const svgs = {
    turbowarp: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="45" fill="#9B59B6" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="bold" fill="white">T</text>
      </svg>
    ),
    scratch: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#FF6633" />
        <text x="50" y="70" textAnchor="middle" fontSize="52" fontWeight="bold" fill="white">S</text>
      </svg>
    ),
    unity: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#222" />
        <circle cx="50" cy="50" r="26" stroke="white" strokeWidth="6" fill="none" />
        <line x1="50" y1="24" x2="50" y2="76" stroke="white" strokeWidth="5" />
        <line x1="24" y1="62" x2="50" y2="50" stroke="white" strokeWidth="5" />
        <line x1="76" y1="62" x2="50" y2="50" stroke="white" strokeWidth="5" />
      </svg>
    ),
    blender: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#EA7600" />
        <circle cx="62" cy="44" r="18" fill="white" />
        <circle cx="62" cy="44" r="10" fill="#EA7600" />
        <circle cx="35" cy="64" r="14" fill="white" opacity="0.8" />
      </svg>
    ),
    figma: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#1E1E1E" />
        <rect x="32" y="14" width="18" height="18" rx="9" fill="#F24E1E" />
        <rect x="50" y="14" width="18" height="18" rx="9" fill="#FF7262" />
        <rect x="32" y="32" width="18" height="18" rx="0" fill="#A259FF" />
        <rect x="32" y="50" width="18" height="18" rx="9" fill="#0ACF83" />
        <circle cx="59" cy="41" r="9" fill="#1ABCFE" />
      </svg>
    ),
    canva: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#00C4CC" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="bold" fill="white">C</text>
      </svg>
    ),
    illustrator: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#FF9A00" />
        <text x="50" y="68" textAnchor="middle" fontSize="38" fontWeight="900" fill="white">Ai</text>
      </svg>
    ),
    photoshop: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#001E36" />
        <text x="50" y="68" textAnchor="middle" fontSize="36" fontWeight="900" fill="#31A8FF">Ps</text>
      </svg>
    ),
    aftereffects: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#00005B" />
        <text x="50" y="68" textAnchor="middle" fontSize="36" fontWeight="900" fill="#9999FF">Ae</text>
      </svg>
    ),
    premiere: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#00005B" />
        <text x="50" y="68" textAnchor="middle" fontSize="34" fontWeight="900" fill="#E77BF3">Pr</text>
      </svg>
    ),
    vscode: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#007ACC" />
        <path d="M70 20L40 50L70 80L82 70L56 50L82 30Z" fill="white" />
        <path d="M18 35L40 50L18 65V35Z" fill="white" opacity="0.6" />
        <path d="M70 20L82 30V70L70 80V20Z" fill="white" opacity="0.8" />
      </svg>
    ),
    github: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#24292F" />
        <path d="M50 15C31 15 15 31 15 50C15 65.4 25.1 78.5 39 83.1C40.8 83.4 41.4 82.3 41.4 81.3V74.5C32 76.6 29.9 70.3 29.9 70.3C28.3 66.2 25.9 65.1 25.9 65.1C22.6 62.9 26.2 63 26.2 63C29.9 63.3 31.8 66.8 31.8 66.8C35.1 72.3 40.5 70.7 41.6 69.8C41.9 67.5 42.9 66 43.9 65.1C36.5 64.3 28.7 61.4 28.7 48.8C28.7 44.9 30.1 41.7 32 39.2C31.6 38.3 30.4 34.6 32.4 29.6C32.4 29.6 35.4 28.6 41.4 33.4C43.9 32.6 46.6 32.2 49.2 32.2C51.8 32.2 54.5 32.6 57 33.4C63 28.6 66 29.6 66 29.6C68 34.6 66.8 38.3 66.4 39.2C68.3 41.7 69.7 44.9 69.7 48.8C69.7 61.5 61.9 64.3 54.5 65.1C55.7 66.2 56.8 68.4 56.8 71.8V81.3C56.8 82.3 57.4 83.5 59.2 83.1C73.1 78.5 83.1 65.4 83.1 50C83 31 67 15 50 15Z" fill="white" />
      </svg>
    ),
    notion: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="white" />
        <rect width="100" height="100" rx="18" fill="white" stroke="#E5E5E5" strokeWidth="2" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="900" fill="#191919">N</text>
      </svg>
    ),
    discord: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#5865F2" />
        <path d="M67 32C63.1 30.2 59 29 54.7 28.5L54.1 29.7C58.1 30.6 61.9 32 65.4 33.9C60.2 31.1 54.3 29.5 48.1 29.5C42 29.5 36.1 31.1 30.9 33.9C34.4 32 38.2 30.6 42.2 29.7L41.6 28.5C37.3 29 33.2 30.2 29.3 32C22.4 42.1 19.8 51.9 20.8 61.5C25.5 65.2 30.1 67.4 34.6 68.9C35.7 67.4 36.7 65.8 37.5 64.2C35.8 63.5 34.2 62.7 32.7 61.7L33.4 61L33.5 60.9C44 66 56.1 66 66.4 60.9L66.5 61L67.2 61.7C65.7 62.7 64.1 63.6 62.4 64.2C63.2 65.8 64.2 67.4 65.3 68.9C69.8 67.4 74.4 65.2 79.1 61.5C80.3 50.3 77.1 40.6 67 32ZM39.8 55.5C37.3 55.5 35.2 53.2 35.2 50.3C35.2 47.4 37.2 45.1 39.8 45.1C42.4 45.1 44.5 47.4 44.4 50.3C44.4 53.2 42.3 55.5 39.8 55.5ZM60.5 55.5C58 55.5 55.9 53.2 55.9 50.3C55.9 47.4 57.9 45.1 60.5 45.1C63.1 45.1 65.2 47.4 65.1 50.3C65.1 53.2 63 55.5 60.5 55.5Z" fill="white" />
      </svg>
    ),
    godot: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#478CBF" />
        <circle cx="50" cy="50" r="26" fill="white" />
        <circle cx="50" cy="50" r="18" fill="#478CBF" />
        <circle cx="42" cy="44" r="5" fill="white" />
        <circle cx="58" cy="44" r="5" fill="white" />
      </svg>
    ),
    unreal: (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" rx="18" fill="#1A1A1A" />
        <text x="50" y="68" textAnchor="middle" fontSize="52" fontWeight="900" fill="white">U</text>
      </svg>
    ),
  };
  return svgs[toolId] || (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="18" fill="#D2D2D7" />
      <text x="50" y="68" textAnchor="middle" fontSize="44" fill="#6E6E73">?</text>
    </svg>
  );
}

export { ToolIcon };

export default function CareersManagement() {
  const { token } = useAuth();
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newReq, setNewReq] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/careers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setCareers(data.careers || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); };
  const openEdit = (c) => {
    setForm({
      title: c.title, department: c.department, contract_type: c.contract_type,
      location: c.location, description: c.description,
      requirements: c.requirements || [], tools: c.tools || [], is_open: c.is_open,
    });
    setEditing(c._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `${API}/api/admin/careers/${editing}` : `${API}/api/admin/careers`;
      const method = editing ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/api/admin/careers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirm(null);
    await load();
  };

  const toggleTool = (toolId) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(toolId) ? f.tools.filter(t => t !== toolId) : [...f.tools, toolId],
    }));
  };

  const addReq = () => {
    if (!newReq.trim()) return;
    setForm(f => ({ ...f, requirements: [...f.requirements, newReq.trim()] }));
    setNewReq('');
  };

  const removeReq = (i) => setForm(f => ({ ...f, requirements: f.requirements.filter((_, idx) => idx !== i) }));

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1D1D1F]" style={{ letterSpacing: '0.08em' }}>
              CAREERS
            </h2>
            <p className="text-sm text-[#6E6E73] mt-0.5">{careers.length} position{careers.length !== 1 ? 's' : ''}</p>
          </div>
          <Button icon={Plus} onClick={openCreate}>New Position</Button>
        </div>

        {showForm && (
          <div className="rounded-xl bg-white border border-[#D2D2D7] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1D1D1F]">{editing ? 'Edit Position' : 'New Position'}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#6E6E73] hover:text-[#1D1D1F]">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Job Title *</label>
                <input
                  className="w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4]"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. TurboWarp Developer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Department</label>
                <select
                  className="w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4] bg-white"
                  value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                >
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Contract</label>
                <select
                  className="w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4] bg-white"
                  value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
                >
                  {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Location</label>
                <input
                  className="w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4]"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Remote, Paris, etc."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                rows={4}
                className="w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4] resize-none"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the role, missions, context..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Requirements</label>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4]"
                  value={newReq} onChange={e => setNewReq(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReq())}
                  placeholder="Add a requirement and press Enter"
                />
                <Button size="sm" variant="secondary" onClick={addReq}>Add</Button>
              </div>
              {form.requirements.length > 0 && (
                <ul className="space-y-1">
                  {form.requirements.map((r, i) => (
                    <li key={i} className="flex items-center justify-between bg-[#F5F5F7] border border-[#D2D2D7] px-3 py-1.5 text-sm text-[#1D1D1F]">
                      <span>{r}</span>
                      <button onClick={() => removeReq(i)} className="text-[#A1A1A6] hover:text-red-500 ml-2">
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Tools Required</label>
              <div className="flex flex-wrap gap-2">
                {TOOL_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTool(t.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-medium transition-all ${
                      form.tools.includes(t.id)
                        ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#1D1D1F]'
                        : 'border-[#D2D2D7] text-[#6E6E73] hover:border-[#BFBFC4]'
                    }`}
                  >
                    <span className={form.tools.includes(t.id) ? '' : 'grayscale opacity-60'}>
                      <ToolIcon toolId={t.id} size={14} />
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`w-10 h-5 rounded-full relative transition-colors ${form.is_open ? 'bg-[#4ECDC4]' : 'bg-[#D2D2D7]'}`}
                  onClick={() => setForm(f => ({ ...f, is_open: !f.is_open }))}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.is_open ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-[#6E6E73]">Position open</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} loading={saving} icon={Check}>
                {editing ? 'Save Changes' : 'Publish Position'}
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#D2D2D7] animate-pulse" />)}
          </div>
        ) : careers.length === 0 ? (
          <div className="text-center py-16 text-[#6E6E73]">
            <p className="text-sm">No positions posted yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {careers.map(c => (
              <div key={c._id} className="rounded-xl bg-white border border-[#D2D2D7]">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${c.is_open ? 'bg-[#4ECDC4]' : 'bg-[#A1A1A6]'}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1D1D1F] text-sm truncate">{c.title}</p>
                      <p className="text-xs text-[#6E6E73]">{c.department} · {c.contract_type} · {c.location}</p>
                    </div>
                    {c.tools?.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1 ml-2">
                        {c.tools.slice(0, 5).map(t => (
                          <span key={t} className="grayscale opacity-60">
                            <ToolIcon toolId={t} size={16} />
                          </span>
                        ))}
                        {c.tools.length > 5 && <span className="text-xs text-[#A1A1A6]">+{c.tools.length - 5}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(c); }}
                      className="p-1.5 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirm(c._id); }}
                      className="p-1.5 text-[#6E6E73] hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                    {expandedId === c._id ? <ChevronUp size={14} className="text-[#A1A1A6]" /> : <ChevronDown size={14} className="text-[#A1A1A6]" />}
                  </div>
                </div>
                {expandedId === c._id && (
                  <div className="px-5 pb-5 border-t border-[#D2D2D7] pt-4 space-y-3">
                    {c.description && <p className="text-sm text-[#3A3A3C] leading-relaxed whitespace-pre-wrap">{c.description}</p>}
                    {c.requirements?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Requirements</p>
                        <ul className="space-y-1">
                          {c.requirements.map((r, i) => <li key={i} className="text-sm text-[#3A3A3C] flex gap-2"><span className="text-[#4ECDC4]">—</span>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {c.tools?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Tools</p>
                        <div className="flex flex-wrap gap-2">
                          {c.tools.map(t => {
                            const opt = TOOL_OPTIONS.find(o => o.id === t);
                            return (
                              <span key={t} className="flex items-center gap-1.5 px-2 py-1 bg-[#F5F5F7] border border-[#D2D2D7] text-xs text-[#6E6E73]">
                                <span className="grayscale opacity-60"><ToolIcon toolId={t} size={13} /></span>
                                {opt?.label || t}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title="Delete this position?"
        description="This action is permanent and cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => handleDelete(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
