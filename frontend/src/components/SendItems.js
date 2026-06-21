import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Package, Send, Plus, Trash2, X, Save, Upload, Edit2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = (slug) => `item_templates_${slug}`;

const emptyTemplate = { name: '', variable: '', amount: '', image_url: '' };
const emptyForm = { uid: '', variable: '', amount: '' };

const inputClass = 'w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none transition-all';
const labelClass = 'block text-xs font-semibold text-[#71717a] mb-1.5 uppercase tracking-wider';

export const SendItems = () => {
  const { token } = useAuth();
  const { selectedProject } = useProject();

  const [formData, setFormData]       = useState(emptyForm);
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [templates, setTemplates]     = useState([]);
  const [showAddTpl, setShowAddTpl]   = useState(false);
  const [editingTpl, setEditingTpl]   = useState(null);
  const [tplForm, setTplForm]         = useState(emptyTemplate);
  const [selectedTpl, setSelectedTpl] = useState(null);

  // Load templates from localStorage when project changes
  useEffect(() => {
    if (selectedProject) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY(selectedProject.slug));
        setTemplates(raw ? JSON.parse(raw) : []);
      } catch { setTemplates([]); }
    }
    setFormData(emptyForm);
    setSelectedTpl(null);
  }, [selectedProject?.slug]);

  const persistTemplates = (list) => {
    if (!selectedProject) return;
    localStorage.setItem(STORAGE_KEY(selectedProject.slug), JSON.stringify(list));
    setTemplates(list);
  };

  const uploadFile = async (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await axios.post(`${API_URL}/api/upload`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setter(r.data.url);
      toast.success('Image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const openAddTemplate = () => {
    setEditingTpl(null);
    setTplForm(emptyTemplate);
    setShowAddTpl(true);
  };

  const openEditTemplate = (tpl) => {
    setEditingTpl(tpl);
    setTplForm({ name: tpl.name, variable: tpl.variable, amount: tpl.amount, image_url: tpl.image_url || '' });
    setShowAddTpl(true);
  };

  const saveTemplate = () => {
    if (!tplForm.name.trim() || !tplForm.variable.trim() || !tplForm.amount.trim()) {
      toast.error('Fill in name, variable, and amount.'); return;
    }
    let updated;
    if (editingTpl) {
      updated = templates.map(t => t.id === editingTpl.id ? { ...tplForm, id: editingTpl.id } : t);
      toast.success('Template updated');
    } else {
      updated = [...templates, { ...tplForm, id: Date.now().toString() }];
      toast.success('Template saved');
    }
    persistTemplates(updated);
    setShowAddTpl(false);
    setTplForm(emptyTemplate);
    setEditingTpl(null);
  };

  const deleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id);
    persistTemplates(updated);
    if (selectedTpl?.id === id) { setSelectedTpl(null); setFormData(emptyForm); }
  };

  const selectTemplate = (tpl) => {
    setSelectedTpl(tpl);
    setFormData(f => ({ ...f, variable: tpl.variable, amount: tpl.amount }));
  };

  const clearTemplate = () => {
    setSelectedTpl(null);
    setFormData(f => ({ ...f, variable: '', amount: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/projects/${selectedProject.slug}/items/send`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Sent ${formData.amount}× ${formData.variable} to ${formData.uid}`);
      setFormData(f => ({ ...f, uid: '' }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send items');
    } finally { setLoading(false); }
  };

  if (!selectedProject) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] p-8 text-center">
          <Package size={32} className="mx-auto mb-3 text-zinc-300 dark:text-[#71717a]" />
          <p className="text-sm text-[#71717a]">Select a project to send items.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">

      {/* ── PREDEFINED TEMPLATES ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a3c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={15} className="text-[#4ECDC4]" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Predefined Items</span>
            <span className="text-xs text-[#71717a]">— click to pre-fill the form</span>
          </div>
          <button onClick={openAddTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4ECDC4]/10 hover:bg-[#4ECDC4]/20 text-[#4ECDC4] border border-[#4ECDC4]/30 rounded-lg text-xs font-semibold transition-all">
            <Plus size={12} />Add Template
          </button>
        </div>

        {/* Template form */}
        {showAddTpl && (
          <div className="p-4 border-b border-zinc-200 dark:border-[#2a2a3c] bg-slate-50 dark:bg-[#1c1c2e]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex items-start gap-3">
                {/* Image preview / upload */}
                <div className="shrink-0">
                  <div className="w-14 h-14 rounded-xl border-2 border-dashed border-zinc-300 dark:border-[#2a2a3c] overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-[#0d0d14] relative group cursor-pointer">
                    {tplForm.image_url
                      ? <img src={tplForm.image_url.startsWith('/') ? `${API_URL}${tplForm.image_url}` : tplForm.image_url} alt="" className="w-full h-full object-cover" />
                      : <Upload size={16} className="text-zinc-400" />
                    }
                    <label className="absolute inset-0 cursor-pointer opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/40 transition-opacity rounded-xl">
                      <Upload size={14} className="text-white" />
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => uploadFile(e, url => setTplForm(f => ({ ...f, image_url: url })))} />
                    </label>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <input type="text" value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))}
                    className={inputClass} placeholder="Template name (e.g. 100 Gold)" />
                  <input type="text" value={tplForm.image_url} onChange={e => setTplForm(f => ({ ...f, image_url: e.target.value }))}
                    className={inputClass} placeholder="Image URL (or use upload above)" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Variable</label>
                <input type="text" value={tplForm.variable} onChange={e => setTplForm(f => ({ ...f, variable: e.target.value }))}
                  className={inputClass} placeholder="gold, wood, skin_dragon…" />
              </div>
              <div>
                <label className={labelClass}>Amount</label>
                <input type="text" value={tplForm.amount} onChange={e => setTplForm(f => ({ ...f, amount: e.target.value }))}
                  className={inputClass} placeholder="100, legendary, true…" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={saveTemplate}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg text-sm font-semibold transition-all">
                <Save size={13} />{editingTpl ? 'Update' : 'Save Template'}
              </button>
              <button onClick={() => { setShowAddTpl(false); setTplForm(emptyTemplate); setEditingTpl(null); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-600 dark:text-[#71717a] rounded-lg text-sm font-semibold transition-all">
                <X size={13} />Cancel
              </button>
            </div>
          </div>
        )}

        {/* Template grid */}
        <div className="p-4">
          {templates.length === 0 ? (
            <p className="text-sm text-[#71717a] text-center py-4">
              No templates yet. Add one to speed up item delivery.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {templates.map(tpl => {
                const isSelected = selectedTpl?.id === tpl.id;
                return (
                  <div key={tpl.id}
                    className={`relative group rounded-xl border-2 cursor-pointer overflow-hidden transition-all ${isSelected ? 'border-[#4ECDC4] shadow-[0_0_0_3px_rgba(78,205,196,0.15)]' : 'border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/50'}`}
                    onClick={() => isSelected ? clearTemplate() : selectTemplate(tpl)}>
                    {/* Image */}
                    <div className="h-20 bg-slate-100 dark:bg-[#1c1c2e] flex items-center justify-center overflow-hidden">
                      {tpl.image_url
                        ? <img src={tpl.image_url.startsWith('/') ? `${API_URL}${tpl.image_url}` : tpl.image_url} alt={tpl.name} className="w-full h-full object-cover" />
                        : <Package size={24} className="text-zinc-300 dark:text-[#2a2a3c]" />
                      }
                    </div>
                    {/* Info */}
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-[#e4e4e7] truncate">{tpl.name}</p>
                      <p className="text-[11px] text-[#71717a] truncate">{tpl.amount}× {tpl.variable}</p>
                    </div>
                    {/* Selected badge */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#4ECDC4] flex items-center justify-center">
                        <span className="text-[10px] text-white font-black">✓</span>
                      </div>
                    )}
                    {/* Action buttons on hover */}
                    <div className="absolute top-1.5 left-1.5 hidden group-hover:flex gap-1">
                      <button onClick={e => { e.stopPropagation(); openEditTemplate(tpl); }}
                        className="w-6 h-6 rounded-md bg-white/90 dark:bg-[#151520]/90 flex items-center justify-center text-zinc-500 hover:text-[#6C5CE7] transition-colors">
                        <Edit2 size={10} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteTemplate(tpl.id); }}
                        className="w-6 h-6 rounded-md bg-white/90 dark:bg-[#151520]/90 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SEND FORM ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a3c] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F2994A] to-[#EB5757] flex items-center justify-center shrink-0">
            <Send size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Send to Player</p>
            {selectedTpl && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-[#4ECDC4] font-medium">Template: {selectedTpl.name}</span>
                <button onClick={clearTemplate} className="text-[#71717a] hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={10} /></button>
              </div>
            )}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4" data-testid="send-items-form">
          <div>
            <label className={labelClass}>Player UID</label>
            <input type="text" value={formData.uid} onChange={e => setFormData({ ...formData, uid: e.target.value })}
              className={inputClass} placeholder="player_12345" required data-testid="uid-input" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Variable {selectedTpl && <span className="text-[#4ECDC4] normal-case font-normal">(from template)</span>}</label>
              <input type="text" value={formData.variable} onChange={e => setFormData({ ...formData, variable: e.target.value })}
                className={inputClass} placeholder="wood, gold, skin…" required data-testid="variable-input" />
            </div>
            <div>
              <label className={labelClass}>Amount {selectedTpl && <span className="text-[#4ECDC4] normal-case font-normal">(from template)</span>}</label>
              <input type="text" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className={inputClass} placeholder="10, legendary…" required data-testid="amount-input" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-3 text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="send-items-submit">
            <Send size={15} />{loading ? 'Sending…' : `Send to ${formData.uid || 'player'}`}
          </button>
        </form>
      </div>
    </div>
  );
};
