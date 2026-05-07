import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Gamepad2, Plus, Trash2, X } from 'lucide-react';

export const ProjectManagement = () => {
  const { user } = useAuth();
  const { projects, createProject, deleteProject } = useProject();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createProject(name.trim());
      toast.success(`Project "${name}" created`);
      setName('');
      setShowCreateForm(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slug, projectName) => {
    if (!window.confirm(`Delete project "${projectName}" and ALL its data? This cannot be undone.`)) return;
    try {
      await deleteProject(slug);
      toast.success(`Project "${projectName}" deleted`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-xl border border-[#EDE5DB] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE5DB] bg-gradient-to-r from-[#6C5CE7]/5 to-[#A29BFE]/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center shadow-sm">
              <Gamepad2 size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1A1A2E]">Projects / Games</h3>
              <p className="text-xs text-[#8A8A9A]">Manage your API projects</p>
            </div>
          </div>
          {user?.is_super_admin && (
            <button onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white hover:from-[#5B4BD6] hover:to-[#918BEE] rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
              data-testid="create-project-button">
              {showCreateForm ? <X size={16} /> : <Plus size={16} />}
              {showCreateForm ? 'Cancel' : 'New Project'}
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="p-6 bg-[#FBF9F7] border-b border-[#EDE5DB]">
            <form onSubmit={handleCreate} data-testid="create-project-form">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Project Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full border border-[#EDE5DB] bg-white rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/20 focus:border-[#6C5CE7] transition-all"
                    placeholder="My Game Name" required data-testid="project-name-input" />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={loading}
                    className="bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50 shadow-sm"
                    data-testid="submit-project-button">
                    {loading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#8A8A9A] mb-4 uppercase tracking-wider">Projects ({projects.length})</div>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-[#C4B5A5]">
              <Gamepad2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>No projects yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="projects-list">
              {projects.map((project) => (
                <div key={project.slug} className="border border-[#EDE5DB] rounded-xl bg-white hover:shadow-sm transition-all p-4"
                  data-testid={`project-card-${project.slug}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6C5CE7]/10 to-[#A29BFE]/10 flex items-center justify-center">
                        <Gamepad2 size={18} className="text-[#6C5CE7]" />
                      </div>
                      <div>
                        <h4 className="font-medium text-[#1A1A2E]">{project.name}</h4>
                        <p className="text-xs text-[#C4B5A5] font-mono">slug: {project.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#8A8A9A]">by {project.created_by}</span>
                      {user?.is_super_admin && (
                        <button onClick={() => handleDelete(project.slug, project.name)}
                          className="px-3 py-1.5 border border-[#EB5757]/30 hover:bg-[#EB5757] hover:text-white rounded-lg text-[#EB5757] text-sm flex items-center gap-1 transition-all"
                          data-testid={`delete-project-${project.slug}`}>
                          <Trash2 size={14} /> Delete
                        </button>
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
  );
};
