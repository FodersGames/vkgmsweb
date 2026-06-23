import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Users, Plus, Edit2, Trash2, Save, X, Copy, Gamepad2, Package, Activity, Database, FileText, Code, Shield, Globe, ShoppingBag, ClipboardList, MessageSquare } from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';

// Static groups (everything except Projects which is built dynamically)
const STATIC_GROUPS = [
  {
    label: 'Items',
    icon: Package,
    color: '#F2994A',
    permissions: [
      { id: 'send_items', label: 'Send Items' },
      { id: 'delete_items', label: 'Delete Items' },
    ]
  },
  {
    label: 'Server',
    icon: Activity,
    color: '#27AE60',
    permissions: [
      { id: 'change_status', label: 'Change Status' },
    ]
  },
  {
    label: 'Variables',
    icon: Database,
    color: '#2F80ED',
    permissions: [
      { id: 'view_variables', label: 'View Variables' },
      { id: 'create_variables', label: 'Create Variables' },
      { id: 'edit_variables', label: 'Edit Variables' },
      { id: 'delete_variables', label: 'Delete Variables' },
    ]
  },
  {
    label: 'Logs & Docs',
    icon: FileText,
    color: '#9B51E0',
    permissions: [
      { id: 'view_logs', label: 'View Logs' },
      { id: 'view_api_docs', label: 'View API Docs' },
    ]
  },
  {
    label: 'Users',
    icon: Shield,
    color: '#EB5757',
    permissions: [
      { id: 'manage_users', label: 'Manage Users' },
    ]
  },
  {
    label: 'Website',
    icon: Code,
    color: '#4ECDC4',
    permissions: [
      { id: 'manage_website', label: 'Website Settings' },
      { id: 'create_games', label: 'Create Games' },
      { id: 'edit_games', label: 'Edit Games' },
      { id: 'delete_games', label: 'Delete Games' },
      { id: 'create_blog', label: 'Create Blog' },
      { id: 'edit_blog', label: 'Edit Blog' },
      { id: 'delete_blog', label: 'Delete Blog' },
      { id: 'manage_chat', label: 'Manage Game Chat' },
    ]
  },
  {
    label: 'Shop',
    icon: ShoppingBag,
    color: '#6C5CE7',
    permissions: [
      { id: 'manage_shop', label: 'Manage Shop' },
    ]
  },
  {
    label: 'Missions',
    icon: ClipboardList,
    color: '#A29BFE',
    permissions: [
      { id: 'create_missions', label: 'Post Mission Requests', desc: 'Can create new mission requests for the team' },
      { id: 'claim_missions',  label: 'Claim Missions',        desc: 'Can take on missions and mark them complete' },
      { id: 'manage_missions', label: 'Manage All Missions',   desc: 'Can edit, delete or reassign any mission (admin-level)' },
    ]
  },
];

// Build full permission groups with dynamic per-project entries
const buildPermissionGroups = (projects = []) => [
  {
    label: 'Projects',
    icon: Gamepad2,
    color: '#6C5CE7',
    permissions: [
      { id: 'view_all_projects', label: 'All Projects', desc: 'Access to every project (current and future)' },
      ...projects.map(p => ({ id: `project:${p.slug}`, label: p.name, desc: `Access to ${p.name} only` })),
      { id: 'create_projects', label: 'Create Projects' },
      { id: 'delete_projects', label: 'Delete Projects' },
    ]
  },
  ...STATIC_GROUPS,
];

