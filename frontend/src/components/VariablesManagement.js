import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Database, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';

export const VariablesManagement = () => {
  const { token, hasPermission } = useAuth();
  const { selectedProject } = useProject();
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVar, setEditingVar] = useState(null);
  const [form, setForm] = useState({ variable_name: '', values: [''] });
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => { if (selectedProject) fetchVars(); /* eslint-disable-next-line */ }, [selectedProject]);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const fetchVars = async () => {
    try {
      const r = await api.get(`/api/projects/${selectedProject.slug}/variables`);
      setVariables(r.data.variables);
    } catch (e) {}
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post(`/api/projects/${selectedProject.slug}/variables`, { variable_name: form.variable_name, values: form.values.filter(v => v.trim()) });
      toast.success('Variable created'); setForm({ variable_name: '', values: [''] }); setShowForm(false); fetchVars();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } finally { setLoading(false); }
  };

  const handleUpdate = async (name) => {
    setLoading(true);
    try {
      await api.put(`/api/projects/${selectedProject.slug}/variables/${name}`, { values: editingVar.values.filter(v => v.trim()) });
      toast.success('Updated'); setEditingVar(null); fetchVars();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); } finally { setLoading(false); }
  };

  const handleDelete = (name) => {
    showConfirm({
      title: 'Delete variable',
      description: `"${name}" and all its values will be permanently deleted.`,
      onConfirm: async () => {
        await api.delete(`/api/projects/${selectedProject.slug}/variables/${name}`);
        toast.success('Deleted');
        fetchVars();
      },
    });
  };

  return (
    <div className="max-w-5xl">
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2F80ED] to-[#2D9CDB] flex items-center justify-center"><Database size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-zinc-900 dark:text-[#e4e4e7]">Variables</h3><p className="text-xs text-[#71717a]">Manage project variables</p></div>
          </div>
          {hasPermission('create_variables') && <button onClick={() => setShowForm(!showForm)} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2" data-testid="create-variable-button">{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Cancel' : 'New Variable'}</button>}
        </div>

        {showForm && (
          <div className="p-6 bg-slate-50 dark:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c]">
            <form onSubmit={handleCreate} data-testid="create-variable-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Name</label>
                  <input type="text" value={form.variable_name} onChange={e => setForm({ ...form, variable_name: e.target.value })} className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none" required data-testid="variable-name-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Values</label>
                  {form.values.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input type="text" value={v} onChange={e => setForm(p => ({ ...p, values: p.values.map((x, j) => j === i ? e.target.value : x) }))} className="flex-1 bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none" data-testid={`value-input-${i}`} />
                      {form.values.length > 1 && <button type="button" onClick={() => setForm(p => ({ ...p, values: p.values.filter((_, j) => j !== i) }))} className="px-3 py-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                  <button type="button" onClick={() => setForm(p => ({ ...p, values: [...p.values, ''] }))} className="text-sm text-[#4ECDC4] flex items-center gap-1 mt-1"><Plus size={14} />Add value</button>
                </div>
                <button type="submit" disabled={loading} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50" data-testid="submit-variable-button">{loading ? 'Creating...' : 'Create Variable'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#71717a] mb-4 uppercase tracking-wider">Variables ({variables.length})</div>
          {variables.length === 0 ? <div className="text-center py-12 text-[#71717a]">No variables yet.</div> : (
            <div className="space-y-3" data-testid="variables-list">
              {variables.map(v => {
                const isEditing = editingVar?.variable_name === v.variable_name;
                return (
                  <div key={v.variable_name} className="bg-slate-50 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl p-4 hover:border-[#4ECDC4]/20 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div><code className="text-sm font-semibold text-[#2F80ED] font-mono">{v.variable_name}</code><p className="text-xs text-[#71717a] mt-1">{v.values.length} value(s)</p></div>
                      {!isEditing && (
                        <div className="flex gap-2">
                          {hasPermission('edit_variables') && <button onClick={() => setEditingVar({...v})} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg text-[#71717a] hover:text-[#4ECDC4]" data-testid={`edit-variable-${v.variable_name}`}><Edit2 size={14} /></button>}
                          {hasPermission('delete_variables') && <button onClick={() => handleDelete(v.variable_name)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400" data-testid={`delete-variable-${v.variable_name}`}><Trash2 size={14} /></button>}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        {editingVar.values.map((val, i) => (
                          <div key={i} className="flex gap-2">
                            <input type="text" value={val} onChange={e => setEditingVar(p => ({...p, values: p.values.map((x, j) => j === i ? e.target.value : x)}))} className="flex-1 bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2 focus:border-[#4ECDC4] focus:outline-none" />
                            {editingVar.values.length > 1 && <button onClick={() => setEditingVar(p => ({...p, values: p.values.filter((_, j) => j !== i)}))} className="px-3 py-2 border border-zinc-200 dark:border-[#2a2a3c] rounded-lg text-red-400"><Trash2 size={14} /></button>}
                          </div>
                        ))}
                        <button onClick={() => setEditingVar(p => ({...p, values: [...p.values, '']}))} className="text-sm text-[#4ECDC4] flex items-center gap-1"><Plus size={14} />Add</button>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleUpdate(v.variable_name)} disabled={loading} className="bg-[#4ECDC4] text-[#0a0a0f] rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Save size={14} />Save</button>
                          <button onClick={() => setEditingVar(null)} className="bg-slate-50 dark:bg-[#1c1c2e] text-zinc-900 dark:text-[#e4e4e7] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg px-4 py-2 text-sm flex items-center gap-2"><X size={14} />Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {v.values.map((val, i) => <span key={i} className="px-3 py-1.5 bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg text-sm text-zinc-900 dark:text-[#e4e4e7] font-mono">{val}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
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
  );
};
