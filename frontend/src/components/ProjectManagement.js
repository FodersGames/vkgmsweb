import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Gamepad2, Plus, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Input } from '../ui';

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
    <>
    <div className="max-w-4xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#6C5CE718' }}>
              <Gamepad2 size={16} style={{ color: '#6C5CE7' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#e4e4e7]">Projects / Games</h3>
              <p className="text-xs text-[#71717a]">Manage your API projects</p>
            </div>
          </div>
          {hasPermission('create_projects') && (
            <Button icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)} data-testid="create-project-button">
              {showForm ? 'Cancel' : 'New Project'}
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <div className="px-6 py-5 bg-[#F9F7F4] dark:bg-[#111118] border-b border-[#E8E3DB] dark:border-[#2a2a3c]">
            <form onSubmit={handleCreate} data-testid="create-project-form">
              <div className="flex gap-3 items-end">
                <Input
                  label="Project Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="My Game"
                  required
                  wrapperClassName="flex-1"
                  data-testid="project-name-input"
                />
                <Button type="submit" loading={loading} data-testid="submit-project-button">
                  Create
                </Button>
              </div>
            </form>
          </div>
        )}

        <CardBody>
          <p className="text-[11px] font-semibold text-[#A8A29E] dark:text-[#52525b] uppercase tracking-widest mb-4">
            Projects ({projects.length})
          </p>
          {projects.length === 0 ? (
            <EmptyState icon={Gamepad2} title="No projects yet" description="Create your first project to get started." />
          ) : (
            <div className="space-y-2" data-testid="projects-list">
              {projects.map(p => (
                <div
                  key={p.slug}
                  className="flex items-center justify-between p-4 bg-[#F9F7F4] dark:bg-[#111118] border border-[#E8E3DB] dark:border-[#2a2a3c] hover:border-[#6C5CE7]/20 transition-colors"
                  data-testid={`project-card-${p.slug}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#6C5CE718' }}>
                      <Gamepad2 size={16} style={{ color: '#A29BFE' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1C1917] dark:text-[#e4e4e7]">{p.name}</p>
                      <p className="text-xs text-[#71717a] font-mono">slug: {p.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#71717a]">by {p.created_by}</span>
                    {hasPermission('delete_projects') && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDelete(p.slug, p.name)}
                        data-testid={`delete-project-${p.slug}`}
                      />
                    )}
                  </div>
                </div>
              ))}
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
      confirmLabel="Delete project"
      loading={confirmLoading}
      variant="destructive"
    />
    </>
  );
};
