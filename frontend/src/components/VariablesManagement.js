import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import {
  Database, Plus, Edit2, Trash2, Save, X, Search, Globe, Lock,
  Type, Hash, ToggleLeft, List as ListIcon, Braces, RefreshCw,
} from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Badge, Input, Textarea, Select, EmptyState } from '../ui';

const TYPE_META = {
  string:  { label: 'Text',    icon: Type,     badge: 'info'    },
  number:  { label: 'Number',  icon: Hash,     badge: 'blue'    },
  boolean: { label: 'Boolean', icon: ToggleLeft, badge: 'purple' },
  list:    { label: 'List',    icon: ListIcon, badge: 'orange'  },
  json:    { label: 'JSON',    icon: Braces,   badge: 'warning' },
};

const emptyDraft = () => ({
  name: '', var_type: 'string', description: '', is_public: true,
  strValue: '', boolValue: false, listValue: [''], jsonValue: '{}',
});

const draftFromVar = (v) => ({
  name: v.name, var_type: v.var_type, description: v.description || '', is_public: v.is_public,
  strValue: v.var_type === 'number' ? String(v.value ?? '') : (v.var_type === 'string' ? (v.value ?? '') : ''),
  boolValue: v.var_type === 'boolean' ? !!v.value : false,
  listValue: v.var_type === 'list' && Array.isArray(v.value) && v.value.length ? v.value : [''],
  jsonValue: v.var_type === 'json' ? JSON.stringify(v.value ?? {}, null, 2) : '{}',
});

const buildValuePayload = (draft) => {
  switch (draft.var_type) {
    case 'string':  return draft.strValue;
    case 'number': {
      const n = Number(draft.strValue);
      if (draft.strValue.trim() === '' || Number.isNaN(n)) throw new Error('Enter a valid number');
      return n;
    }
    case 'boolean': return draft.boolValue;
    case 'list':    return draft.listValue.map(v => v.trim()).filter(Boolean);
    case 'json': {
      try { return JSON.parse(draft.jsonValue); }
      catch { throw new Error('Invalid JSON'); }
    }
    default: return draft.strValue;
  }
};

const formatValuePreview = (v) => {
  if (v.var_type === 'boolean') return v.value ? 'true' : 'false';
  if (v.var_type === 'list') return Array.isArray(v.value) && v.value.length ? v.value.join(', ') : '(empty)';
  if (v.var_type === 'json') return JSON.stringify(v.value);
  return String(v.value ?? '');
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

// ── Value editor — swaps input type based on the selected var_type ──────────
const ValueEditor = ({ draft, setDraft }) => {
  const patch = (p) => setDraft(d => ({ ...d, ...p }));

  if (draft.var_type === 'boolean') {
    return (
      <div>
        <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Value</p>
        <Button
          variant={draft.boolValue ? 'accent' : 'secondary'}
          onClick={() => patch({ boolValue: !draft.boolValue })}
          type="button"
        >
          {draft.boolValue ? 'TRUE' : 'FALSE'}
        </Button>
      </div>
    );
  }

  if (draft.var_type === 'list') {
    return (
      <div>
        <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Values</p>
        {draft.listValue.map((v, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input
              value={v}
              onChange={e => patch({ listValue: draft.listValue.map((x, j) => j === i ? e.target.value : x) })}
              wrapperClassName="flex-1"
            />
            {draft.listValue.length > 1 && (
              <Button variant="danger" size="sm" icon={Trash2} type="button"
                onClick={() => patch({ listValue: draft.listValue.filter((_, j) => j !== i) })} />
            )}
          </div>
        ))}
        <button type="button" onClick={() => patch({ listValue: [...draft.listValue, ''] })}
          className="text-sm text-[#4ECDC4] flex items-center gap-1.5 mt-1 hover:text-[#45b8b0] transition-colors">
          <Plus size={13} />Add value
        </button>
      </div>
    );
  }

  if (draft.var_type === 'json') {
    let jsonError = '';
    try { JSON.parse(draft.jsonValue); } catch { jsonError = 'Invalid JSON'; }
    return (
      <Textarea
        label="Value (JSON)"
        rows={6}
        value={draft.jsonValue}
        onChange={e => patch({ jsonValue: e.target.value })}
        error={jsonError}
        className="font-mono"
      />
    );
  }

  if (draft.var_type === 'number') {
    return (
      <Input
        label="Value"
        type="number"
        value={draft.strValue}
        onChange={e => patch({ strValue: e.target.value })}
      />
    );
  }

  return (
    <Input
      label="Value"
      value={draft.strValue}
      onChange={e => patch({ strValue: e.target.value })}
    />
  );
};

const VisibilityToggle = ({ isPublic, onChange }) => (
  <div>
    <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Visibility</p>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border transition-colors ${
          isPublic ? 'bg-[#4ECDC4]/10 border-[#4ECDC4] text-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] hover:border-[#BFBFC4]'
        }`}
      >
        <Globe size={13} /> Public — readable in-game
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold border transition-colors ${
          !isPublic ? 'bg-[#F2994A]/10 border-[#F2994A] text-[#F2994A]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] hover:border-[#BFBFC4]'
        }`}
      >
        <Lock size={13} /> Private — dashboard only
      </button>
    </div>
  </div>
);

