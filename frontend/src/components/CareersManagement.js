import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Copy, X, Check, ChevronDown, ChevronUp,
  Search, Users, Briefcase, MapPin, Mail,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS, CONTRACT_TYPES, TOOL_OPTIONS, ToolIcon, departmentColor } from '../constants/careers';

const API = process.env.REACT_APP_API_URL || '';

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

const STATUS_FILTERS = ['All', 'Open', 'Closed'];

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
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [appsByCareer, setAppsByCareer] = useState({});
  const [appsLoadingId, setAppsLoadingId] = useState(null);

  const [togglingId, setTogglingId] = useState(null);

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

  const openDuplicate = (c) => {
    setForm({
      title: `${c.title} (Copy)`, department: c.department, contract_type: c.contract_type,
      location: c.location, description: c.description,
      requirements: [...(c.requirements || [])], tools: [...(c.tools || [])], is_open: false,
    });
    setEditing(null);
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
    setDeleting(true);
    try {
      await fetch(`${API}/api/admin/careers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setConfirm(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const toggleOpen = async (c) => {
    setTogglingId(c._id);
    try {
      await fetch(`${API}/api/admin/careers/${c._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_open: !c.is_open }),
      });
      setCareers(cs => cs.map(x => x._id === c._id ? { ...x, is_open: !x.is_open } : x));
    } finally {
      setTogglingId(null);
    }
  };

  const toggleExpand = async (c) => {
    const id = c._id;
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!appsByCareer[id]) {
      setAppsLoadingId(id);
      try {
        const r = await fetch(`${API}/api/admin/careers/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json();
        setAppsByCareer(a => ({ ...a, [id]: data.applications || [] }));
      } finally {
        setAppsLoadingId(null);
      }
    }
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

  const stats = useMemo(() => ({
    total: careers.length,
    open: careers.filter(c => c.is_open).length,
    closed: careers.filter(c => !c.is_open).length,
    applications: careers.reduce((sum, c) => sum + (c.application_count || 0), 0),
  }), [careers]);

  const availableDepts = useMemo(
    () => ['All', ...DEPARTMENTS.filter(d => careers.some(c => c.department === d))],
    [careers]
  );

  const filtered = useMemo(() => careers.filter(c => {
    if (deptFilter !== 'All' && c.department !== deptFilter) return false;
    if (statusFilter === 'Open' && !c.is_open) return false;
    if (statusFilter === 'Closed' && c.is_open) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q) && !c.department.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [careers, deptFilter, statusFilter, search]);

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Careers</h2>
            <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">
              Manage open positions and review applications
            </p>
          </div>
          <Button icon={Plus} onClick={openCreate}>New Position</Button>
        </div>

        {!loading && careers.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Positions', value: stats.total, variant: 'default' },
              { label: 'Open', value: stats.open, variant: 'success' },
              { label: 'Closed', value: stats.closed, variant: 'default' },
              { label: 'Applications', value: stats.applications, variant: 'info' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] px-4 py-3">
                <p className="text-2xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7] leading-none">{s.value}</p>
                <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{editing ? 'Edit Position' : 'New Position'}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">Job Title *</label>
                <input
                  className="rounded-lg w-full border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] bg-white dark:bg-[#151520] focus:outline-none focus:border-[#4ECDC4]"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. TurboWarp Developer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">Department</label>
                <select
                  className="rounded-lg w-full border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520]"
                  value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                >
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">Contract</label>
                <select
                  className="rounded-lg w-full border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520]"
                  value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
                >
                  {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">Location</label>
                <input
                  className="rounded-lg w-full border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] bg-white dark:bg-[#151520] focus:outline-none focus:border-[#4ECDC4]"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Remote, Paris, etc."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                rows={4}
                className="rounded-lg w-full border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] bg-white dark:bg-[#151520] focus:outline-none focus:border-[#4ECDC4] resize-none"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the role, missions, context..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">Requirements</label>
              <div className="flex gap-2 mb-2">
                <input
                  className="rounded-lg flex-1 border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] bg-white dark:bg-[#151520] focus:outline-none focus:border-[#4ECDC4]"
                  value={newReq} onChange={e => setNewReq(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addReq())}
                  placeholder="Add a requirement and press Enter"
                />
                <Button size="sm" variant="secondary" onClick={addReq}>Add</Button>
              </div>
              {form.requirements.length > 0 && (
                <ul className="space-y-1">
                  {form.requirements.map((r, i) => (
                    <li key={i} className="rounded-xl flex items-center justify-between bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-1.5 text-sm text-[#1D1D1F] dark:text-[#e4e4e7]">
                      <span>{r}</span>
                      <button onClick={() => removeReq(i)} className="text-[#A1A1A6] dark:text-[#71717a] hover:text-red-500 ml-2">
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-2">Tools Required</label>
              <div className="flex flex-wrap gap-2">
                {TOOL_OPTIONS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleTool(t.id)}
                    className={`rounded-lg flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-medium transition-all ${
                      form.tools.includes(t.id)
                        ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#1D1D1F] dark:text-white'
                        : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
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
                  className={`w-10 h-5 rounded-full relative transition-colors ${form.is_open ? 'bg-[#4ECDC4]' : 'bg-[#D2D2D7] dark:bg-[#2a2a3c]'}`}
                  onClick={() => setForm(f => ({ ...f, is_open: !f.is_open }))}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.is_open ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">Position open</span>
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

        {!loading && careers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title, location, department…"
                className="rounded-lg w-full h-9 border border-[#D2D2D7] dark:border-[#2a2a3c] pl-9 pr-3 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] bg-white dark:bg-[#151520] focus:outline-none focus:border-[#4ECDC4]"
              />
            </div>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 h-9 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] bg-white dark:bg-[#151520] focus:outline-none focus:border-[#4ECDC4]"
            >
              {availableDepts.map(d => <option key={d} value={d}>{d === 'All' ? 'All departments' : d}</option>)}
            </select>
            <div className="flex items-center gap-1 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] p-0.5 bg-white dark:bg-[#151520]">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 h-8 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-[#1D1D1F] dark:bg-[#4ECDC4] text-white dark:text-[#0a0a0f]'
                      : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-[#D2D2D7] dark:bg-[#1c1c2e] animate-pulse" />)}
          </div>
        ) : careers.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No positions posted yet"
            description="Create your first opening to start receiving applications."
            action={<Button icon={Plus} onClick={openCreate}>New Position</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No positions match your filters"
            description="Try a different search term, department, or status."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(c => {
              const color = departmentColor(c.department);
              const appCount = c.application_count || 0;
              return (
                <div key={c._id} className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer gap-3" onClick={() => toggleExpand(c)}>
                    <div className="flex items-center gap-4 min-w-0">
                      <button
                        onClick={e => { e.stopPropagation(); toggleOpen(c); }}
                        title={c.is_open ? 'Open — click to close' : 'Closed — click to reopen'}
                        className={`w-9 h-5 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${c.is_open ? 'bg-[#4ECDC4]' : 'bg-[#D2D2D7] dark:bg-[#2a2a3c]'}`}
                        disabled={togglingId === c._id}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${c.is_open ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] text-sm truncate">{c.title}</p>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}1a` }}>
                            {c.department}
                          </span>
                        </div>
                        <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] flex items-center gap-1 mt-0.5">
                          <MapPin size={10} />{c.location} · {c.contract_type}
                        </p>
                      </div>
                      {c.tools?.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1 ml-2">
                          {c.tools.slice(0, 5).map(t => (
                            <span key={t} className="grayscale opacity-60">
                              <ToolIcon toolId={t} size={16} />
                            </span>
                          ))}
                          {c.tools.length > 5 && <span className="text-xs text-[#A1A1A6] dark:text-[#71717a]">+{c.tools.length - 5}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={appCount > 0 ? 'info' : 'default'} dot={false}>
                        <Users size={11} />{appCount}
                      </Badge>
                      <button
                        onClick={e => { e.stopPropagation(); openDuplicate(c); }}
                        title="Duplicate"
                        className="p-1.5 text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] rounded-md"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(c); }}
                        title="Edit"
                        className="p-1.5 text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] rounded-md"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirm(c._id); }}
                        title="Delete"
                        className="p-1.5 text-[#6E6E73] dark:text-[#a1a1aa] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md"
                      >
                        <Trash2 size={14} />
                      </button>
                      {expandedId === c._id ? <ChevronUp size={14} className="text-[#A1A1A6] dark:text-[#71717a]" /> : <ChevronDown size={14} className="text-[#A1A1A6] dark:text-[#71717a]" />}
                    </div>
                  </div>

                  {expandedId === c._id && (
                    <div className="px-5 pb-5 border-t border-[#D2D2D7] dark:border-[#2a2a3c] pt-4 space-y-4">
                      {c.description && <p className="text-sm text-[#3A3A3C] dark:text-[#d4d4d8] leading-relaxed whitespace-pre-wrap">{c.description}</p>}
                      {c.requirements?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-2">Requirements</p>
                          <ul className="space-y-1">
                            {c.requirements.map((r, i) => <li key={i} className="text-sm text-[#3A3A3C] dark:text-[#d4d4d8] flex gap-2"><span style={{ color }}>—</span>{r}</li>)}
                          </ul>
                        </div>
                      )}
                      {c.tools?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-2">Tools</p>
                          <div className="flex flex-wrap gap-2">
                            {c.tools.map(t => (
                              <span key={t} className="rounded-xl flex items-center gap-1.5 px-2 py-1 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                                <span className="grayscale opacity-60"><ToolIcon toolId={t} size={13} /></span>
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Users size={12} />Applications ({appCount})
                        </p>
                        {appsLoadingId === c._id ? (
                          <div className="space-y-2">
                            {[1, 2].map(i => <div key={i} className="h-9 rounded-lg bg-[#F5F5F7] dark:bg-[#111118] animate-pulse" />)}
                          </div>
                        ) : (appsByCareer[c._id]?.length || 0) === 0 ? (
                          <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">No applications received yet.</p>
                        ) : (
                          <div className="rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden divide-y divide-[#D2D2D7] dark:divide-[#2a2a3c]">
                            {appsByCareer[c._id].map(a => (
                              <div key={a.ticket_number} className="flex items-center justify-between gap-3 px-3 py-2 bg-[#F5F5F7]/50 dark:bg-[#111118]/50 text-xs">
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="font-mono text-[#4ECDC4] shrink-0">{a.ticket_number}</span>
                                  <span className="font-medium text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{a.username}</span>
                                  <span className="text-[#A1A1A6] dark:text-[#71717a] hidden sm:flex items-center gap-1 truncate">
                                    <Mail size={10} />{a.user_email}
                                  </span>
                                </div>
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  a.status === 'closed' ? 'bg-zinc-100 dark:bg-[#2a2a3c] text-zinc-500' :
                                  a.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' :
                                  a.status === 'in_progress' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                  'bg-[#4ECDC4]/10 text-[#4ECDC4]'
                                }`}>
                                  {a.status.replace('_', ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => !deleting && setConfirm(null)}
        onConfirm={() => handleDelete(confirm)}
        title="Delete this position?"
        description="This action is permanent and cannot be undone. Applications already received will remain visible in the ticketing system."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </>
  );
}
