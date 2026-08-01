import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Package, Send, Plus, Trash2, X, Save, Upload, Edit2 } from 'lucide-react';
import { Button, Card, CardHeader, CardBody, EmptyState, Input } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = (slug) => `item_templates_${slug}`;

const emptyTemplate = { name: '', variable: '', amount: '', image_url: '' };
const emptyForm = { uid: '', variable: '', amount: '' };

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

  const openAddTemplate = () => { setEditingTpl(null); setTplForm(emptyTemplate); setShowAddTpl(true); };
  const openEditTemplate = (tpl) => { setEditingTpl(tpl); setTplForm({ name: tpl.name, variable: tpl.variable, amount: tpl.amount, image_url: tpl.image_url || '' }); setShowAddTpl(true); };

  const saveTemplate = () => {
    if (!tplForm.name.trim() || !tplForm.variable.trim() || !tplForm.amount.trim()) { toast.error('Fill in name, variable, and amount.'); return; }
    let updated;
    if (editingTpl) { updated = templates.map(t => t.id === editingTpl.id ? { ...tplForm, id: editingTpl.id } : t); toast.success('Template updated'); }
    else { updated = [...templates, { ...tplForm, id: Date.now().toString() }]; toast.success('Template saved'); }
    persistTemplates(updated); setShowAddTpl(false); setTplForm(emptyTemplate); setEditingTpl(null);
  };

  const deleteTemplate = (id) => {
    persistTemplates(templates.filter(t => t.id !== id));
    if (selectedTpl?.id === id) { setSelectedTpl(null); setFormData(emptyForm); }
  };

  const selectTemplate = (tpl) => { setSelectedTpl(tpl); setFormData(f => ({ ...f, variable: tpl.variable, amount: tpl.amount })); };
  const clearTemplate = () => { setSelectedTpl(null); setFormData(f => ({ ...f, variable: '', amount: '' })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/items/send`, formData, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Sent ${formData.amount}× ${formData.variable} to ${formData.uid}`);
      setFormData(f => ({ ...f, uid: '' }));
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to send items'); }
    finally { setLoading(false); }
  };

  if (!selectedProject) {
    return (
      <div className="max-w-3xl">
        <Card>
          <EmptyState icon={Package} title="No project selected" description="Select a project to send items." />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">

      {/* Templates */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg w-8 h-8 flex items-center justify-center" style={{ backgroundColor: '#4ECDC418' }}>
              <Package size={14} style={{ color: '#4ECDC4' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Predefined Items</p>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">Click to pre-fill the form</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={openAddTemplate}>
            Add Template
          </Button>
        </CardHeader>

        {showAddTpl && (
          <div className="px-5 py-4 bg-[#F5F5F7] dark:bg-[#111118] border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex items-start gap-3">
                <div className="shrink-0">
                  <div className="rounded-lg w-14 h-14 border-2 border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden flex items-center justify-center bg-[#EDEDEF] dark:bg-[#0d0d14] relative group cursor-pointer">
                    {tplForm.image_url
                      ? <img src={tplForm.image_url.startsWith('/') ? `${API_URL}${tplForm.image_url}` : tplForm.image_url} alt="" className="w-full h-full object-cover" />
                      : <Upload size={16} className="text-[#A1A1A6] dark:text-[#71717a]" />}
                    <label className="absolute inset-0 cursor-pointer opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/40 transition-opacity">
                      <Upload size={14} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, url => setTplForm(f => ({ ...f, image_url: url })))} />
                    </label>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Input value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} placeholder="Template name (e.g. 100 Gold)" />
                  <Input value={tplForm.image_url} onChange={e => setTplForm(f => ({ ...f, image_url: e.target.value }))} placeholder="Image URL (or upload above)" />
                </div>
              </div>
              <Input label="Variable" value={tplForm.variable} onChange={e => setTplForm(f => ({ ...f, variable: e.target.value }))} placeholder="gold, wood, skin_dragon…" />
              <Input label="Amount" value={tplForm.amount} onChange={e => setTplForm(f => ({ ...f, amount: e.target.value }))} placeholder="100, legendary, true…" />
            </div>
            <div className="flex gap-2 mt-3">
              <Button icon={Save} onClick={saveTemplate}>{editingTpl ? 'Update' : 'Save Template'}</Button>
              <Button variant="secondary" icon={X} onClick={() => { setShowAddTpl(false); setTplForm(emptyTemplate); setEditingTpl(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        <CardBody>
          {templates.length === 0 ? (
            <EmptyState icon={Package} title="No templates yet" description="Add one to speed up item delivery." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {templates.map(tpl => {
                const isSelected = selectedTpl?.id === tpl.id;
                return (
                  <div key={tpl.id}
                    className={`relative group border-2 cursor-pointer overflow-hidden transition-all ${isSelected ? 'border-[#4ECDC4] shadow-[0_0_0_3px_rgba(78,205,196,0.1)]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4]/50'}`}
                    onClick={() => isSelected ? clearTemplate() : selectTemplate(tpl)}>
                    <div className="h-20 bg-[#EDEDEF] dark:bg-[#111118] flex items-center justify-center overflow-hidden">
                      {tpl.image_url
                        ? <img src={tpl.image_url.startsWith('/') ? `${API_URL}${tpl.image_url}` : tpl.image_url} alt={tpl.name} className="w-full h-full object-cover" />
                        : <Package size={22} className="text-[#BFBFC4] dark:text-[#2a2a3c]" />}
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{tpl.name}</p>
                      <p className="text-[11px] text-[#6E6E73] dark:text-[#a1a1aa] truncate">{tpl.amount}× {tpl.variable}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#4ECDC4] flex items-center justify-center">
                        <span className="text-[10px] text-[#0a0a0f] font-bold">✓</span>
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 hidden group-hover:flex gap-1">
                      <button onClick={e => { e.stopPropagation(); openEditTemplate(tpl); }} className="w-6 h-6 rounded-md bg-white/90 dark:bg-[#151520]/90 flex items-center justify-center text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#6C5CE7] transition-colors"><Edit2 size={10} /></button>
                      <button onClick={e => { e.stopPropagation(); deleteTemplate(tpl.id); }} className="w-6 h-6 rounded-md bg-white/90 dark:bg-[#151520]/90 flex items-center justify-center text-[#6E6E73] dark:text-[#a1a1aa] hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Send form */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg w-8 h-8 flex items-center justify-center" style={{ backgroundColor: '#F2994A18' }}>
              <Send size={14} style={{ color: '#F2994A' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Send to Player</p>
              {selectedTpl && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-[#4ECDC4] font-medium">Template: {selectedTpl.name}</span>
                  <button onClick={clearTemplate} className="text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#3A3A3C] dark:hover:text-white transition-colors"><X size={10} /></button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="send-items-form">
            <Input
              label="Player UID"
              value={formData.uid}
              onChange={e => setFormData({ ...formData, uid: e.target.value })}
              placeholder="player_12345"
              required
              autoFocus
              data-testid="uid-input"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={selectedTpl ? 'Variable (from template)' : 'Variable'}
                value={formData.variable}
                onChange={e => setFormData({ ...formData, variable: e.target.value })}
                placeholder="wood, gold, skin…"
                required
                data-testid="variable-input"
              />
              <Input
                label={selectedTpl ? 'Amount (from template)' : 'Amount'}
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="10, legendary…"
                required
                data-testid="amount-input"
              />
            </div>
            <Button type="submit" loading={loading} className="w-full justify-center" icon={Send} data-testid="send-items-submit">
              {loading ? 'Sending…' : `Send to ${formData.uid || 'player'}`}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
