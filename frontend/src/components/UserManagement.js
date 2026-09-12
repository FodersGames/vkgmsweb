import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Users, UserCheck, UserX, Shield, Crown,
  Edit2, Trash2, Save, X, Gamepad2, FileText, Code, ClipboardList,
  Ban, CheckCircle, Mail, Search, Loader2, MessageCircle, Clipboard,
  ClipboardCheck, Terminal, ChevronLeft, ChevronRight, RotateCcw, Check,
  Calendar, Clock, Key, Ticket,
} from 'lucide-react';

import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Skeleton, Select, DensityToggle, useDensity, Badge } from '../ui';

export const PERMISSION_GROUPS = [
  {
    label: 'Users & Roles',
    icon: Shield,
    color: '#EB5757',
    permissions: [
      { id: 'manage_users', label: 'Manage Users & Permissions' },
    ],
  },
  {
    label: 'Website CMS & Games',
    icon: Code,
    color: '#FF6600',
    permissions: [
      { id: 'manage_website', label: 'Website Settings & Configuration' },
      { id: 'create_games', label: 'Create Games & Apps' },
      { id: 'edit_games', label: 'Edit Games & Apps' },
      { id: 'delete_games', label: 'Delete Games & Apps' },
      { id: 'create_blog', label: 'Create Blog Posts' },
      { id: 'edit_blog', label: 'Edit Blog Posts' },
      { id: 'delete_blog', label: 'Delete Blog Posts' },
    ],
  },
  {
    label: 'Support Tickets',
    icon: MessageCircle,
    color: '#F59E0B',
    permissions: [
      { id: 'manage_tickets', label: 'Manage Support Tickets & Replies' },
    ],
  },
  {
    label: 'Surveys & Feedback',
    icon: ClipboardList,
    color: '#3B82F6',
    permissions: [
      { id: 'manage_surveys', label: 'Manage Community Surveys' },
    ],
  },
  {
    label: 'Careers / Jobs',
    icon: FileText,
    color: '#10B981',
    permissions: [
      { id: 'manage_careers', label: 'Manage Careers & Job Listings' },
    ],
  },
  {
    label: 'System & Security',
    icon: Terminal,
    color: '#9B51E0',
    permissions: [
      { id: 'view_logs', label: 'View System Audit Logs' },
      { id: 'use_cli', label: 'Access CLI Terminal' },
      { id: 'view_vps', label: 'Monitor VPS Infrastructure' },
    ],
  },
  {
    label: 'In-Game Dev Tools',
    icon: Gamepad2,
    color: '#14B8A6',
    permissions: [
      { id: 'game_dev_panel', label: 'Dino Tycoon Dev Panel' },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.id));

const NAME_COOLDOWN_DAYS = 30;
const PSEUDO_COOLDOWN_DAYS = 7;
const cooldownDaysLeft = (changedAt, cooldownDays) => {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  return Math.max(0, cooldownDays - Math.floor(elapsedMs / 86400000));
};

const fmtDate = (iso) => {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso) => {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const UserManagement = () => {
  const { user: currentUser } = useAuth();

  // ── List state ────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [customRolesList, setCustomRolesList] = useState([]);
  const [customRolesSaving, setCustomRolesSaving] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterSuspended, setFilterSuspended] = useState('');
  const searchRef = useRef(null);
  const [density, setDensity] = useDensity();

  const [selectedIds, setSelectedIds] = useState(new Set());

  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'destructive' });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    name: '',
    username: '',
    role: 'user',
    permissions: [],
    custom_roles: [],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  // ── Detail view state ────────────────────────────────────────────────
  const [activeUser, setActiveUser] = useState(null);
  const [editingPerms, setEditingPerms] = useState(false);
  const [permsDraft, setPermsDraft] = useState([]);
  const [permsLoading, setPermsLoading] = useState(false);

  const [profileForm, setProfileForm] = useState({ name: '', username: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [resettingField, setResettingField] = useState('');

  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);

  // ── List fetch ────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { page, limit: 25 };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterSuspended !== '') params.suspended = filterSuspended;
      const r = await api.get('/api/users', { params });
      setUsers(r.data.users || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch {
      // silent
    } finally {
      setListLoading(false);
    }
  }, [page, search, filterRole, filterSuspended]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [users]);

  useEffect(() => {
    api.get('/api/admin/roles')
      .then(r => setCustomRolesList(r.data.roles || []))
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(t);
  }, [searchInput]);

  // "/" keyboard shortcut to focus search
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== '/' || activeUser || showCreateUser || dialog.open) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeUser, showCreateUser, dialog.open]);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try {
      await dialog.onConfirm();
      setDialog(d => ({ ...d, open: false }));
    } finally {
      setConfirmLoading(false);
    }
  };

  // ── Bulk selection ───────────────────────────────────────────────────
  const selectableUsers = users.filter(u => u.role !== 'super_admin' && u.id !== currentUser?.id);
  const allOnPageSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedIds.has(u.id));
  const toggleSelect = (id) => setSelectedIds(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAllOnPage = () => setSelectedIds(allOnPageSelected ? new Set() : new Set(selectableUsers.map(u => u.id)));

  const bulkSuspend = (suspend) => {
    const ids = [...selectedIds];
    showConfirm({
      title: suspend ? `Suspend ${ids.length} account${ids.length !== 1 ? 's' : ''}` : `Reactivate ${ids.length} account${ids.length !== 1 ? 's' : ''}`,
      description: suspend
        ? 'Selected accounts will immediately lose access and be blocked from signing in.'
        : 'Selected accounts will be unblocked and able to sign in normally.',
      variant: suspend ? 'destructive' : 'accent',
      onConfirm: async () => {
        await Promise.all(ids.map(id => api.patch(`/api/users/${id}/suspend`, { suspended: suspend }).catch(() => {})));
        toast.success(suspend ? `${ids.length} user(s) suspended` : `${ids.length} user(s) reactivated`);
        setSelectedIds(new Set());
        fetchUsers();
      },
    });
  };

  // ── Detail view ──────────────────────────────────────────────────────
  const openUser = (u) => {
    setActiveUser(u);
    setProfileForm({
      name: u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : '') || u.username || '',
      username: u.username || '',
    });
    setProfileError('');
    setEditingPerms(false);
    setPermsDraft(u.permissions || []);
    setCopied(false);
    setActivity(null);
    setActivityLoading(true);
    api.get(`/api/admin/users/${u.id}/export`)
      .then(r => setActivity(r.data))
      .catch(() => setActivity(null))
      .finally(() => setActivityLoading(false));
  };

  const closeUser = () => {
    setActiveUser(null);
    fetchUsers();
  };

  const saveProfileField = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    try {
      const r = await api.patch(`/api/admin/users/${activeUser.id}/profile`, profileForm);
      setActiveUser(u => ({ ...u, ...r.data }));
      setUsers(list => list.map(u => u.id === activeUser.id ? { ...u, ...r.data } : u));
      toast.success('Identity updated successfully');
    } catch (err) {
      setProfileError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const resetCooldown = async (field) => {
    setResettingField(field);
    try {
      await api.post(`/api/admin/users/${activeUser.id}/reset-cooldown`, { field });
      setActiveUser(u => ({
        ...u,
        [field === 'name' ? 'nameChangedAt' : 'usernameChangedAt']: null,
        firstNameChangedAt: null,
      }));
      toast.success(`${field === 'name' ? 'Name' : 'Pseudo'} cooldown cleared`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset cooldown');
    } finally {
      setResettingField('');
    }
  };

  const handleToggleCustomRole = async (role) => {
    if (!activeUser) return;
    const roleId = String(role.id || role._id);
    const currentRoles = (activeUser.custom_roles || []).map(r => String(r));
    const isAssigned = currentRoles.some(r => r === String(role.id) || r === String(role._id));
    const newRoles = isAssigned
      ? currentRoles.filter(r => r !== String(role.id) && r !== String(role._id))
      : [...currentRoles, roleId];

    setCustomRolesSaving(true);
    try {
      await api.put(`/api/admin/users/${activeUser.id}/custom-roles`, { custom_roles: newRoles });
      setActiveUser(u => ({ ...u, custom_roles: newRoles }));
      setUsers(list => list.map(u => u.id === activeUser.id ? { ...u, custom_roles: newRoles } : u));
      toast.success(isAssigned ? `Role removed: ${role.name}` : `Role assigned: ${role.name}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update roles');
    } finally {
      setCustomRolesSaving(false);
    }
  };

  const handleRoleChange = async (newRole) => {
    if (!activeUser || activeUser.role === newRole) return;
    setRoleChanging(true);
    try {
      await api.put(`/api/admin/users/${activeUser.id}/role`, { role: newRole });
      const updatedPerms = newRole === 'super_admin' ? ALL_PERMISSIONS : activeUser.permissions;
      setActiveUser(prev => ({
        ...prev,
        role: newRole,
        permissions: updatedPerms,
        ...(newRole === 'super_admin' ? { isSuspended: false } : {}),
      }));
      setUsers(list => list.map(u => u.id === activeUser.id ? {
        ...u,
        role: newRole,
        permissions: updatedPerms,
        ...(newRole === 'super_admin' ? { isSuspended: false } : {}),
      } : u));
      toast.success(`Role updated to ${newRole === 'super_admin' ? 'Super Admin' : newRole === 'admin' ? 'Admin' : 'User'}`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update user role');
    } finally {
      setRoleChanging(false);
    }
  };

  const handleUpdatePermissions = async () => {
    setPermsLoading(true);
    try {
      await api.put(`/api/users/${activeUser.id}/permissions`, { permissions: permsDraft });
      setActiveUser(u => ({ ...u, permissions: permsDraft }));
      setUsers(list => list.map(u => u.id === activeUser.id ? { ...u, permissions: permsDraft } : u));
      toast.success('Permissions updated successfully');
      setEditingPerms(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update permissions');
    } finally {
      setPermsLoading(false);
    }
  };

  const handleDeleteUser = (u) => {
    showConfirm({
      title: 'Delete account permanently',
      description: `User "${u.username}" (@${u.email}) will be permanently deleted. This action cannot be undone.`,
      variant: 'destructive',
      onConfirm: async () => {
        await api.delete(`/api/users/${u.id}`);
        toast.success(`Account @${u.username} deleted`);
        if (activeUser?.id === u.id) setActiveUser(null);
        fetchUsers();
      },
    });
  };

  const handleSuspend = (u, suspend) => {
    showConfirm({
      title: suspend ? 'Suspend user account' : 'Reactivate user account',
      description: suspend
        ? `"${u.username}" will immediately be logged out and prohibited from logging into the platform.`
        : `"${u.username}" will be permitted to log in and use their account normally.`,
      variant: suspend ? 'destructive' : 'accent',
      onConfirm: async () => {
        await api.patch(`/api/users/${u.id}/suspend`, { suspended: suspend });
        toast.success(suspend ? 'User account suspended' : 'User account reactivated');
        if (activeUser?.id === u.id) setActiveUser(a => ({ ...a, isSuspended: suspend }));
        fetchUsers();
      },
    });
  };

  const copyUserData = async () => {
    try {
      const data = activity || (await api.get(`/api/admin/users/${activeUser.id}/export`)).data;
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast.success('User export copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy user export');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateResult(null);
    try {
      const r = await api.post('/api/admin/users/create', createForm);
      setCreateResult({ success: true, ...r.data });
      setCreateForm({
        email: '',
        password: '',
        name: '',
        username: '',
        role: 'user',
        permissions: [],
        custom_roles: [],
      });
      fetchUsers();
      toast.success('Account created successfully');
    } catch (err) {
      setCreateResult({ success: false, error: err.response?.data?.detail || 'Failed to create user' });
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleCreateCustomRole = (roleId) => {
    setCreateForm(f => ({
      ...f,
      custom_roles: (f.custom_roles || []).includes(roleId)
        ? (f.custom_roles || []).filter(r => r !== roleId)
        : [...(f.custom_roles || []), roleId],
    }));
  };

  const toggleCreatePermission = (permId) => {
    setCreateForm(f => ({
      ...f,
      permissions: f.permissions.includes(permId)
        ? f.permissions.filter(p => p !== permId)
        : [...f.permissions, permId],
    }));
  };

  const getPermMeta = (permId) => {
    for (const group of PERMISSION_GROUPS) {
      const p = group.permissions.find(pp => pp.id === permId);
      if (p) return { label: p.label, color: group.color, groupName: group.label };
    }
    return { label: permId, color: '#A1A1A6', groupName: 'Other' };
  };

  const resolveCustomRole = (rId) => {
    const strId = String(rId);
    return customRolesList.find(r => String(r.id) === strId || String(r._id) === strId);
  };

  const renderPermissionGrid = (selectedPerms, onToggle) => (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => {
        const Icon = group.icon;
        const allSelected = group.permissions.every(p => selectedPerms.includes(p.id));
        return (
          <div
            key={group.label}
            className="rounded-2xl border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden bg-[#FBFBFC] dark:bg-[#111118]/80 transition-colors"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-[#F5F5F7] dark:bg-[#151520] border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${group.color}15` }}
                >
                  <Icon size={13} style={{ color: group.color }} />
                </div>
                <span className="text-xs font-semibold tracking-wide text-[#1D1D1F] dark:text-[#e4e4e7]">
                  {group.label}
                </span>
                <span className="text-[11px] font-medium text-[#A1A1A6] dark:text-[#71717a]">
                  ({group.permissions.filter(p => selectedPerms.includes(p.id)).length}/{group.permissions.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (allSelected) {
                    group.permissions.forEach(p => { if (selectedPerms.includes(p.id)) onToggle(p.id); });
                  } else {
                    group.permissions.forEach(p => { if (!selectedPerms.includes(p.id)) onToggle(p.id); });
                  }
                }}
                className="text-xs font-medium text-[#FF6600] hover:text-[#E05A00] transition-colors"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="p-3 grid sm:grid-cols-2 gap-2">
              {group.permissions.map((perm) => {
                const isChecked = selectedPerms.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-[#FF6600]/40 bg-[#FF6600]/5 dark:bg-[#FF6600]/10 text-[#1D1D1F] dark:text-[#f4f4f5] shadow-sm'
                        : 'border-[#E5E5EA] dark:border-[#242436] bg-white dark:bg-[#151520] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#D2D2D7] dark:hover:border-[#323248]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(perm.id)}
                      className="w-4 h-4 rounded text-[#FF6600] focus:ring-[#FF6600] border-[#D2D2D7] dark:border-[#3a3a4c] mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-tight">{perm.label}</p>
                      <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] font-mono mt-0.5">{perm.id}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (activeUser) {
    const u = activeUser;
    const isSuperAdmin = u.role === 'super_admin';
    const isAdmin = u.role === 'admin';
    const isSelf = currentUser?.id === u.id;
    const displayName = u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username);
    const initials = (u.name?.[0] || u.firstName?.[0] || u.username?.[0] || '?').toUpperCase();
    const nameDaysLeft = cooldownDaysLeft(u.nameChangedAt || u.firstNameChangedAt, NAME_COOLDOWN_DAYS);
    const pseudoDaysLeft = cooldownDaysLeft(u.usernameChangedAt, PSEUDO_COOLDOWN_DAYS);
    const canManageSuperAdmin = currentUser?.is_super_admin;

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={closeUser}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white bg-[#F5F5F7] dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] transition-all"
          >
            <ChevronLeft size={14} /> Back to Users
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#A1A1A6] dark:text-[#71717a] font-mono">
              ID: {u.id}
            </span>
          </div>
        </div>

        {/* Hero Identity Banner */}
        <div className="relative rounded-3xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 md:p-8 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#FF6600]/10 to-purple-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start md:items-center gap-5">
              {/* Avatar with status indicator */}
              <div className="relative">
                <div
                  className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold tracking-tight shrink-0 shadow-inner ${
                    u.isSuspended
                      ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                      : isSuperAdmin
                      ? 'bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/30'
                      : isAdmin
                      ? 'bg-[#6C5CE7]/10 text-[#6C5CE7] border border-[#6C5CE7]/30'
                      : 'bg-zinc-100 dark:bg-[#1d1d2b] text-[#1D1D1F] dark:text-[#e4e4e7] border border-[#D2D2D7] dark:border-[#2a2a3c]'
                  }`}
                >
                  {initials}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#151520] flex items-center justify-center ${
                    u.isSuspended ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  title={u.isSuspended ? 'Account Suspended' : 'Account Active'}
                >
                  {u.isSuspended ? <X size={10} className="text-white" /> : <Check size={10} className="text-white" />}
                </div>
              </div>

              {/* Identity info */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#f4f4f5]">
                    {displayName}
                  </h1>

                  {/* Primary role badge */}
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FF6600]/15 text-[#FF6600] border border-[#FF6600]/30 shadow-sm">
                      <Crown size={12} /> Super Admin
                    </span>
                  )}
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#6C5CE7]/15 text-[#6C5CE7] border border-[#6C5CE7]/30">
                      <Shield size={12} /> Admin
                    </span>
                  )}
                  {!isSuperAdmin && !isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-[#202030] text-[#6E6E73] dark:text-[#a1a1aa] border border-[#D2D2D7] dark:border-[#2a2a3c]">
                      <Users size={12} /> Member
                    </span>
                  )}

                  {u.isSuspended && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/25">
                      <Ban size={12} /> Suspended
                    </span>
                  )}

                  {isSelf && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/25">
                      You
                    </span>
                  )}
                </div>

                <p className="text-xs md:text-sm text-[#6E6E73] dark:text-[#a1a1aa] flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[#1D1D1F] dark:text-[#d4d4d8]">@{u.username}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-[#A1A1A6] dark:text-[#71717a]" />
                    {u.email}
                  </span>
                </p>

                <div className="flex items-center gap-4 text-xs text-[#A1A1A6] dark:text-[#71717a] pt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> Member since {fmtDate(u.createdAt)}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> Last active {fmtDateTime(u.lastLogin)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? ClipboardCheck : Clipboard}
                onClick={copyUserData}
                title="GDPR Export user data"
              >
                {copied ? 'Copied' : 'GDPR Export'}
              </Button>

              {!isSuperAdmin && !isSelf && (
                <>
                  {u.isSuspended ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={CheckCircle}
                      onClick={() => handleSuspend(u, false)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Ban}
                      onClick={() => handleSuspend(u, true)}
                    >
                      Suspend
                    </Button>
                  )}

                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleDeleteUser(u)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* System Role Selector */}
        <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-[#f4f4f5] flex items-center gap-2">
                <Shield size={16} className="text-[#FF6600]" />
                System Role & Platform Access
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">
                Defines the baseline authority level and administrative privileges.
              </p>
            </div>
            {roleChanging && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#FF6600] font-medium">
                <Loader2 size={13} className="animate-spin" /> Saving...
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {/* User card */}
            <button
              type="button"
              disabled={roleChanging || isSelf}
              onClick={() => handleRoleChange('user')}
              className={`text-left p-4 rounded-2xl border transition-all relative ${
                u.role === 'user' || !u.role
                  ? 'border-[#FF6600] bg-[#FF6600]/5 dark:bg-[#FF6600]/10 shadow-sm'
                  : 'border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#FBFBFC] dark:bg-[#111118] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
              } ${isSelf ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <Users size={16} />
                </div>
                {(u.role === 'user' || !u.role) && (
                  <span className="w-5 h-5 rounded-full bg-[#FF6600] text-white flex items-center justify-center text-xs">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#f4f4f5]">Standard User</h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-1 leading-relaxed">
                Standard platform player account. Can view games, participate in community discussions and submit support tickets.
              </p>
            </button>

            {/* Admin card */}
            <button
              type="button"
              disabled={roleChanging || isSelf}
              onClick={() => handleRoleChange('admin')}
              className={`text-left p-4 rounded-2xl border transition-all relative ${
                u.role === 'admin'
                  ? 'border-[#6C5CE7] bg-[#6C5CE7]/5 dark:bg-[#6C5CE7]/10 shadow-sm'
                  : 'border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#FBFBFC] dark:bg-[#111118] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
              } ${isSelf ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-[#6C5CE7]/15 flex items-center justify-center text-[#6C5CE7]">
                  <Shield size={16} />
                </div>
                {u.role === 'admin' && (
                  <span className="w-5 h-5 rounded-full bg-[#6C5CE7] text-white flex items-center justify-center text-xs">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#f4f4f5]">Staff Administrator</h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-1 leading-relaxed">
                Management staff access. Grants admission to dashboard tabs permitted by assigned custom roles or fine-grained permissions.
              </p>
            </button>

            {/* Super Admin card */}
            <button
              type="button"
              disabled={roleChanging || isSelf || !canManageSuperAdmin}
              onClick={() => handleRoleChange('super_admin')}
              className={`text-left p-4 rounded-2xl border transition-all relative ${
                u.role === 'super_admin'
                  ? 'border-[#FF6600] bg-[#FF6600]/5 dark:bg-[#FF6600]/10 shadow-sm'
                  : 'border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#FBFBFC] dark:bg-[#111118] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
              } ${!canManageSuperAdmin || isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-[#FF6600]/15 flex items-center justify-center text-[#FF6600]">
                  <Crown size={16} />
                </div>
                {u.role === 'super_admin' && (
                  <span className="w-5 h-5 rounded-full bg-[#FF6600] text-white flex items-center justify-center text-xs">
                    <Check size={12} />
                  </span>
                )}
                {!canManageSuperAdmin && (
                  <span className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] bg-zinc-200/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded">
                    Super Admin only
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#f4f4f5]">Super Administrator</h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-1 leading-relaxed">
                Full platform root ownership. Automatically grants every permission, system configuration and security settings.
              </p>
            </button>
          </div>
        </div>

        {/* Custom Roles Assignment */}
        <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-[#f4f4f5] flex items-center gap-2">
              <Crown size={16} className="text-[#F59E0B]" />
              Assigned Custom Studio Roles
            </h2>
            {customRolesSaving && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#FF6600] font-medium">
                <Loader2 size={13} className="animate-spin" /> Saving...
              </span>
            )}
          </div>
          <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mb-4">
            Click on any role to assign or unassign it from this user. Custom roles grant badges and defined permissions.
          </p>

          {customRolesList.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#111118] text-center">
              <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">
                No custom roles created yet. Create roles in the Role Management tab.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {customRolesList.map((role) => {
                const isAssigned = (u.custom_roles || []).some(
                  rId => String(rId) === String(role.id) || String(rId) === String(role._id)
                );
                return (
                  <button
                    key={role.id || role._id}
                    type="button"
                    disabled={customRolesSaving}
                    onClick={() => handleToggleCustomRole(role)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all ${
                      isAssigned
                        ? 'shadow-sm'
                        : 'border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#F5F5F7] dark:bg-[#111118] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
                    }`}
                    style={{
                      borderColor: isAssigned ? role.color : undefined,
                      backgroundColor: isAssigned ? `${role.color}15` : undefined,
                      color: isAssigned ? role.color : undefined,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: role.color }}
                    />
                    <span>{role.name}</span>
                    {isAssigned ? (
                      <span className="ml-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-current text-white font-bold">
                        ✓
                      </span>
                    ) : (
                      <span className="text-[11px] opacity-40 ml-0.5">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Permissions Matrix */}
        <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-[#f4f4f5] flex items-center gap-2">
                <Key size={16} className="text-[#10B981]" />
                Fine-Grained Permissions
                {!isSuperAdmin && (
                  <span className="text-xs font-normal text-[#A1A1A6] dark:text-[#71717a]">
                    ({(editingPerms ? permsDraft : u.permissions || []).length} / {ALL_PERMISSIONS.length} active)
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">
                Direct capability flags overriding role defaults.
              </p>
            </div>
            {!isSuperAdmin && !editingPerms && (
              <Button
                variant="secondary"
                size="sm"
                icon={Edit2}
                onClick={() => {
                  setPermsDraft(u.permissions || []);
                  setEditingPerms(true);
                }}
              >
                Edit Permissions
              </Button>
            )}
          </div>

          {isSuperAdmin ? (
            <div className="p-4 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/25 flex items-center gap-3">
              <Crown size={20} className="text-[#FF6600] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#FF6600]">
                  Super Administrator: All platform capabilities unlocked
                </p>
                <p className="text-[11px] text-[#FF6600]/80 mt-0.5">
                  Super administrators implicitly hold all current and future platform permissions.
                </p>
              </div>
            </div>
          ) : editingPerms ? (
            <div className="space-y-4">
              {renderPermissionGrid(permsDraft, (id) =>
                setPermsDraft(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
              )}
              <div className="flex items-center gap-2.5 pt-2">
                <Button icon={Save} loading={permsLoading} onClick={handleUpdatePermissions}>
                  Save Permissions
                </Button>
                <Button variant="secondary" icon={X} onClick={() => setEditingPerms(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (u.permissions || []).length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#111118] text-center">
              <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">
                No explicit permissions assigned to this user.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(u.permissions || []).map((permId) => {
                const meta = getPermMeta(permId);
                return (
                  <span
                    key={permId}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border"
                    style={{
                      backgroundColor: `${meta.color}12`,
                      color: meta.color,
                      borderColor: `${meta.color}30`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Identity & Cooldown Admin Controls + Activity */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Identity Form */}
          <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 shadow-sm">
            <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-[#f4f4f5] mb-1">
              Identity & Cooldown Controls
            </h2>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mb-4">
              Administrative override for profile identity and cooldown resets.
            </p>

            <form onSubmit={saveProfileField} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8]">
                    Display Name
                  </label>
                  {nameDaysLeft > 0 && (
                    <button
                      type="button"
                      onClick={() => resetCooldown('name')}
                      disabled={resettingField === 'name'}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF6600] hover:underline disabled:opacity-50"
                    >
                      <RotateCcw size={11} className={resettingField === 'name' ? 'animate-spin' : ''} />
                      Reset Cooldown ({nameDaysLeft}d left)
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={70}
                  value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] focus:outline-none focus:border-[#FF6600] transition-colors"
                  placeholder="Full name or display name"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8]">
                    Pseudo / Username
                  </label>
                  {pseudoDaysLeft > 0 && (
                    <button
                      type="button"
                      onClick={() => resetCooldown('username')}
                      disabled={resettingField === 'username'}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF6600] hover:underline disabled:opacity-50"
                    >
                      <RotateCcw size={11} className={resettingField === 'username' ? 'animate-spin' : ''} />
                      Reset Cooldown ({pseudoDaysLeft}d left)
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  minLength={5}
                  maxLength={14}
                  pattern="[a-zA-Z0-9_]+"
                  value={profileForm.username}
                  onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] font-mono focus:outline-none focus:border-[#FF6600] transition-colors"
                  placeholder="Pseudo (5-14 chars)"
                />
                <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] mt-1">
                  5 to 14 characters: alphanumeric characters and underscores only.
                </p>
              </div>

              {profileError && (
                <p className="text-xs text-red-500 font-medium">{profileError}</p>
              )}

              <Button type="submit" size="sm" icon={Save} loading={profileSaving}>
                Save Identity Changes
              </Button>
            </form>
          </div>

          {/* Activity / Tickets */}
          <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 shadow-sm">
            <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F] dark:text-[#f4f4f5] mb-1">
              User Activity & Support
            </h2>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mb-4">
              Overview of support tickets and platform interactions.
            </p>

            {activityLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full rounded-lg" />
                <Skeleton className="h-6 w-3/4 rounded-lg" />
              </div>
            ) : !activity ? (
              <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">
                Activity information could not be retrieved.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c]">
                  <div className="w-8 h-8 rounded-xl bg-[#FF6600]/15 flex items-center justify-center text-[#FF6600]">
                    <Ticket size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1D1D1F] dark:text-[#f4f4f5]">
                      {activity.support_tickets?.length || 0} Support Ticket{(activity.support_tickets?.length || 0) !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a]">
                      Filed under email {u.email}
                    </p>
                  </div>
                </div>

                {activity.support_tickets?.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activity.support_tickets.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-[#1D1D1F] dark:text-[#f4f4f5] truncate">
                            #{t.ticket_number} - {t.subject}
                          </p>
                          <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">
                            {fmtDate(t.created_at)}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog
          isOpen={dialog.open}
          onClose={closeConfirm}
          onConfirm={handleConfirm}
          title={dialog.title}
          description={dialog.description}
          loading={confirmLoading}
          variant={dialog.variant}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════
  const totalStaff = users.filter(u => u.role === 'admin' || u.role === 'super_admin').length;
  const totalSuspended = users.filter(u => u.isSuspended).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#f4f4f5] flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/25 flex items-center justify-center text-[#FF6600]">
              <Users size={20} />
            </div>
            User Directory & Permissions
          </h1>
          <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-1">
            Manage player accounts, system staff roles, custom studio roles and platform security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showCreateUser ? 'secondary' : 'default'}
            size="sm"
            onClick={() => {
              setShowCreateUser(v => !v);
              setCreateResult(null);
            }}
          >
            {showCreateUser ? 'Close Form' : '+ New User Account'}
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] font-medium">Total Registered</p>
            <p className="text-xl font-bold text-[#1D1D1F] dark:text-[#f4f4f5] tracking-tight">{total}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#6C5CE7]/10 text-[#6C5CE7] flex items-center justify-center shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] font-medium">Staff & Admins</p>
            <p className="text-xl font-bold text-[#1D1D1F] dark:text-[#f4f4f5] tracking-tight">{totalStaff}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <Ban size={20} />
          </div>
          <div>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] font-medium">Suspended</p>
            <p className="text-xl font-bold text-[#1D1D1F] dark:text-[#f4f4f5] tracking-tight">{totalSuspended}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center shrink-0">
            <Crown size={20} />
          </div>
          <div>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] font-medium">Custom Roles</p>
            <p className="text-xl font-bold text-[#1D1D1F] dark:text-[#f4f4f5] tracking-tight">{customRolesList.length}</p>
          </div>
        </div>
      </div>

      {/* Create User Drawer / Card */}
      {showCreateUser && (
        <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#FF6600]/30 shadow-md p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#D2D2D7] dark:border-[#2a2a3c] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F] dark:text-[#f4f4f5]">Create User Account</h2>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                Register a new member with predefined permissions and credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateUser(false)}
              className="p-1.5 rounded-lg text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {createResult?.success ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle size={16} /> User account created successfully: @{createResult.username}
              </p>
              {createResult.generated_password && (
                <div className="p-3 rounded-xl bg-white dark:bg-[#111118] border border-emerald-500/20 text-xs">
                  <span className="text-[#6E6E73] dark:text-[#a1a1aa]">Generated Password: </span>
                  <span className="font-mono font-bold text-[#FF6600] select-all">
                    {createResult.generated_password}
                  </span>
                  <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] mt-1">
                    Please provide this password to the user securely. It will not be shown again.
                  </p>
                </div>
              )}
              <div className="pt-2">
                <Button size="sm" onClick={() => setCreateResult(null)}>
                  Create Another User
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] focus:outline-none focus:border-[#FF6600]"
                    placeholder="player@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8] mb-1">
                    Password (leave empty to auto-generate)
                  </label>
                  <input
                    type="text"
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] font-mono focus:outline-none focus:border-[#FF6600]"
                    placeholder="Leave empty for strong random password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8] mb-1">
                    Display Name (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={70}
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] focus:outline-none focus:border-[#FF6600]"
                    placeholder="e.g. Alex Hunter"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8] mb-1">
                    Pseudo / Username (optional)
                  </label>
                  <input
                    type="text"
                    minLength={5}
                    maxLength={14}
                    value={createForm.username}
                    onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] font-mono focus:outline-none focus:border-[#FF6600]"
                    placeholder="Leave empty for auto-generation"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8] mb-1">
                    System Role
                  </label>
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="user">User (Standard Member)</option>
                    <option value="admin">Admin (Staff Access)</option>
                  </select>
                </div>
              </div>

              {customRolesList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8] mb-2">
                    Assign Custom Roles
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {customRolesList.map(r => {
                      const isSel = (createForm.custom_roles || []).includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleCreateCustomRole(r.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                            isSel
                              ? 'shadow-sm'
                              : 'border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#F5F5F7] dark:bg-[#111118] text-[#6E6E73] dark:text-[#a1a1aa]'
                          }`}
                          style={{
                            borderColor: isSel ? r.color : undefined,
                            backgroundColor: isSel ? `${r.color}15` : undefined,
                            color: isSel ? r.color : undefined,
                          }}
                        >
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: r.color }} />
                          {r.name}
                          {isSel && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#d4d4d8] mb-2">
                  Initial Permissions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PERMISSION_GROUPS.flatMap(g => g.permissions).map(p => {
                    const isSel = createForm.permissions.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleCreatePermission(p.id)}
                        className={`rounded-lg text-xs px-2.5 py-1 border transition-all ${
                          isSel
                            ? 'bg-[#FF6600]/10 border-[#FF6600] text-[#FF6600] font-semibold'
                            : 'bg-[#F5F5F7] dark:bg-[#111118] border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4]'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {createResult?.error && (
                <p className="text-xs text-red-500 font-medium">{createResult.error}</p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" size="sm" loading={createLoading}>
                  Confirm & Create Account
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateUser(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Main Table Card */}
      <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-sm overflow-hidden">
        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] flex flex-col md:flex-row items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 w-full">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a] pointer-events-none"
            />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by username, display name, or email..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-9 py-2 rounded-2xl text-xs bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#f4f4f5] focus:outline-none focus:border-[#FF6600] placeholder:text-[#A1A1A6] dark:placeholder:text-[#52525b] transition-all"
            />
            {!searchInput && (
              <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#A1A1A6] dark:text-[#71717a] border border-[#D2D2D7] dark:border-[#2a2a3c] rounded px-1.5 py-0.5 pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            <Select
              size="sm"
              wrapperClassName="w-36"
              value={filterRole}
              onChange={e => { setFilterRole(e.target.value); setPage(1); }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </Select>

            <Select
              size="sm"
              wrapperClassName="w-36"
              value={filterSuspended}
              onChange={e => { setFilterSuspended(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="false">Active Only</option>
              <option value="true">Suspended Only</option>
            </Select>

            <DensityToggle density={density} onChange={setDensity} />
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-[#FF6600]/10 border-b border-[#FF6600]/25 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#FF6600]">
                {selectedIds.size} user{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] hover:underline ml-2"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" icon={CheckCircle} onClick={() => bulkSuspend(false)}>
                Reactivate
              </Button>
              <Button size="sm" variant="danger" icon={Ban} onClick={() => bulkSuspend(true)}>
                Suspend
              </Button>
            </div>
          </div>
        )}

        {/* List Content */}
        <div className="p-4">
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-[#FBFBFC] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] p-3 flex items-center gap-3"
                >
                  <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-44 rounded" />
                    <Skeleton className="h-3 w-28 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search || filterRole || filterSuspended ? 'No matching accounts found' : 'No user accounts found'}
              description={search || filterRole || filterSuspended ? 'Try resetting search or filter criteria.' : 'Registered users will appear here.'}
            />
          ) : (
            <div className="space-y-2">
              {/* Select All Row */}
              <div className="flex items-center gap-2 px-2 py-1 mb-1">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                  className="w-3.5 h-3.5 rounded text-[#FF6600] focus:ring-[#FF6600] border-[#D2D2D7] dark:border-[#2a2a3c]"
                />
                <span className="text-[11px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-wider">
                  Select all visible accounts
                </span>
              </div>

              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isSuperAdmin = u.role === 'super_admin';
                const isAdmin = u.role === 'admin';
                const initials = (u.name?.[0] || u.firstName?.[0] || u.username?.[0] || '?').toUpperCase();
                const displayName = u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.username);
                const selectable = !isSuperAdmin && !isSelf;

                return (
                  <div
                    key={u.id}
                    onClick={() => openUser(u)}
                    className={`rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 bg-white dark:bg-[#151520] hover:border-[#FF6600]/40 ${
                      density === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
                    } ${
                      u.isSuspended
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-[#D2D2D7] dark:border-[#2a2a3c]'
                    }`}
                  >
                    {/* Checkbox */}
                    {selectable ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(u.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded text-[#FF6600] focus:ring-[#FF6600] border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0"
                      />
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}

                    {/* Initials Avatar */}
                    <div
                      className={`rounded-xl flex items-center justify-center font-bold shrink-0 transition-transform ${
                        density === 'compact' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
                      } ${
                        u.isSuspended
                          ? 'bg-red-500/10 text-red-500'
                          : isSuperAdmin
                          ? 'bg-[#FF6600]/10 text-[#FF6600]'
                          : isAdmin
                          ? 'bg-[#6C5CE7]/10 text-[#6C5CE7]'
                          : 'bg-zinc-100 dark:bg-[#1d1d2b] text-[#1D1D1F] dark:text-[#e4e4e7]'
                      }`}
                    >
                      {initials}
                    </div>

                    {/* User Identity */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-[#1D1D1F] dark:text-[#f4f4f5] tracking-tight">
                          {displayName}
                        </span>
                        <span className="text-xs text-[#A1A1A6] dark:text-[#71717a] font-mono">
                          @{u.username}
                        </span>

                        {/* Role Pills */}
                        {isSuperAdmin && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/25">
                            Super Admin
                          </span>
                        )}
                        {isAdmin && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#6C5CE7]/10 text-[#6C5CE7] border border-[#6C5CE7]/25">
                            Admin
                          </span>
                        )}
                        {!isSuperAdmin && !isAdmin && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-[#202030] text-[#6E6E73] dark:text-[#a1a1aa]">
                            User
                          </span>
                        )}

                        {u.isSuspended && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/25">
                            Suspended
                          </span>
                        )}

                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF6600]/10 text-[#FF6600]">
                            You
                          </span>
                        )}

                        {/* Custom Roles Badges */}
                        {(u.custom_roles || []).map((rId) => {
                          const rObj = resolveCustomRole(rId);
                          const color = rObj?.color || '#FF6600';
                          const name = rObj?.name || String(rId);
                          return (
                            <span
                              key={String(rId)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                              style={{
                                backgroundColor: `${color}12`,
                                color,
                                borderColor: `${color}35`,
                              }}
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>

                      {density !== 'compact' && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-[#6E6E73] dark:text-[#a1a1aa] flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail size={11} className="text-[#A1A1A6] dark:text-[#71717a]" />
                            {u.email}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Meta info & Arrow */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">
                        {u.permissions?.length || 0} permission{(u.permissions?.length || 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-0.5">
                        Active {fmtDate(u.lastLogin)}
                      </p>
                    </div>

                    <ChevronRight size={16} className="text-[#A1A1A6] dark:text-[#71717a] shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-[#D2D2D7] dark:border-[#2a2a3c] mt-4">
              <span className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                Showing page <span className="font-semibold text-[#1D1D1F] dark:text-[#f4f4f5]">{page}</span> of {pages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === pages}
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={dialog.open}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={dialog.title}
        description={dialog.description}
        loading={confirmLoading}
        variant={dialog.variant}
      />
    </div>
  );
};
