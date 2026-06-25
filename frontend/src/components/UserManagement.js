import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Users, Edit2, Trash2, Save, X, Gamepad2, Package, Activity, Database,
  FileText, Code, Shield, ShoppingBag, ClipboardList, Ban, CheckCircle, Mail,
} from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState } from '../ui';

const STATIC_GROUPS = [
  {
    label: 'Items', icon: Package, color: '#F2994A',
    permissions: [
      { id: 'send_items', label: 'Send Items' },
      { id: 'delete_items', label: 'Delete Items' },
    ]
  },
  {
    label: 'Server', icon: Activity, color: '#27AE60',
    permissions: [{ id: 'change_status', label: 'Change Status' }]
  },
  {
    label: 'Variables', icon: Database, color: '#2F80ED',
    permissions: [
      { id: 'view_variables', label: 'View Variables' },
      { id: 'create_variables', label: 'Create Variables' },
      { id: 'edit_variables', label: 'Edit Variables' },
      { id: 'delete_variables', label: 'Delete Variables' },
    ]
  },
  {
    label: 'Logs & Docs', icon: FileText, color: '#9B51E0',
    permissions: [
      { id: 'view_logs', label: 'View Logs' },
      { id: 'view_api_docs', label: 'View API Docs' },
    ]
  },
  {
    label: 'Users', icon: Shield, color: '#EB5757',
    permissions: [{ id: 'manage_users', label: 'Manage Users' }]
  },
  {
    label: 'Website', icon: Code, color: '#4ECDC4',
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
    label: 'Shop', icon: ShoppingBag, color: '#6C5CE7',
    permissions: [{ id: 'manage_shop', label: 'Manage Shop' }]
  },
  {
    label: 'Missions', icon: ClipboardList, color: '#A29BFE',
    permissions: [
      { id: 'create_missions', label: 'Post Missions' },
      { id: 'claim_missions', label: 'Claim Missions' },
      { id: 'manage_missions', label: 'Manage Missions' },
    ]
  },
];

const buildPermissionGroups = (projects = []) => [
  {
    label: 'Projects', icon: Gamepad2, color: '#6C5CE7',
    permissions: [
      { id: 'view_all_projects', label: 'All Projects' },
      ...projects.map(p => ({ id: `project:${p.slug}`, label: p.name })),
      { id: 'create_projects', label: 'Create Projects' },
      { id: 'delete_projects', label: 'Delete Projects' },
    ]
  },
  ...STATIC_GROUPS,
];

