import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Users, Plus, Edit2, Trash2, Save, X, Copy, Gamepad2, Package, Activity, Database, FileText, Code, Shield } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PERMISSION_GROUPS = [
  {
    label: 'Projects',
    icon: Gamepad2,
    color: '#6C5CE7',
    permissions: [
      { id: 'view_projects', label: 'View Projects' },
      { id: 'create_projects', label: 'Create Projects' },
      { id: 'delete_projects', label: 'Delete Projects' },
    ]
  },
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
  }
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.id));

export const UserManagement = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', permissions: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUsers(); /* eslint-disable-next-line */ }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
      setUsers(response.data.users);
    } catch (error) { console.error('Failed to fetch users'); }
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
      const response = await axios.post(`${API_URL}/api/users`, formData, { headers: { Authorization: `Bearer ${token}` } });
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
      await axios.put(`${API_URL}/api/users/${username}/permissions`, { permissions: editingUser.permissions }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Permissions updated');
      setEditingUser(null);
      fetchUsers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to update'); }
    finally { setLoading(false); }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/users/${username}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('User deleted');
      fetchUsers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };

  const renderPermissionGrid = (selectedPerms, onToggle) => (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => {
        const Icon = group.icon;
        const allSelected = group.permissions.every(p => selectedPerms.includes(p.id));
        return (
          <div key={group.label} className="border border-[#EDE5DB] rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#FBF9F7] border-b border-[#EDE5DB]">
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
              }} className="text-[10px] font-semibold text-[#8A8A9A] hover:text-[#1A1A2E] uppercase">
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="p-2 flex flex-wrap gap-2">
              {group.permissions.map((perm) => (
                <label key={perm.id} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all text-sm ${
                  selectedPerms.includes(perm.id)
                    ? 'border-[#F2994A] bg-[#F2994A]/5 text-[#1A1A2E]'
                    : 'border-[#EDE5DB] bg-white text-[#8A8A9A] hover:bg-[#FBF9F7]'
                }`}>
                  <input type="checkbox" checked={selectedPerms.includes(perm.id)} onChange={() => onToggle(perm.id)}
                    className="w-3.5 h-3.5 rounded" />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const getPermLabel = (permId) => {
    for (const group of PERMISSION_GROUPS) {
      const p = group.permissions.find(pp => pp.id === permId);
      if (p) return { label: p.label, color: group.color };
    }
    return { label: permId, color: '#8A8A9A' };
  };

  return (
    <div className="max-w-6xl">
      <div className="bg-white rounded-xl border border-[#EDE5DB] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE5DB] bg-gradient-to-r from-[#F2994A]/5 to-[#F2C94C]/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F2994A] to-[#F2C94C] flex items-center justify-center shadow-sm">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1A1A2E]">User Management</h3>
              <p className="text-xs text-[#8A8A9A]">Create and manage user accounts with granular permissions</p>
            </div>
          </div>
          <button onClick={() => { setShowCreateForm(!showCreateForm); setCreatedUser(null); }}
            className="bg-gradient-to-r from-[#F2994A] to-[#EB5757] text-white hover:from-[#E88A3A] hover:to-[#D84848] rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
            data-testid="create-user-button">
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Cancel' : 'Create User'}
          </button>
        </div>

        {showCreateForm && (
          <div className="p-6 bg-[#FBF9F7] border-b border-[#EDE5DB]">
            <form onSubmit={handleCreateUser} data-testid="create-user-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Username</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full border border-[#EDE5DB] bg-white rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F2994A]/20 focus:border-[#F2994A]"
                    required data-testid="username-input" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-[#8A8A9A] uppercase tracking-wider">Permissions ({formData.permissions.length}/{ALL_PERMISSIONS.length})</div>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPermissions} className="text-xs text-[#2F80ED] hover:underline">Select All</button>
                      <span className="text-[#EDE5DB]">|</span>
                      <button type="button" onClick={clearAllPermissions} className="text-xs text-[#EB5757] hover:underline">Clear All</button>
                    </div>
                  </div>
                  {renderPermissionGrid(formData.permissions, togglePermission)}
                </div>
                <button type="submit" disabled={loading || formData.permissions.length === 0}
                  className="w-full bg-gradient-to-r from-[#F2994A] to-[#EB5757] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 shadow-sm"
                  data-testid="create-user-submit">
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {createdUser && (
          <div className="mx-6 mt-6 p-4 border border-[#27AE60]/30 bg-[#27AE60]/5 rounded-xl" data-testid="created-user-info">
            <div className="text-sm font-medium text-[#27AE60] mb-3">User created successfully</div>
            <div className="space-y-2 text-sm">
              <div><span className="text-xs font-semibold text-[#8A8A9A]">USERNAME:</span><span className="ml-2 text-[#1A1A2E]">{createdUser.username}</span></div>
              <div>
                <span className="text-xs font-semibold text-[#8A8A9A]">ACCESS KEY:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-white border border-[#27AE60]/30 text-[#1A1A2E] text-xs rounded-lg break-all font-mono">{createdUser.access_key}</code>
                  <button onClick={() => copyToClipboard(createdUser.access_key)} className="p-2 border border-[#27AE60]/30 bg-white hover:bg-[#27AE60]/5 rounded-lg" data-testid="copy-access-key"><Copy size={16} /></button>
                </div>
              </div>
              <div className="text-xs text-[#8A8A9A] mt-2">Save this key now. It will not be shown again.</div>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#8A8A9A] mb-4 uppercase tracking-wider">Users ({users.length})</div>
          <div className="space-y-3" data-testid="users-list">
            {users.length === 0 && (
              <div className="text-center py-12 text-[#C4B5A5]">No users yet. Create one to get started.</div>
            )}
            {users.map((user) => {
              const isEditing = editingUser?.username === user.username;
              return (
                <div key={user.username} className="border border-[#EDE5DB] rounded-xl bg-white hover:shadow-sm transition-all">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F2994A]/20 to-[#EB5757]/20 flex items-center justify-center text-sm font-semibold text-[#F2994A]">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-[#1A1A2E]">{user.username}</div>
                          <div className="text-xs text-[#C4B5A5]">Created by {user.created_by} &bull; {user.permissions?.length || 0} permission(s)</div>
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="flex gap-2">
                          <button onClick={() => setEditingUser({ ...user })}
                            className="px-3 py-1.5 border border-[#EDE5DB] hover:bg-[#FBF9F7] rounded-lg text-[#2F80ED] text-sm flex items-center gap-1 transition-all"
                            data-testid={`edit-user-${user.username}`}><Edit2 size={14} />Edit</button>
                          <button onClick={() => handleDeleteUser(user.username)}
                            className="px-3 py-1.5 border border-[#EB5757]/30 hover:bg-[#EB5757] hover:text-white rounded-lg text-[#EB5757] text-sm flex items-center gap-1 transition-all"
                            data-testid={`delete-user-${user.username}`}><Trash2 size={14} />Delete</button>
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
  );
};
