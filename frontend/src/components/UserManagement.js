import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Users, Edit2, Trash2, Save, X, Gamepad2, Package, Activity, Database,
  FileText, Code, Shield, ShoppingBag, ClipboardList, Ban, CheckCircle, Mail,
  Search, SlidersHorizontal, Trophy, Loader2, MessageCircle, Clipboard, ClipboardCheck,
  FolderOpen, Server, Terminal,
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
    label: 'Files', icon: FolderOpen, color: '#E67E22',
    permissions: [{ id: 'manage_files', label: 'Manage Project Files' }]
  },
  {
    label: 'Infrastructure', icon: Server, color: '#16A085',
    permissions: [{ id: 'view_vps', label: 'View VPS Stats' }]
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
    label: 'Support', icon: MessageCircle, color: '#F59E0B',
    permissions: [{ id: 'manage_tickets', label: 'Manage Support Tickets' }]
  },
  {
    label: 'Missions', icon: ClipboardList, color: '#A29BFE',
    permissions: [
      { id: 'create_missions', label: 'Post Missions' },
      { id: 'claim_missions', label: 'Claim Missions' },
      { id: 'manage_missions', label: 'Manage Missions' },
    ]
  },
  {
    label: 'In-Game Tools', icon: Terminal, color: '#16A085',
    permissions: [
      { id: 'game_dev_panel', label: 'Game Dev Panel (in-game)' },
      { id: 'game_logs_panel', label: 'Game Logs Panel (in-game)' },
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

  const [search, setSearch] = useState('');
  const [onlyWithPerms, setOnlyWithPerms] = useState(false);
  const [loyaltyUser, setLoyaltyUser] = useState(null);
  const [loyaltyAmount, setLoyaltyAmount] = useState('');
  const [loyaltyReason, setLoyaltyReason] = useState('');
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyResult, setLoyaltyResult] = useState(null);
  const [copiedUserId, setCopiedUserId] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', firstName: '', lastName: '', username: '', role: 'user', permissions: [] });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  const permissionGroups = buildPermissionGroups(projectsList);
  const ALL_PERMISSIONS = permissionGroups.flatMap(g => g.permissions.map(p => p.id));

  const filteredUsers = useMemo(() => {
    let result = users;
    if (onlyWithPerms) {
      result = result.filter(u =>
        u.role === 'super_admin' || u.role === 'admin' || (u.permissions && u.permissions.length > 0)
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(u =>
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, search, onlyWithPerms]);

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

  const handleLoyaltyAdjust = async (e) => {
    e.preventDefault();
    if (!loyaltyUser || !loyaltyAmount) return;
    setLoyaltyLoading(true);
    setLoyaltyResult(null);
    try {
      const r = await api.patch(`/api/admin/users/${loyaltyUser.id}/loyalty`, {
        adjust_dollars: parseFloat(loyaltyAmount),
        reason: loyaltyReason,
      });
      setLoyaltyResult(r.data);
      toast.success(`Loyalty adjusted → ${r.data.new_tier}`);
      setLoyaltyAmount('');
      setLoyaltyReason('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to adjust loyalty');
    } finally {
      setLoyaltyLoading(false);
    }
  };

  const copyUserData = async (userId) => {
    try {
      const r = await api.get(`/api/admin/users/${userId}/export`);
      await navigator.clipboard.writeText(JSON.stringify(r.data, null, 2));
      setCopiedUserId(userId);
      setTimeout(() => setCopiedUserId(null), 2500);
    } catch {
      toast.error('Failed to copy user data');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateResult(null);
    try {
      const r = await api.post('/api/admin/users/create', createForm);
      setCreateResult({ success: true, ...r.data });
      setCreateForm({ email: '', password: '', firstName: '', lastName: '', username: '', role: 'user', permissions: [] });
      fetchUsers();
    } catch (err) {
      setCreateResult({ success: false, error: err.response?.data?.detail || 'Failed to create user' });
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleCreatePermission = (permId) => {
    setCreateForm(f => ({
      ...f,
      permissions: f.permissions.includes(permId)
        ? f.permissions.filter(p => p !== permId)
        : [...f.permissions, permId],
    }));
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
          <div key={group.label} className="border border-[#E8E3DB] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F9F7F4] border-b border-[#E8E3DB]">
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
                className="text-[10px] font-semibold text-[#A8A29E] hover:text-[#1C1917] uppercase"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="p-2 flex flex-wrap gap-2">
              {group.permissions.map((perm) => (
                <label
                  key={perm.id}
                  className={`flex items-center gap-2 px-3 py-2 border cursor-pointer transition-all text-sm ${
                    selectedPerms.includes(perm.id)
                      ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]'
                      : 'border-[#E8E3DB] bg-[#F9F7F4] text-[#78716C] hover:border-[#C9C3BB] hover:text-[#1C1917]'
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#F2994A18' }}>
                  <Users size={16} style={{ color: '#F2994A' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1917]">User Management</h3>
                  <p className="text-xs text-[#A8A29E]">Manage accounts, permissions, and suspension</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setShowCreateUser(v => !v); setCreateResult(null); }}
              >
                {showCreateUser ? 'Cancel' : '+ Add user'}
              </Button>
            </div>

            {/* Create user panel */}
            {showCreateUser && (
              <div className="mt-4 p-4 bg-[#F9F7F4] border border-[#E8E3DB]">
                <p className="text-xs font-bold text-[#1C1917] mb-3">Create user account</p>
                {createResult?.success ? (
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-[#22C55E]">✓ User created — @{createResult.username}</p>
                    {createResult.generated_password && (
                      <p className="text-[#78716C]">Generated password: <strong className="text-[#1C1917] font-mono">{createResult.generated_password}</strong> (send to user securely)</p>
                    )}
                    <button onClick={() => setCreateResult(null)} className="text-[#4ECDC4] hover:underline mt-1">Create another</button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A8A29E] mb-1">Email *</label>
                        <input type="email" required value={createForm.email}
                          onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                          placeholder="user@example.com" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A8A29E] mb-1">Password (leave blank = auto-generate)</label>
                        <input type="text" value={createForm.password}
                          onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917] font-mono"
                          placeholder="auto-generated" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A8A29E] mb-1">First name</label>
                        <input type="text" maxLength={50} value={createForm.firstName}
                          onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                          placeholder="Optional" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A8A29E] mb-1">Last name</label>
                        <input type="text" maxLength={50} value={createForm.lastName}
                          onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                          placeholder="Optional" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A8A29E] mb-1">Username (leave blank = auto)</label>
                        <input type="text" maxLength={32} value={createForm.username}
                          onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                          placeholder="auto-generated" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A8A29E] mb-1">Role</label>
                        <select value={createForm.role}
                          onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]">
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    {/* Permissions */}
                    <div>
                      <label className="block text-[10px] font-semibold text-[#A8A29E] mb-2">Permissions</label>
                      <div className="flex flex-wrap gap-1.5">
                        {permissionGroups.flatMap(g => g.permissions).map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleCreatePermission(p.id)}
                            className={`text-[10px] px-2 py-0.5 border transition-colors ${
                              createForm.permissions.includes(p.id)
                                ? 'bg-[#4ECDC4]/10 border-[#4ECDC4]/40 text-[#4ECDC4]'
                                : 'bg-white border-[#E8E3DB] text-[#A8A29E] hover:border-[#C9C3BB]'
                            }`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {createResult?.error && <p className="text-xs text-red-500">{createResult.error}</p>}
                    <Button type="submit" size="sm" disabled={createLoading}>
                      {createLoading ? 'Creating…' : 'Create account'}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </CardHeader>

          <CardBody>
            {/* Search + filter bar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, username, or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]"
                />
              </div>
              <button
                onClick={() => setOnlyWithPerms(v => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border transition-all shrink-0 ${
                  onlyWithPerms
                    ? 'bg-[#4ECDC4]/10 border-[#4ECDC4]/30 text-[#4ECDC4]'
                    : 'bg-[#F9F7F4] border-[#E8E3DB] text-[#78716C] hover:border-[#4ECDC4]/30 hover:text-[#4ECDC4]'
                }`}
              >
                <SlidersHorizontal size={12} />
                With permissions
              </button>
            </div>

            <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-4">
              Users ({filteredUsers.length}{filteredUsers.length !== users.length ? ` / ${users.length}` : ''})
            </p>
            <div className="space-y-3" data-testid="users-list">
              {filteredUsers.length === 0 && (
                <EmptyState icon={Users} title={search || onlyWithPerms ? 'No users match your filters' : 'No users yet'} description={search || onlyWithPerms ? 'Try adjusting the search or filter.' : 'Users who register on the site will appear here.'} />
              )}
              {filteredUsers.map((user) => {
                const isEditing = editingUser?.id === user.id;
                const isSelf = currentUser?.id === user.id;
                const isSuperAdmin = user.role === 'super_admin';
                const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';

                return (
                  <div
                    key={user.id}
                    className={`bg-white border transition-all ${
                      user.isSuspended
                        ? 'border-red-200'
                        : 'border-[#E8E3DB] hover:border-[#C9C3BB]'
                    }`}
                    data-testid={`user-card-${user.username}`}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 flex items-center justify-center text-sm font-semibold shrink-0 ${
                            user.isSuspended ? 'bg-red-50 text-red-400' : 'bg-[#4ECDC4]/10 text-[#4ECDC4]'
                          }`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[#1C1917] text-sm">
                                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                              </span>
                              <span className="text-xs text-[#A8A29E]">@{user.username}</span>
                              {isSuperAdmin && (
                                <span className="text-[10px] font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-1.5 py-0.5">
                                  Super Admin
                                </span>
                              )}
                              {user.isSuspended && (
                                <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5">
                                  Suspended
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] font-semibold text-[#A8A29E] bg-[#F9F7F4] px-1.5 py-0.5">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Mail size={10} className="text-[#A8A29E]" />
                              <span className="text-xs text-[#78716C] truncate">{user.email}</span>
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
                              icon={copiedUserId === user.id ? ClipboardCheck : Clipboard}
                              onClick={() => copyUserData(user.id)}
                              title="Copy user data (GDPR export)"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Trophy}
                              onClick={() => { setLoyaltyUser(user); setLoyaltyResult(null); setLoyaltyAmount(''); setLoyaltyReason(''); }}
                              title="Adjust loyalty"
                            />
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
                          <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-3">
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

                    {loyaltyUser?.id === user.id && (
                      <div className="mt-3 pt-3 border-t border-[#E8E3DB]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold text-[#F59E0B] tracking-widest uppercase flex items-center gap-1.5">
                            <Trophy size={10} /> Loyalty Adjustment
                          </p>
                          <button onClick={() => { setLoyaltyUser(null); setLoyaltyResult(null); }} className="text-[10px] text-[#A8A29E] hover:text-[#1C1917]">✕ Close</button>
                        </div>
                        {loyaltyResult && (
                          <div className="text-xs bg-[#22C55E]/10 text-[#22C55E] px-3 py-2 mb-2 border border-[#22C55E]/20">
                            {loyaltyResult.previous_tier} → <strong>{loyaltyResult.new_tier}</strong> · Total: ${(loyaltyResult.new_total_cents / 100).toFixed(2)}
                          </div>
                        )}
                        <form onSubmit={handleLoyaltyAdjust} className="flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="block text-[10px] text-[#A8A29E] mb-1">Amount ($) — use − for removal</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={loyaltyAmount}
                              onChange={e => setLoyaltyAmount(e.target.value)}
                              placeholder="+10.00 or -5.00"
                              className="w-32 px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#F59E0B] bg-white text-[#1C1917]"
                            />
                          </div>
                          <div className="flex-1 min-w-32">
                            <label className="block text-[10px] text-[#A8A29E] mb-1">Reason (optional)</label>
                            <input
                              type="text"
                              value={loyaltyReason}
                              onChange={e => setLoyaltyReason(e.target.value)}
                              placeholder="e.g. compensation"
                              className="w-full px-2 py-1.5 text-xs border border-[#E8E3DB] focus:outline-none focus:border-[#F59E0B] bg-white text-[#1C1917]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loyaltyLoading || !loyaltyAmount}
                            className="flex items-center gap-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-white px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {loyaltyLoading ? <Loader2 size={11} className="animate-spin" /> : <Trophy size={11} />}
                            Apply
                          </button>
                        </form>
                      </div>
                    )}
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