export const UserManagement = () => {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const permissionGroups = buildPermissionGroups(projectsList);
  const ALL_PERMISSIONS = permissionGroups.flatMap(g => g.permissions.map(p => p.id));

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  useEffect(() => {
    fetchUsers();
    fetchProjectsList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    try {
      const r = await api.get('/api/users');
      setUsers(r.data.users || []);
    } catch { /* silent */ }
  };

  const fetchProjectsList = async () => {
    try {
      const r = await api.get('/api/projects');
      setProjectsList(r.data.projects || []);
    } catch { /* silent */ }
  };

  const handleUpdatePermissions = async (userId) => {
    setLoading(true);
    try {
      await api.put(`/api/users/${userId}/permissions`, { permissions: editingUser.permissions });
      toast.success('Permissions updated');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (user) => {
    showConfirm({
      title: 'Delete user',
      description: `"${user.username}" will be permanently deleted and lose all access.`,
      onConfirm: async () => {
        await api.delete(`/api/users/${user.id}`);
        toast.success('User deleted');
        fetchUsers();
      },
    });
  };

  const handleSuspend = (user, suspend) => {
    showConfirm({
      title: suspend ? 'Suspend user' : 'Reactivate user',
      description: suspend
        ? `"${user.username}" will be suspended and blocked from signing in.`
        : `"${user.username}" will be able to sign in again.`,
      onConfirm: async () => {
        await api.patch(`/api/users/${user.id}/suspend`, { suspended: suspend });
        toast.success(suspend ? 'User suspended' : 'User reactivated');
        fetchUsers();
      },
    });
  };

  const toggleEditPermission = (permId) => {
    setEditingUser(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

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

  const renderPermissionGrid = (selectedPerms, onToggle) => (
    <div className="space-y-3">
      {permissionGroups.map((group) => {
        const Icon = group.icon;
        const allSelected = group.permissions.every(p => selectedPerms.includes(p.id));
        return (
          <div key={group.label} className="border border-zinc-200 dark:border-[#2a2a3c] rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-[#111118] border-b border-zinc-200 dark:border-[#2a2a3c]">
              <Icon size={13} style={{ color: group.color }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  if (allSelected) {
                    group.permissions.forEach(p => { if (selectedPerms.includes(p.id)) onToggle(p.id); });
                  } else {
                    group.permissions.forEach(p => { if (!selectedPerms.includes(p.id)) onToggle(p.id); });
                  }
                }}
                className="text-[10px] font-semibold text-[#71717a] hover:text-zinc-900 dark:hover:text-[#e4e4e7] uppercase"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="p-2 flex flex-wrap gap-2">
              {group.permissions.map((perm) => (
                <label
                  key={perm.id}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all text-sm ${
                    selectedPerms.includes(perm.id)
                      ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]'
                      : 'border-zinc-200 dark:border-[#2a2a3c] bg-zinc-100 dark:bg-[#0d0d14] text-[#71717a] hover:bg-zinc-100 dark:hover:bg-[#1c1c2e]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(perm.id)}
                    onChange={() => onToggle(perm.id)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="max-w-6xl">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F2994A18' }}>
                <Users size={16} style={{ color: '#F2994A' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">User Management</h3>
                <p className="text-xs text-[#71717a]">Manage accounts, permissions, and suspension</p>
              </div>
            </div>
          </CardHeader>

          <CardBody>
            <p className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest mb-4">
              Users ({users.length})
            </p>
            <div className="space-y-3" data-testid="users-list">
              {users.length === 0 && (
                <EmptyState icon={Users} title="No users yet" description="Users who register on the site will appear here." />
              )}
              {users.map((user) => {
                const isEditing = editingUser?.id === user.id;
                const isSelf = currentUser?.id === user.id;
                const isSuperAdmin = user.role === 'super_admin';
                const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';

                return (
                  <div
                    key={user.id}
                    className={`bg-zinc-50 dark:bg-[#111118] border rounded-xl transition-all ${
                      user.isSuspended
                        ? 'border-red-200 dark:border-red-900/40'
                        : 'border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/20'
                    }`}
                    data-testid={`user-card-${user.username}`}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                            user.isSuspended ? 'bg-red-100 text-red-500' : 'bg-[#4ECDC4]/10 text-[#4ECDC4]'
                          }`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-zinc-900 dark:text-[#e4e4e7] text-sm">
                                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                              </span>
                              <span className="text-xs text-[#71717a]">@{user.username}</span>
                              {isSuperAdmin && (
                                <span className="text-[10px] font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-1.5 py-0.5 rounded">
                                  Super Admin
                                </span>
                              )}
                              {user.isSuspended && (
                                <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                                  Suspended
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] font-semibold text-[#A8A29E] bg-zinc-100 dark:bg-[#1c1c2e] px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Mail size={10} className="text-[#A8A29E]" />
                              <span className="text-xs text-[#71717a] truncate">{user.email}</span>
                            </div>
                            <div className="text-xs text-[#A8A29E] mt-0.5">
                              {user.permissions?.length || 0} permission(s)
                              {user.lastLogin && ` · Last login ${new Date(user.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            </div>
                          </div>
                        </div>

                        {!isEditing && !isSuperAdmin && !isSelf && (
                          <div className="flex gap-1.5 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Edit2}
                              onClick={() => setEditingUser({ ...user })}
                              data-testid={`edit-user-${user.username}`}
                            />
                            {user.isSuspended ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={CheckCircle}
                                onClick={() => handleSuspend(user, false)}
                                data-testid={`reactivate-user-${user.username}`}
                                title="Reactivate"
                              />
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Ban}
                                onClick={() => handleSuspend(user, true)}
                                data-testid={`suspend-user-${user.username}`}
                                title="Suspend"
                              />
                            )}
                            <Button
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              onClick={() => handleDeleteUser(user)}
                              data-testid={`delete-user-${user.username}`}
                            />
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div>
                          <p className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest mb-3">
                            Edit Permissions ({editingUser.permissions.length}/{ALL_PERMISSIONS.length})
                          </p>
                          {renderPermissionGrid(editingUser.permissions, toggleEditPermission)}
                          <div className="flex gap-2 mt-4">
                            <Button icon={Save} loading={loading} onClick={() => handleUpdatePermissions(user.id)}>Save</Button>
                            <Button variant="secondary" icon={X} onClick={() => setEditingUser(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {isSuperAdmin ? (
                            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-[#4ECDC4]/10 text-[#4ECDC4]">
                              All permissions
                            </span>
                          ) : (user.permissions || []).length === 0 ? (
                            <span className="text-xs text-[#A8A29E]">No permissions assigned</span>
                          ) : (
                            (user.permissions || []).map((perm) => {
                              const { label, color } = getPermLabel(perm);
                              return (
                                <span
                                  key={perm}
                                  className="px-2 py-1 rounded-full text-[10px] font-semibold"
                                  style={{ backgroundColor: `${color}15`, color }}
                                >
                                  {label}
                                </span>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={dialog.open}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={dialog.title}
        description={dialog.description}
        confirmLabel="Confirm"
        loading={confirmLoading}
        variant="destructive"
      />
    </>
  );
};
