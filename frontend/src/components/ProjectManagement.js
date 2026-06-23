import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Gamepad2, Plus, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

export const ProjectManagement = () => {
  const { user, hasPermission } = useAuth();
  const { projects, createProject, deleteProject } = useProject();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try { await createProject(name.trim()); toast.success(`Project "${name}" created`); setName(''); setShowForm(false); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = (slug, n) => {
    showConfirm({
      title: 'Delete project',
      description: `"${n}" and ALL its data (items, logs, variables, missions, chat) will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        await deleteProject(slug);
        toast.success(`"${n}" deleted`);
      },
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center"><Gamepad2 size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-zinc-900 dark:text-[#e4e4e7]">Projects / Games</h3><p className="text-xs text-[#71717a]">Manage your API projects</p></div>
          </div>
          {hasPermission('create_projects') && (
            <button onClick={() => setShowForm(!showForm)} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2" data-testid="create-project-button">
              {showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Cancel' : 'New Project'}
            </button>
          )}
        </div>

        {showForm && (
          <div className="p-6 bg-slate-50 dark:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c]">
            <form onSubmit={handleCreate} data-testid="create-project-form">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Project Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none" required data-testid="project-name-input" />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={loading} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50" data-testid="submit-project-button">{loading ? 'Creating...' : 'Create'}</button>
                </div>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#71717a] mb-4 uppercase tracking-wider">Projects ({projects.length})</div>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-[#71717a]"><Gamepad2 size={36} className="mx-auto mb-3 opacity-30" /><p>No projects yet.</p></div>
          ) : (
            <div className="space-y-3" data-testid="projects-list">
              {projects.map(p => (
                <div key={p.slug} className="bg-slate-50 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl p-4 hover:border-[#4ECDC4]/20 transition-all" data-testid={`project-card-${p.slug}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center"><Gamepad2 size={18} className="text-[#A29BFE]" /></div>
                      <div><h4 className="font-medium text-zinc-900 dark:text-[#e4e4e7]">{p.name}</h4><p className="text-xs text-[#71717a] font-mono">slug: {p.slug}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#71717a]">by {p.created_by}</span>
                      {hasPermission('delete_projects') && (
                        <button onClick={() => handleDelete(p.slug, p.name)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400 transition-all" data-testid={`delete-project-${p.slug}`}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
      confirmLabel="Delete project"
      loading={confirmLoading}
      variant="destructive"
    />
  );
};