export const VariablesManagement = () => {
  const { hasPermission } = useAuth();
  const { selectedProject } = useProject();
  const [variables, setVariables] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyDraft());
  const [editingName, setEditingName] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [dialog, setDialog]       = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchVars = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/projects/${selectedProject.slug}/variables`);
      setVariables(r.data.variables || []);
    } catch { toast.error('Failed to load variables'); }
    finally { setLoading(false); }
  }, [selectedProject]);

  useEffect(() => { fetchVars(); }, [fetchVars]);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    let value;
    try { value = buildValuePayload(createDraft); }
    catch (err) { toast.error(err.message); return; }
    setSaving(true);
    try {
      await api.post(`/api/projects/${selectedProject.slug}/variables`, {
        name: createDraft.name.trim(), var_type: createDraft.var_type, value,
        description: createDraft.description, is_public: createDraft.is_public,
      });
      toast.success('Variable created');
      setCreateDraft(emptyDraft());
      setShowForm(false);
      fetchVars();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create variable'); }
    finally { setSaving(false); }
  };

  const startEdit = (v) => { setEditingName(v.name); setEditDraft(draftFromVar(v)); };
  const cancelEdit = () => { setEditingName(null); setEditDraft(null); };

  const handleUpdate = async (name) => {
    let value;
    try { value = buildValuePayload(editDraft); }
    catch (err) { toast.error(err.message); return; }
    setSaving(true);
    try {
      await api.put(`/api/projects/${selectedProject.slug}/variables/${encodeURIComponent(name)}`, {
        var_type: editDraft.var_type, value, description: editDraft.description, is_public: editDraft.is_public,
      });
      toast.success('Variable updated');
      cancelEdit();
      fetchVars();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update variable'); }
    finally { setSaving(false); }
  };

  const handleDelete = (name) => {
    showConfirm({
      title: 'Delete variable',
      description: `"${name}" will be permanently deleted. Any game reading it will stop receiving a value.`,
      onConfirm: async () => {
        await api.delete(`/api/projects/${selectedProject.slug}/variables/${encodeURIComponent(name)}`);
        toast.success('Deleted');
        fetchVars();
      },
    });
  };

  const filtered = variables.filter(v => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return v.name.toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q);
  });

  if (!selectedProject) return null;

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-lg w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center">
              <Database size={20} className="text-[#4ECDC4]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Server Variables</h1>
              <p className="text-xs text-[#A1A1A6]">
                {variables.length} variable{variables.length !== 1 ? 's' : ''} — live config the running game can read
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchVars}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#111118] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {hasPermission('create_variables') && (
              <Button icon={showForm ? X : Plus} onClick={() => setShowForm(v => !v)} data-testid="create-variable-button">
                {showForm ? 'Cancel' : 'New Variable'}
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6]" />
          <input
            type="text"
            placeholder="Search by name or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] bg-white dark:bg-[#0d0d14] text-[#1D1D1F] dark:text-[#e4e4e7]"
          />
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5" data-testid="create-variable-form">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  value={createDraft.name}
                  onChange={e => setCreateDraft(d => ({ ...d, name: e.target.value }))}
                  required
                  data-testid="variable-name-input"
                />
                <Select
                  label="Type"
                  value={createDraft.var_type}
                  onChange={e => setCreateDraft(d => ({ ...d, var_type: e.target.value }))}
                >
                  {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </Select>
              </div>
              <ValueEditor draft={createDraft} setDraft={setCreateDraft} />
              <Textarea
                label="Description (optional)"
                rows={2}
                value={createDraft.description}
                onChange={e => setCreateDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="What is this variable used for?"
              />
              <VisibilityToggle isPublic={createDraft.is_public} onChange={v => setCreateDraft(d => ({ ...d, is_public: v }))} />
              <Button type="submit" loading={saving} icon={Plus} data-testid="submit-variable-button">
                Create Variable
              </Button>
            </form>
          </div>
        )}

        {/* List */}
        {variables.length === 0 && !loading ? (
          <EmptyState icon={Database} title="No server variables yet" description="Create one to push live config to your running game — no rebuild needed." />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#A1A1A6] text-center py-10">No variable matches "{search}".</p>
        ) : (
          <div className="space-y-3" data-testid="variables-list">
            {filtered.map(v => {
              const isEditing = editingName === v.name;
              const meta = TYPE_META[v.var_type] || TYPE_META.string;
              const TypeIcon = meta.icon;
              return (
                <div key={v.name} className="bg-white dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] p-4 hover:border-[#4ECDC4]/30 transition-colors">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] font-mono">{v.name}</code>
                        <Badge variant={meta.badge}><TypeIcon size={11} />{meta.label}</Badge>
                        {v.is_public ? (
                          <Badge variant="success"><Globe size={11} />Public</Badge>
                        ) : (
                          <Badge variant="orange"><Lock size={11} />Private</Badge>
                        )}
                      </div>
                      {v.description && <p className="text-xs text-[#6E6E73] mt-1">{v.description}</p>}
                      <p className="text-[11px] text-[#A1A1A6] mt-1">
                        Updated {fmtDate(v.updated_at)}{v.updated_by ? ` by ${v.updated_by}` : ''}
                      </p>
                    </div>
                    {!isEditing && (
                      <div className="flex gap-1.5 shrink-0">
                        {hasPermission('edit_variables') && (
                          <Button variant="secondary" size="sm" icon={Edit2} onClick={() => startEdit(v)} data-testid={`edit-variable-${v.name}`} />
                        )}
                        {hasPermission('delete_variables') && (
                          <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(v.name)} data-testid={`delete-variable-${v.name}`} />
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-4 pt-2 border-t border-[#D2D2D7] dark:border-[#2a2a3c]">
                      <Select
                        label="Type"
                        value={editDraft.var_type}
                        onChange={e => setEditDraft(d => ({ ...d, var_type: e.target.value }))}
                      >
                        {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                      </Select>
                      <ValueEditor draft={editDraft} setDraft={setEditDraft} />
                      <Textarea
                        label="Description"
                        rows={2}
                        value={editDraft.description}
                        onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                      />
                      <VisibilityToggle isPublic={editDraft.is_public} onChange={val => setEditDraft(d => ({ ...d, is_public: val }))} />
                      <div className="flex gap-2">
                        <Button icon={Save} loading={saving} onClick={() => handleUpdate(v.name)}>Save</Button>
                        <Button variant="secondary" icon={X} onClick={cancelEdit}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 font-mono text-xs text-[#1D1D1F] dark:text-[#e4e4e7] break-all">
                      {formatValuePreview(v)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
