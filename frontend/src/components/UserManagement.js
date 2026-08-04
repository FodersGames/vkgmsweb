import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Users, Edit2, Trash2, Save, X, Gamepad2, Package, Activity, Database,
  FileText, Code, Shield, ShoppingBag, ClipboardList, Ban, CheckCircle, Mail,
  Search, Trophy, Loader2, MessageCircle, Clipboard, ClipboardCheck,
  FolderOpen, Server, Terminal, ChevronLeft, RotateCcw, Ticket, ShoppingCart, AppWindow, Crown,
} from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Skeleton, Select, DensityToggle, useDensity } from '../ui';

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
  {
    label: 'Studio', icon: AppWindow, color: '#4ECDC4',
    permissions: [{ id: 'manage_studio_apps', label: 'App Builder' }]
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

// Mirrors backend/app/deps.py's PSEUDO_COOLDOWN_DAYS/FIRSTNAME_COOLDOWN_DAYS —
// client-side only for the "days remaining" hint; the backend is authoritative,
// and admin edits/resets here bypass it anyway.
const FIRSTNAME_COOLDOWN_DAYS = 30;
const PSEUDO_COOLDOWN_DAYS = 7;
const cooldownDaysLeft = (changedAt, cooldownDays) => {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  return Math.max(0, cooldownDays - Math.floor(elapsedMs / 86400000));
};

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const UserManagement = () => {
  const { user: currentUser } = useAuth();

  // ── List state ────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [projectsList, setProjectsList] = useState([]);

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
  const [createForm, setCreateForm] = useState({ email: '', password: '', firstName: '', lastName: '', username: '', role: 'user', permissions: [] });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  // ── Detail view state ────────────────────────────────────────────────
  const [activeUser, setActiveUser] = useState(null);
  const [editingPerms, setEditingPerms] = useState(false);
  const [permsDraft, setPermsDraft] = useState([]);
  const [permsLoading, setPermsLoading] = useState(false);

  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', username: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [resettingField, setResettingField] = useState('');

  const [loyaltyAmount, setLoyaltyAmount] = useState('');
  const [loyaltyReason, setLoyaltyReason] = useState('');
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyResult, setLoyaltyResult] = useState(null);

  const [vakarPlusLoading, setVakarPlusLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const permissionGroups = buildPermissionGroups(projectsList);
  const ALL_PERMISSIONS = permissionGroups.flatMap(g => g.permissions.map(p => p.id));

  // ── List fetch ────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { page, limit: 30 };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterSuspended !== '') params.suspended = filterSuspended;
      const r = await api.get('/api/users', { params });
      setUsers(r.data.users || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch { /* silent */ }
    finally { setListLoading(false); }
  }, [page, search, filterRole, filterSuspended]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setSelectedIds(new Set()); }, [users]);

  useEffect(() => {
    api.get('/api/projects').then(r => setProjectsList(r.data.projects || [])).catch(() => {});
  }, []);

  // Debounce the search box so it doesn't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // "/" focuses the search box — ignored while typing elsewhere, a dialog is
  // open, or the detail view is showing (it has no search box of its own).
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
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
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
      title: suspend ? `Suspend ${ids.length} user${ids.length !== 1 ? 's' : ''}` : `Reactivate ${ids.length} user${ids.length !== 1 ? 's' : ''}`,
      description: suspend
        ? 'Selected accounts will be blocked from signing in.'
        : 'Selected accounts will be able to sign in again.',
      variant: suspend ? 'destructive' : 'accent',
      onConfirm: async () => {
        await Promise.all(ids.map(id => api.patch(`/api/users/${id}/suspend`, { suspended: suspend }).catch(() => {})));
        toast.success(suspend ? 'Users suspended' : 'Users reactivated');
        setSelectedIds(new Set());
        fetchUsers();
      },
    });
  };

  // ── Detail view ──────────────────────────────────────────────────────
  const openUser = (u) => {
    setActiveUser(u);
    setProfileForm({ firstName: u.firstName || '', lastName: u.lastName || '', username: u.username || '' });
    setProfileError('');
    setEditingPerms(false);
    setPermsDraft(u.permissions || []);
    setLoyaltyResult(null);
    setLoyaltyAmount('');
    setLoyaltyReason('');
    setCopied(false);
    setActivity(null);
    setActivityLoading(true);
    api.get(`/api/admin/users/${u.id}/export`)
      .then(r => setActivity(r.data))
      .catch(() => setActivity(null))
      .finally(() => setActivityLoading(false));
  };

  const closeUser = () => { setActiveUser(null); fetchUsers(); };

  const saveProfileField = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    try {
      const r = await api.patch(`/api/admin/users/${activeUser.id}/profile`, profileForm);
      setActiveUser(u => ({ ...u, ...r.data }));
      toast.success('Profile updated');
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
      setActiveUser(u => ({ ...u, [field === 'firstName' ? 'firstNameChangedAt' : 'usernameChangedAt']: null }));
      toast.success(`${field === 'firstName' ? 'First name' : 'Pseudo'} cooldown reset`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset cooldown');
    } finally {
      setResettingField('');
    }
  };

  const handleUpdatePermissions = async () => {
    setPermsLoading(true);
    try {
      await api.put(`/api/users/${activeUser.id}/permissions`, { permissions: permsDraft });
      setActiveUser(u => ({ ...u, permissions: permsDraft }));
      toast.success('Permissions updated');
      setEditingPerms(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update permissions');
    } finally {
      setPermsLoading(false);
    }
  };

  const handleDeleteUser = (u) => {
    showConfirm({
      title: 'Delete user',
      description: `"${u.username}" will be permanently deleted and lose all access.`,
      variant: 'destructive',
      onConfirm: async () => {
        await api.delete(`/api/users/${u.id}`);
        toast.success('User deleted');
        if (activeUser?.id === u.id) setActiveUser(null);
        fetchUsers();
      },
    });
  };

  const handleSuspend = (u, suspend) => {
    showConfirm({
      title: suspend ? 'Suspend user' : 'Reactivate user',
      description: suspend
        ? `"${u.username}" will be suspended and blocked from signing in.`
        : `"${u.username}" will be able to sign in again.`,
      variant: suspend ? 'destructive' : 'accent',
      onConfirm: async () => {
        await api.patch(`/api/users/${u.id}/suspend`, { suspended: suspend });
        toast.success(suspend ? 'User suspended' : 'User reactivated');
        if (activeUser?.id === u.id) setActiveUser(a => ({ ...a, isSuspended: suspend }));
        fetchUsers();
      },
    });
  };

  const handleLoyaltyAdjust = async (e) => {
    e.preventDefault();
    if (!activeUser || !loyaltyAmount) return;
    setLoyaltyLoading(true);
    setLoyaltyResult(null);
    try {
      const r = await api.patch(`/api/admin/users/${activeUser.id}/loyalty`, {
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

  const handleVakarPlusToggle = async (grant) => {
    if (!activeUser) return;
    setVakarPlusLoading(true);
    try {
      await api.patch(`/api/admin/users/${activeUser.id}/vakar-plus`, { grant });
      setActiveUser(u => ({ ...u, vakar_plus_status: grant ? 'active' : 'none', vakar_plus_plan: grant ? 'manual' : null }));
      toast.success(grant ? 'Vakar+ granted' : 'Vakar+ revoked');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update Vakar+ status');
    } finally {
      setVakarPlusLoading(false);
    }
  };

  const copyUserData = async () => {
    try {
      const data = activity || (await api.get(`/api/admin/users/${activeUser.id}/export`)).data;
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy user data');
    }
  };

  // ── Create user (unchanged from before, pseudo rules updated) ──────────
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
          <div key={group.label} className="rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F5F5F7] dark:bg-[#111118] border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
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
                className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] hover:text-[#1D1D1F] dark:hover:text-white uppercase"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="p-2 flex flex-wrap gap-2">
              {group.permissions.map((perm) => (
                <label
                  key={perm.id}
                  className={`rounded-lg flex items-center gap-2 px-3 py-2 border cursor-pointer transition-all text-sm ${
                    selectedPerms.includes(perm.id)
                      ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]'
                      : 'border-[#D2D2D7] dark:border-[#2a2a3c] bg-[#F5F5F7] dark:bg-[#111118] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] hover:text-[#1D1D1F] dark:hover:text-white'
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

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW — full-screen swap, same pattern as TicketManagement.js
  // ═══════════════════════════════════════════════════════════════════════
  if (activeUser) {
    const u = activeUser;
    const isSuperAdmin = u.role === 'super_admin';
    const isSelf = currentUser?.id === u.id;
    const initials = ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
    const firstNameDaysLeft = cooldownDaysLeft(u.firstNameChangedAt, FIRSTNAME_COOLDOWN_DAYS);
    const pseudoDaysLeft = cooldownDaysLeft(u.usernameChangedAt, PSEUDO_COOLDOWN_DAYS);

    return (
      <>
        <div className="max-w-4xl">
          <button
            onClick={closeUser}
            className="flex items-center gap-2 text-sm text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white mb-6 transition-colors"
          >
            <ChevronLeft size={14} /> Back to users
          </button>

          {/* Identity header */}
          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 mb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 flex items-center justify-center text-lg font-semibold shrink-0 ${u.isSuspended ? 'bg-red-50 text-red-400' : 'bg-[#4ECDC4]/10 text-[#4ECDC4]'}`}>
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">
                      {u.firstName || u.username} {u.lastName}
                    </h2>
                    {isSuperAdmin && <span className="text-[10px] font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-1.5 py-0.5">Super Admin</span>}
                    {u.isSuspended && <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5">Suspended</span>}
                    {isSelf && <span className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] bg-[#F5F5F7] dark:bg-[#111118] px-1.5 py-0.5">You</span>}
                  </div>
                  <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">@{u.username} · {u.email}</p>
                  <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] mt-0.5">
                    Joined {fmtDate(u.createdAt)} · Last login {u.lastLogin ? fmtDate(u.lastLogin) : 'never'}
                  </p>
                </div>
              </div>

              {!isSuperAdmin && !isSelf && (
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="secondary" size="sm" icon={copied ? ClipboardCheck : Clipboard} onClick={copyUserData} title="Copy user data (GDPR export)" />
                  {u.isSuspended ? (
                    <Button variant="secondary" size="sm" icon={CheckCircle} onClick={() => handleSuspend(u, false)}>Reactivate</Button>
                  ) : (
                    <Button variant="secondary" size="sm" icon={Ban} onClick={() => handleSuspend(u, true)}>Suspend</Button>
                  )}
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteUser(u)}>Delete</Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Editable identity fields */}
            <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6">
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1">Identity</h3>
              <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] mb-4">
                Editing here bypasses the user's own cooldown — it's an admin action, not a self-service change.
              </p>
              <form onSubmit={saveProfileField} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase">First name</label>
                    {firstNameDaysLeft > 0 && (
                      <button type="button" onClick={() => resetCooldown('firstName')} disabled={resettingField === 'firstName'}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[#4ECDC4] hover:underline disabled:opacity-50">
                        <RotateCcw size={10} className={resettingField === 'firstName' ? 'animate-spin' : ''} />
                        Reset cooldown ({firstNameDaysLeft}d left)
                      </button>
                    )}
                  </div>
                  <input
                    type="text" maxLength={50} value={profileForm.firstName}
                    onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                    className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase mb-1">Last name (optional)</label>
                  <input
                    type="text" maxLength={50} value={profileForm.lastName}
                    onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                    className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase">Pseudo</label>
                    {pseudoDaysLeft > 0 && (
                      <button type="button" onClick={() => resetCooldown('username')} disabled={resettingField === 'username'}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[#4ECDC4] hover:underline disabled:opacity-50">
                        <RotateCcw size={10} className={resettingField === 'username' ? 'animate-spin' : ''} />
                        Reset cooldown ({pseudoDaysLeft}d left)
                      </button>
                    )}
                  </div>
                  <input
                    type="text" minLength={5} maxLength={14} pattern="[a-zA-Z0-9_]+" value={profileForm.username}
                    onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
                    className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                  />
                  <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-1">5-14 characters, letters, numbers and underscores only.</p>
                </div>
                {profileError && <p className="text-xs text-red-500">{profileError}</p>}
                <Button type="submit" size="sm" icon={Save} loading={profileSaving}>Save changes</Button>
              </form>
            </div>

            {/* Activity — purchases & tickets, lazy-loaded from the export endpoint */}
            <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6">
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-4">Activity</h3>
              {activityLoading ? (
                <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
              ) : !activity ? (
                <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Could not load activity.</p>
              ) : (
                <div className="space-y-4">
                  {activity.loyalty && (
                    <div className="flex items-center gap-2 text-sm">
                      <Trophy size={13} className="text-[#F59E0B]" />
                      <span className="text-[#1D1D1F] dark:text-[#e4e4e7] font-semibold capitalize">{activity.loyalty.tier}</span>
                      <span className="text-[#A1A1A6] dark:text-[#71717a]">· ${activity.loyalty.total_spent_dollars?.toFixed(2)} lifetime spend</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <ShoppingCart size={13} className="text-[#6C5CE7]" />
                    <span className="text-[#1D1D1F] dark:text-[#e4e4e7] font-semibold">{activity.game_purchases?.length || 0}</span>
                    <span className="text-[#A1A1A6] dark:text-[#71717a]">purchase{(activity.game_purchases?.length || 0) !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Ticket size={13} className="text-[#4ECDC4]" />
                    <span className="text-[#1D1D1F] dark:text-[#e4e4e7] font-semibold">{activity.support_tickets?.length || 0}</span>
                    <span className="text-[#A1A1A6] dark:text-[#71717a]">support ticket{(activity.support_tickets?.length || 0) !== 1 ? 's' : ''}</span>
                  </div>
                  {activity.game_purchases?.length > 0 && (
                    <div className="pt-3 border-t border-[#D2D2D7] dark:border-[#2a2a3c] space-y-1.5 max-h-40 overflow-y-auto">
                      {activity.game_purchases.slice(0, 8).map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-[#6E6E73] dark:text-[#a1a1aa] truncate">{p.game_name || p.game_slug}</span>
                          <span className="text-[#A1A1A6] dark:text-[#71717a] shrink-0 ml-2">{fmtDate(p.purchased_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Permissions */}
          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">
                Permissions {!isSuperAdmin && `(${(editingPerms ? permsDraft : u.permissions || []).length}/${ALL_PERMISSIONS.length})`}
              </h3>
              {!isSuperAdmin && !editingPerms && (
                <Button variant="secondary" size="sm" icon={Edit2} onClick={() => { setPermsDraft(u.permissions || []); setEditingPerms(true); }}>Edit</Button>
              )}
            </div>
            {isSuperAdmin ? (
              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-[#4ECDC4]/10 text-[#4ECDC4]">All permissions</span>
            ) : editingPerms ? (
              <div>
                {renderPermissionGrid(permsDraft, (id) => setPermsDraft(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]))}
                <div className="flex gap-2 mt-4">
                  <Button icon={Save} loading={permsLoading} onClick={handleUpdatePermissions}>Save</Button>
                  <Button variant="secondary" icon={X} onClick={() => setEditingPerms(false)}>Cancel</Button>
                </div>
              </div>
            ) : (u.permissions || []).length === 0 ? (
              <span className="text-xs text-[#A1A1A6] dark:text-[#71717a]">No permissions assigned</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(u.permissions || []).map((perm) => {
                  const { label, color } = getPermLabel(perm);
                  return <span key={perm} className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${color}15`, color }}>{label}</span>;
                })}
              </div>
            )}
          </div>

          {/* Vakar+ — manual comp/revoke, independent of Stripe */}
          {!isSuperAdmin && (
            <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 mb-4">
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-4 flex items-center gap-1.5">
                <Crown size={14} className="text-[#4ECDC4]" /> Vakar+
              </h3>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    u.vakar_plus_status === 'active' ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'bg-[#F5F5F7] dark:bg-[#111118] text-[#A1A1A6] dark:text-[#71717a]'
                  }`}>
                    {u.vakar_plus_status === 'active' ? 'Active' : 'Not subscribed'}
                  </span>
                  {u.vakar_plus_plan && (
                    <span className="text-xs text-[#A1A1A6] dark:text-[#71717a] capitalize">
                      {u.vakar_plus_plan === 'manual' ? 'manually granted' : `${u.vakar_plus_plan} — via Stripe`}
                    </span>
                  )}
                </div>
                {u.vakar_plus_status === 'active' ? (
                  <Button variant="secondary" size="sm" loading={vakarPlusLoading} onClick={() => handleVakarPlusToggle(false)}>Revoke Vakar+</Button>
                ) : (
                  <Button size="sm" icon={Crown} loading={vakarPlusLoading} onClick={() => handleVakarPlusToggle(true)} className="!bg-[#4ECDC4] hover:!bg-[#3DBDB4] !text-white">Grant Vakar+</Button>
                )}
              </div>
              {u.vakar_plus_plan === 'manual' && u.vakar_plus_status === 'active' && (
                <p className="mt-2 text-[10px] text-[#A1A1A6] dark:text-[#71717a]">Granted manually — doesn't renew or charge; revoke here whenever it should end.</p>
              )}
              {u.vakar_plus_plan && u.vakar_plus_plan !== 'manual' && u.vakar_plus_status === 'active' && (
                <p className="mt-2 text-[10px] text-[#A1A1A6] dark:text-[#71717a]">Billed via Stripe — revoking here overrides it until the next billing event syncs status again.</p>
              )}
            </div>
          )}

          {/* Loyalty adjustment */}
          {!isSuperAdmin && (
            <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6">
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-4 flex items-center gap-1.5">
                <Trophy size={14} className="text-[#F59E0B]" /> Loyalty adjustment
              </h3>
              {loyaltyResult && (
                <div className="rounded-lg text-xs bg-[#22C55E]/10 text-[#22C55E] px-3 py-2 mb-3 border border-[#22C55E]/20">
                  {loyaltyResult.previous_tier} → <strong>{loyaltyResult.new_tier}</strong> · Total: ${(loyaltyResult.new_total_cents / 100).toFixed(2)}
                </div>
              )}
              <form onSubmit={handleLoyaltyAdjust} className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-[10px] text-[#A1A1A6] dark:text-[#71717a] mb-1">Amount ($) — use − for removal</label>
                  <input type="number" step="0.01" required value={loyaltyAmount} onChange={e => setLoyaltyAmount(e.target.value)}
                    placeholder="+10.00 or -5.00"
                    className="rounded-lg w-36 px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#F59E0B] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]" />
                </div>
                <div className="flex-1 min-w-40">
                  <label className="block text-[10px] text-[#A1A1A6] dark:text-[#71717a] mb-1">Reason (optional)</label>
                  <input type="text" value={loyaltyReason} onChange={e => setLoyaltyReason(e.target.value)} placeholder="e.g. compensation"
                    className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#F59E0B] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]" />
                </div>
                <Button type="submit" size="sm" loading={loyaltyLoading} disabled={!loyaltyAmount} icon={Trophy}
                  className="!bg-[#F59E0B] hover:!bg-[#D97706] !text-white">
                  Apply
                </Button>
              </form>
            </div>
          )}
        </div>

        <ConfirmDialog
          isOpen={dialog.open} onClose={closeConfirm} onConfirm={handleConfirm}
          title={dialog.title} description={dialog.description}
          loading={confirmLoading} variant={dialog.variant}
        />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="max-w-6xl">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#F2994A18' }}>
                  <Users size={16} style={{ color: '#F2994A' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">User Management</h3>
                  <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">{total} account{total !== 1 ? 's' : ''} total</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setShowCreateUser(v => !v); setCreateResult(null); }}>
                {showCreateUser ? 'Cancel' : '+ Add user'}
              </Button>
            </div>

            {/* Create user panel */}
            {showCreateUser && (
              <div className="rounded-xl mt-4 p-4 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c]">
                <p className="text-xs font-bold text-[#1D1D1F] dark:text-[#e4e4e7] mb-3">Create user account</p>
                {createResult?.success ? (
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-[#22C55E]">✓ User created — @{createResult.username}</p>
                    {createResult.generated_password && (
                      <p className="text-[#6E6E73] dark:text-[#a1a1aa]">Generated password: <strong className="text-[#1D1D1F] dark:text-[#e4e4e7] font-mono">{createResult.generated_password}</strong> (send to user securely)</p>
                    )}
                    <button onClick={() => setCreateResult(null)} className="text-[#4ECDC4] hover:underline mt-1">Create another</button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-1">Email *</label>
                        <input type="email" required value={createForm.email}
                          onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                          className="rounded-lg w-full px-2 py-1.5 text-xs border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                          placeholder="user@example.com" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-1">Password (leave blank = auto-generate)</label>
                        <input type="text" value={createForm.password}
                          onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                          className="rounded-lg w-full px-2 py-1.5 text-xs border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7] font-mono"
                          placeholder="auto-generated" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-1">First name</label>
                        <input type="text" maxLength={50} value={createForm.firstName}
                          onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                          className="rounded-lg w-full px-2 py-1.5 text-xs border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                          placeholder="Optional" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-1">Last name</label>
                        <input type="text" maxLength={50} value={createForm.lastName}
                          onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                          className="rounded-lg w-full px-2 py-1.5 text-xs border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                          placeholder="Optional" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-1">Pseudo (leave blank = auto)</label>
                        <input type="text" minLength={5} maxLength={14} value={createForm.username}
                          onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                          className="rounded-lg w-full px-2 py-1.5 text-xs border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                          placeholder="auto-generated" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-1">Role</label>
                        <select value={createForm.role}
                          onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                          className="rounded-lg w-full px-2 py-1.5 text-xs border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]">
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-2">Permissions</label>
                      <div className="flex flex-wrap gap-1.5">
                        {permissionGroups.flatMap(g => g.permissions).map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleCreatePermission(p.id)}
                            className={`rounded text-[10px] px-2 py-0.5 border transition-colors ${
                              createForm.permissions.includes(p.id)
                                ? 'bg-[#4ECDC4]/10 border-[#4ECDC4]/40 text-[#4ECDC4]'
                                : 'bg-white dark:bg-[#111118] border-[#D2D2D7] dark:border-[#2a2a3c] text-[#A1A1A6] dark:text-[#71717a] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
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
            {/* Search + filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a] pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search by name, pseudo, or email…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="rounded-lg w-full pl-9 pr-8 py-2 text-sm bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A1A1A6] dark:placeholder:text-[#52525b]"
                />
                {!searchInput && (
                  <kbd className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] border border-[#D2D2D7] dark:border-[#2a2a3c] rounded px-1.5 py-0.5 pointer-events-none">/</kbd>
                )}
              </div>
              <Select size="sm" wrapperClassName="w-36" value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}>
                <option value="">All roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </Select>
              <Select size="sm" wrapperClassName="w-36" value={filterSuspended} onChange={e => { setFilterSuspended(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="false">Active</option>
                <option value="true">Suspended</option>
              </Select>
              <DensityToggle density={density} onChange={setDensity} className="ml-auto" />
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-lg bg-[#4ECDC4]/10 border border-[#4ECDC4]/30">
                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{selectedIds.size} selected</span>
                <div className="flex-1" />
                <Button size="sm" variant="secondary" icon={CheckCircle} onClick={() => bulkSuspend(false)}>Reactivate</Button>
                <Button size="sm" variant="danger" icon={Ban} onClick={() => bulkSuspend(true)}>Suspend</Button>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#A1A1A6] dark:text-[#71717a] hover:text-[#1D1D1F] dark:hover:text-white ml-1">Clear</button>
              </div>
            )}

            {listLoading ? (
              <div className={density === 'compact' ? 'space-y-1.5' : 'space-y-3'}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-4 flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-2.5 w-24" /></div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <EmptyState icon={Users} title={search || filterRole || filterSuspended ? 'No users match your filters' : 'No users yet'} description={search || filterRole || filterSuspended ? 'Try adjusting the search or filters.' : 'Users who register on the site will appear here.'} />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} className="w-3.5 h-3.5 rounded" />
                  <span className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase">Select all on page</span>
                </div>
                <div className={density === 'compact' ? 'space-y-1' : 'space-y-2'} data-testid="users-list">
                  {users.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const isSuperAdmin = u.role === 'super_admin';
                    const initials = ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
                    const selectable = !isSuperAdmin && !isSelf;
                    return (
                      <div
                        key={u.id}
                        className={`rounded-xl bg-white dark:bg-[#151520] border flex items-center gap-3 transition-all cursor-pointer ${density === 'compact' ? 'px-3 py-2' : 'px-4 py-3'} ${
                          u.isSuspended ? 'border-red-200 dark:border-red-900/40' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
                        }`}
                        onClick={() => openUser(u)}
                        data-testid={`user-card-${u.username}`}
                      >
                        {selectable ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(u.id)}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(u.id); }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded shrink-0"
                          />
                        ) : <div className="w-3.5 shrink-0" />}
                        <div className={`flex items-center justify-center text-sm font-semibold shrink-0 ${density === 'compact' ? 'w-7 h-7' : 'w-9 h-9'} ${u.isSuspended ? 'bg-red-50 text-red-400' : 'bg-[#4ECDC4]/10 text-[#4ECDC4]'}`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] text-sm">
                              {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.firstName || u.username)}
                            </span>
                            <span className="text-xs text-[#A1A1A6] dark:text-[#71717a]">@{u.username}</span>
                            {isSuperAdmin && <span className="text-[10px] font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-1.5 py-0.5">Super Admin</span>}
                            {u.role === 'admin' && !isSuperAdmin && <span className="text-[10px] font-semibold text-[#6C5CE7] bg-[#6C5CE7]/10 px-1.5 py-0.5">Admin</span>}
                            {u.isSuspended && <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5">Suspended</span>}
                            {isSelf && <span className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] bg-[#F5F5F7] dark:bg-[#111118] px-1.5 py-0.5">You</span>}
                          </div>
                          {density !== 'compact' && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Mail size={10} className="text-[#A1A1A6] dark:text-[#71717a]" />
                              <span className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] truncate">{u.email}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">{u.permissions?.length || 0} permission{u.permissions?.length !== 1 ? 's' : ''}</p>
                          {u.lastLogin && <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-0.5">Last login {fmtDate(u.lastLogin)}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white disabled:opacity-40 transition-colors">← Prev</button>
                <span className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Page {page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white disabled:opacity-40 transition-colors">Next →</button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={dialog.open} onClose={closeConfirm} onConfirm={handleConfirm}
        title={dialog.title} description={dialog.description}
        loading={confirmLoading} variant={dialog.variant}
      />
    </>
  );
};
