import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Database, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Input } from '../ui';

export const VariablesManagement = () => {
  const { hasPermission } = useAuth();
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
    <>
    <div className="max-w-5xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4ECDC418' }}>
              <Database size={16} style={{ color: '#4ECDC4' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Variables</h3>
              <p className="text-xs text-gray-500">Manage project variables</p>
            </div>
          </div>
          {hasPermission('create_variables') && (
            <Button icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)} data-testid="create-variable-button">
              {showForm ? 'Cancel' : 'New Variable'}
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <div className="px-6 py-5 bg-gray-50 border-b border-gray-200">
            <form onSubmit={handleCreate} data-testid="create-variable-form">
              <div className="space-y-4">
                <Input
                  label="Name"
                  value={form.variable_name}
                  onChange={e => setForm({ ...form, variable_name: e.target.value })}
                  required
                  data-testid="variable-name-input"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Values</p>
                  {form.values.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input
                        value={v}
                        onChange={e => setForm(p => ({ ...p, values: p.values.map((x, j) => j === i ? e.target.value : x) }))}
                        wrapperClassName="flex-1"
                        data-testid={`value-input-${i}`}
                      />
                      {form.values.length > 1 && (
                        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setForm(p => ({ ...p, values: p.values.filter((_, j) => j !== i) }))} />
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setForm(p => ({ ...p, values: [...p.values, ''] }))} className="text-sm text-brand-400 flex items-center gap-1.5 mt-1 hover:text-[#45b8b0] transition-colors">
                    <Plus size={13} />Add value
                  </button>
                </div>
                <Button type="submit" loading={loading} data-testid="submit-variable-button">
                  Create Variable
                </Button>
              </div>
            </form>
          </div>
        )}

        <CardBody>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Variables ({variables.length})
          </p>
          {variables.length === 0 ? (
            <EmptyState icon={Database} title="No variables yet" description="Create your first variable to manage project data." />
          ) : (
            <div className="space-y-3" data-testid="variables-list">
              {variables.map(v => {
                const isEditing = editingVar?.variable_name === v.variable_name;
                return (
                  <div key={v.variable_name} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-brand-400/20 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <code className="text-sm font-semibold text-[#2F80ED] font-mono">{v.variable_name}</code>
                        <p className="text-xs text-gray-500 mt-0.5">{v.values.length} value(s)</p>
                      </div>
                      {!isEditing && (
                        <div className="flex gap-1.5">
                          {hasPermission('edit_variables') && (
                            <Button variant="secondary" size="sm" icon={Edit2} onClick={() => setEditingVar({...v})} data-testid={`edit-variable-${v.variable_name}`} />
                          )}
                          {hasPermission('delete_variables') && (
                            <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(v.variable_name)} data-testid={`delete-variable-${v.variable_name}`} />
                          )}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        {editingVar.values.map((val, i) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              value={val}
                              onChange={e => setEditingVar(p => ({...p, values: p.values.map((x, j) => j === i ? e.target.value : x)}))}
                              wrapperClassName="flex-1"
                            />
                            {editingVar.values.length > 1 && (
                              <Button variant="danger" size="sm" icon={Trash2} onClick={() => setEditingVar(p => ({...p, values: p.values.filter((_, j) => j !== i)}))} />
                            )}
                          </div>
                        ))}
                        <button onClick={() => setEditingVar(p => ({...p, values: [...p.values, '']}))} className="text-sm text-brand-400 flex items-center gap-1.5 hover:text-[#45b8b0] transition-colors">
                          <Plus size={13} />Add
                        </button>
                        <div className="flex gap-2 mt-3">
                          <Button icon={Save} loading={loading} onClick={() => handleUpdate(v.variable_name)}>Save</Button>
                          <Button variant="secondary" icon={X} onClick={() => setEditingVar(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {v.values.map((val, i) => (
                          <span key={i} className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 font-mono">
                            {val}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