export const UserManagement = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', permissions: [] });
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

  // Derived: permission groups with dynamic per-project entries
  const permissionGroups = buildPermissionGroups(projectsList);
  const ALL_PERMISSIONS = permissionGroups.flatMap(g => g.permissions.map(p => p.id));

  useEffect(() => {
    fetchUsers();
    fetchProjectsList();
    // eslint-disable-next-line
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get(`/api/users`);
      setUsers(response.data.users);
    } catch (error) {}
  };

  const fetchProjectsList = async () => {
    try {
      const r = await api.get(`/api/projects`);
      setProjectsList(r.data.projects || []);
    } catch { /* non-blocking */ }
  };

  const togglePermission = (permId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const toggleEditPermission = (permId) => {
    setEditingUser(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const selectAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [...ALL_PERMISSIONS] }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [] }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post(`/api/users`, formData);
      setCreatedUser(response.data);
      toast.success(`User ${formData.username} created`);
      setFormData({ username: '', permissions: [] });
      setShowCreateForm(false);
      fetchUsers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create user'); }
    finally { setLoading(false); }
  };

  const handleUpdatePermissions = async (username) => {
    setLoading(true);
    try {
      await api.put(`/api/users/${username}/permissions`, { permissions: editingUser.permissions });
      toast.success('Permissions updated');
      setEditingUser(null);
      fetchUsers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to update'); }
    finally { setLoading(false); }
  };

  const handleDeleteUser = (username) => {
    showConfirm({
      title: 'Delete user',
      description: `"${username}" will be permanently deleted and lose access to the dashboard.`,
      onConfirm: async () => {
        await api.delete(`/api/users/${username}`);
        toast.success('User deleted');
        fetchUsers();
      },
    });
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };

  const renderPermissionGrid = (selectedPerms, onToggle) => (
    <div className="space-y-4">
      {permissionGroups.map((group) => {
        const Icon = group.icon;
        const allSelected = group.permissions.every(p => selectedPerms.includes(p.id));
        return (
          <div key={group.label} className="border border-zinc-200 dark:border-[#2a2a3c] rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c]">
              <Icon size={14} style={{ color: group.color }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</span>
              <div className="flex-1"></div>
              <button type="button" onClick={() => {
                if (allSelected) {
                  group.permissions.forEach(p => {
                    if (selectedPerms.includes(p.id)) onToggle(p.id);
                  });
                } else {
                  group.permissions.forEach(p => {
                    if (!selectedPerms.includes(p.id)) onToggle(p.id);
                  });
                }
              }} className="text-[10px] font-semibold text-[#71717a] hover:text-zinc-900 dark:text-[#e4e4e7] uppercase">
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="p-2 flex flex-wrap gap-2">
              {group.permissions.map((perm) => (
                <label key={perm.id} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all text-sm ${
                  selectedPerms.includes(perm.id)
                    ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]'
                    : 'border-zinc-200 dark:border-[#2a2a3c] bg-slate-100 dark:bg-[#0d0d14] text-[#71717a] hover:bg-slate-100 dark:hover:bg-[#1c1c2e]'
                }`}>
                  <input type="checkbox" checked={selectedPerms.includes(perm.id)} onChange={() => onToggle(perm.id)}
                    className="w-3.5 h-3.5 rounded" />
                  <span title={perm.desc || undefined}>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const getPermLabel = (permId) => {
    if (permId.startsWith('project:')) {
      const slug = permId.split(':')[1];
      const proj = projectsList.find(p => p.slug === slug);
      return { label: proj ? proj.name : slug, color: '#6C5CE7' };
    }
    for (const group of permissionGroups) {
      const p = group.permissions.find(pp => pp.id === permId);
      if (p) return { label: p.label, color: group.color };
    }
    return { label: permId, color: '#8A8A9A' };
  };

  return (
    <>
    <div className="max-w-6xl">
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F2994A] to-[#F2C94C] flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-[#e4e4e7]">User Management</h3>
              <p className="text-xs text-[#71717a]">Create and manage user accounts with granular permissions</p>
            </div>
          </div>
          <button onClick={() => { setShowCreateForm(!showCreateForm); setCreatedUser(null); }}
            className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"
            data-testid="create-user-button">
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Cancel' : 'Create User'}
          </button>
        </div>

        {showCreateForm && (
          <div className="p-6 bg-slate-50 dark:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c]">
            <form onSubmit={handleCreateUser} data-testid="create-user-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Username</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none"
                    required data-testid="username-input" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Permissions ({formData.permissions.length}/{ALL_PERMISSIONS.length})</div>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPermissions} className="text-xs text-[#4ECDC4] hover:underline">Select All</button>
                      <span className="text-[#2a2a3c]">|</span>
                      <button type="button" onClick={clearAllPermissions} className="text-xs text-red-400 hover:underline">Clear All</button>
                    </div>
                  </div>
                  {renderPermissionGrid(formData.permissions, togglePermission)}
                </div>
                <button type="submit" disabled={loading || formData.permissions.length === 0}
                  className="w-full bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                  data-testid="create-user-submit">
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {createdUser && (
          <div className="mx-6 mt-6 p-4 border border-[#4ECDC4]/30 bg-[#4ECDC4]/5 rounded-xl" data-testid="created-user-info">
            <div className="text-sm font-medium text-[#4ECDC4] mb-3">User created successfully</div>
            <div className="space-y-2 text-sm">
              <div><span className="text-xs font-semibold text-[#71717a]">USERNAME:</span><span className="ml-2 text-zinc-900 dark:text-[#e4e4e7]">{createdUser.username}</span></div>
              <div>
                <span className="text-xs font-semibold text-[#71717a]">ACCESS KEY:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-slate-100 dark:bg-[#0d0d14] border border-[#4ECDC4]/30 text-zinc-900 dark:text-[#e4e4e7] text-xs rounded-lg break-all font-mono">{createdUser.access_key}</code>
                  <button onClick={() => copyToClipboard(createdUser.access_key)} className="p-2 border border-[#4ECDC4]/30 bg-slate-50 dark:bg-[#1c1c2e] hover:bg-[#4ECDC4]/10 rounded-lg" data-testid="copy-access-key"><Copy size={16} className="text-[#4ECDC4]" /></button>
                </div>
              </div>
              <div className="text-xs text-[#71717a] mt-2">Save this key now. It will not be shown again.</div>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#71717a] mb-4 uppercase tracking-wider">Users ({users.length})</div>
          <div className="space-y-3" data-testid="users-list">
            {users.length === 0 && (
              <div className="text-center py-12 text-[#71717a]">No users yet. Create one to get started.</div>
            )}
            {users.map((user) => {
              const isEditing = editingUser?.username === user.username;
              return (
                <div key={user.username} className="bg-slate-50 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl hover:border-[#4ECDC4]/20 transition-all">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-9 h-9 rounded-full bg-[#4ECDC4]/10 flex items-center justify-center text-sm font-semibold text-[#4ECDC4]">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-[#e4e4e7]">{user.username}</div>
                          <div className="text-xs text-[#71717a]">Created by {user.created_by} &bull; {user.permissions?.length || 0} permission(s)</div>
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="flex gap-2">
                          <button onClick={() => setEditingUser({ ...user })}
                            className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg text-[#71717a] hover:text-[#4ECDC4] transition-all"
                            data-testid={`edit-user-${user.username}`}><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteUser(user.username)}
                            className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400 transition-all"
                            data-testid={`delete-user-${user.username}`}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div>
                        <div className="text-xs font-semibold text-[#8A8A9A] mb-3 uppercase tracking-wider">Edit Permissions</div>
                        {renderPermissionGrid(editingUser.permissions, toggleEditPermission)}
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => handleUpdatePermissions(user.username)} disabled={loading}
                            className="bg-gradient-to-r from-[#F2994A] to-[#EB5757] text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm">
                            <Save size={14} />Save</button>
                          <button onClick={() => setEditingUser(null)}
                            className="bg-white text-[#1A1A2E] border border-[#EDE5DB] hover:bg-[#FBF9F7] rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
                            <X size={14} />Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(user.permissions || []).map((perm) => {
                          const { label, color } = getPermLabel(perm);
                          return (
                            <span key={perm} className="px-2 py-1 rounded-full text-[10px] font-semibold"
                              style={{ backgroundColor: `${color}15`, color }}>
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      isOpen={dialog.open}
      onClose={closeConfirm}
      onConfirm={handleConfirm}
      title={dialog.title}
      description={dialog.description}
      confirmLabel="Delete user"
      loading={confirmLoading}
      variant="destructive"
    />
    </>
  );
};
