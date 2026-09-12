import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Shield, Crown, Sparkles, Gamepad2, Code, Terminal,
  Heart, Zap, Flame, Trophy, Plus, Edit2, Trash2, X, Check,
  Users, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { API_URL } from '../utils/api';

const PRESET_COLORS = [
  '#FF6600', '#3B82F6', '#10B981', '#F59E0B',
  '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6',
  '#6366F1', '#D97706', '#A855F7', '#E11D48',
];

const AVAILABLE_ICONS = [
  { id: 'Shield', label: 'Shield', icon: Shield },
  { id: 'Crown', label: 'Crown', icon: Crown },
  { id: 'Sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'Gamepad2', label: 'Gamepad', icon: Gamepad2 },
  { id: 'Code', label: 'Code', icon: Code },
  { id: 'Terminal', label: 'Terminal', icon: Terminal },
  { id: 'Heart', label: 'Heart', icon: Heart },
  { id: 'Zap', label: 'Lightning', icon: Zap },
  { id: 'Flame', label: 'Flame', icon: Flame },
  { id: 'Trophy', label: 'Trophy', icon: Trophy },
];

const PERMISSION_CATEGORIES = [
  {
    category: 'Website & Content',
    perms: [
      { id: 'manage_website', label: 'Website Settings' },
      { id: 'create_blog', label: 'Create Blog' },
      { id: 'edit_blog', label: 'Edit Blog' },
      { id: 'delete_blog', label: 'Delete Blog' },
      { id: 'manage_chat', label: 'Manage Game Chat' },
    ],
  },
  {
    category: 'Community & Support',
    perms: [
      { id: 'manage_tickets', label: 'Manage Support Tickets' },
      { id: 'manage_users', label: 'Manage Users & Permissions' },
      { id: 'manager_careers', label: 'Manage Careers' },
    ],
  },
  {
    category: 'Games & Dev',
    perms: [
      { id: 'create_games', label: 'Create Games' },
      { id: 'edit_games', label: 'Edit Games' },
      { id: 'delete_games', label: 'Delete Games' },
      { id: 'game_dev_panel', label: 'In-Game Dev Panel' },
      { id: 'game_logs_panel', label: 'In-Game Logs Panel' },
      { id: 'manage_studio_apps', label: 'Studio App Builder' },
      { id: 'manage_vakar_block', label: 'Vakar Block' },
    ],
  },
  {
    category: 'Economy & Items',
    perms: [
      { id: 'send_items', label: 'Send Items' },
      { id: 'delete_items', label: 'Delete Items' },
      { id: 'create_missions', label: 'Post Missions' },
      { id: 'claim_missions', label: 'Claim Missions' },
      { id: 'manage_missions', label: 'Manage Missions' },
    ],
  },
  {
    category: 'Server & Infra',
    perms: [
      { id: 'change_status', label: 'Change Server Status' },
      { id: 'view_variables', label: 'View Server Variables' },
      { id: 'create_variables', label: 'Create Variables' },
      { id: 'edit_variables', label: 'Edit Variables' },
      { id: 'delete_variables', label: 'Delete Variables' },
      { id: 'view_logs', label: 'View System Logs' },
      { id: 'view_vps', label: 'View VPS Health' },
    ],
  },
];

export const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    color: '#FF6600',
    icon: 'Shield',
    description: '',
    permissions: [],
  });

  const token = localStorage.getItem('token');

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(res.data.roles || []);
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setForm({
      name: '',
      color: '#FF6600',
      icon: 'Shield',
      description: '',
      permissions: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      color: role.color || '#FF6600',
      icon: role.icon || 'Shield',
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setModalOpen(true);
  };

  const handleTogglePerm = (permId) => {
    setForm(prev => {
      const exists = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter(p => p !== permId)
          : [...prev.permissions, permId],
      };
    });
  };

  const handleToggleCategory = (perms) => {
    setForm(prev => {
      const permIds = perms.map(p => p.id);
      const allSelected = permIds.every(id => prev.permissions.includes(id));
      if (allSelected) {
        return {
          ...prev,
          permissions: prev.permissions.filter(id => !permIds.includes(id)),
        };
      } else {
        const merged = Array.from(new Set([...prev.permissions, ...permIds]));
        return { ...prev, permissions: merged };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await axios.put(
          `${API_URL}/api/admin/roles/${editingRole.id}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Role '${form.name}' updated`);
      } else {
        await axios.post(
          `${API_URL}/api/admin/roles`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Role '${form.name}' created`);
      }
      setModalOpen(false);
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleId) => {
    try {
      await axios.delete(`${API_URL}/api/admin/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Role deleted');
      setDeleteConfirm(null);
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete role');
    }
  };

  const renderIcon = (iconName, size = 16, color = '#FFFFFF') => {
    const item = AVAILABLE_ICONS.find(i => i.id === iconName) || AVAILABLE_ICONS[0];
    const IconComp = item.icon;
    return <IconComp size={size} style={{ color }} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2a2a3c]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="text-[#FF6600]" size={20} />
            Role & Permission Management
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Create custom roles, define color tags & badges, and assign fine-grained permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRoles}
            disabled={loading}
            className="p-2 text-[#a1a1aa] hover:text-white bg-[#1a1a24] hover:bg-[#252535] rounded-lg border border-[#2a2a3c] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#FF6600] hover:bg-[#3dbdb5] text-[#0D0D0D] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
          >
            <Plus size={15} />
            Create Role
          </button>
        </div>
      </div>

      {/* Roles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-[#16161f] border border-[#2a2a3c] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-16 bg-[#16161f] border border-[#2a2a3c] rounded-xl p-8">
          <Shield size={36} className="mx-auto text-[#FF6600]/40 mb-3" />
          <h3 className="text-base font-semibold text-white">No Custom Roles Configured</h3>
          <p className="text-xs text-[#a1a1aa] mt-1 max-w-sm mx-auto mb-4">
            Click "Create Role" above to set up community roles like Moderator, Developer, or VIP.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF6600] text-[#0D0D0D] font-bold text-xs uppercase tracking-wider rounded-lg"
          >
            <Plus size={14} /> Create First Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map(role => {
            return (
              <div
                key={role.id}
                className="bg-[#14141c] border border-[#242432] hover:border-[#38384a] rounded-xl p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${role.color}20`,
                          border: `1px solid ${role.color}40`,
                        }}
                      >
                        {renderIcon(role.icon, 18, role.color)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                          {role.name}
                          {role.is_system && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">
                              System
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] font-mono text-[#a1a1aa]">
                          @{role.id}
                        </span>
                      </div>
                    </div>

                    {!role.is_system && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(role)}
                          className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-md transition-colors"
                          title="Edit role"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(role)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                          title="Delete role"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {role.description && (
                    <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4 line-clamp-2">
                      {role.description}
                    </p>
                  )}

                  <div className="mb-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] mb-1.5">
                      Permissions ({role.permissions?.length || 0})
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {(role.permissions || []).slice(0, 5).map(p => (
                        <span
                          key={p}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e1e2c] text-[#a1a1aa] border border-[#2a2a3c]"
                        >
                          {p}
                        </span>
                      ))}
                      {(role.permissions?.length || 0) > 5 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e1e2c] text-[#71717a]">
                          +{role.permissions.length - 5} more
                        </span>
                      )}
                      {(!role.permissions || role.permissions.length === 0) && (
                        <span className="text-[10px] text-[#71717a] italic">None (Display badge only)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#22222e] flex items-center justify-between text-xs text-[#71717a]">
                  <span className="flex items-center gap-1.5">
                    <Users size={12} />
                    <strong className="text-white font-medium">{role.user_count || 0}</strong> members
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="font-mono text-[10px]">{role.color}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141c] border border-[#2a2a3c] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-[#242432]">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-[#FF6600]" />
                <h2 className="text-base font-bold text-white">
                  {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-md transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Name & Slug */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                  Role Name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Lead Moderator, Senior Game Dev"
                  className="w-full px-3.5 py-2.5 bg-[#0e0e14] border border-[#2a2a3c] focus:border-[#FF6600] rounded-lg text-sm text-white outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                  Description <span className="normal-case font-normal text-[#71717a]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Responsibilities and purpose of this role"
                  className="w-full px-3.5 py-2.5 bg-[#0e0e14] border border-[#2a2a3c] focus:border-[#FF6600] rounded-lg text-sm text-white outline-none"
                />
              </div>

              {/* Color & Icon Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Color */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                    Role Color
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm({ ...form, color: e.target.value })}
                      className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.color}
                      onChange={e => setForm({ ...form, color: e.target.value })}
                      className="flex-1 px-3 py-1.5 bg-[#0e0e14] border border-[#2a2a3c] rounded-lg text-xs font-mono text-white outline-none uppercase"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-6 h-6 rounded-md transition-transform ${form.color.toLowerCase() === c.toLowerCase() ? 'scale-110 ring-2 ring-white' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                    Role Icon
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {AVAILABLE_ICONS.map(i => {
                      const IconC = i.icon;
                      const isSelected = form.icon === i.id;
                      return (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => setForm({ ...form, icon: i.id })}
                          title={i.label}
                          className={`p-2.5 rounded-lg flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-[#FF6600]/20 border-[#FF6600] text-[#FF6600]'
                              : 'bg-[#0e0e14] border-[#2a2a3c] text-[#a1a1aa] hover:text-white hover:border-[#38384a]'
                          }`}
                        >
                          <IconC size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Badge Preview */}
              <div className="p-3 bg-[#0e0e14] border border-[#242432] rounded-xl flex items-center justify-between">
                <span className="text-xs text-[#a1a1aa] font-medium">Badge Preview:</span>
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider"
                  style={{
                    backgroundColor: `${form.color}20`,
                    border: `1px solid ${form.color}50`,
                    color: form.color,
                  }}
                >
                  {renderIcon(form.icon, 14, form.color)}
                  <span>{form.name || 'Role Name'}</span>
                </div>
              </div>

              {/* Permissions Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">
                    Assigned Permissions ({form.permissions.length})
                  </label>
                  <span className="text-[11px] text-[#71717a]">
                    Select capabilities for members with this role
                  </span>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {PERMISSION_CATEGORIES.map(cat => {
                    const permIds = cat.perms.map(p => p.id);
                    const allSelected = permIds.every(id => form.permissions.includes(id));
                    const someSelected = permIds.some(id => form.permissions.includes(id));

                    return (
                      <div key={cat.category} className="p-3 bg-[#0e0e14] border border-[#22222e] rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {cat.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(cat.perms)}
                            className="text-[10px] font-mono text-[#FF6600] hover:underline"
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {cat.perms.map(p => {
                            const isChecked = form.permissions.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs cursor-pointer select-none transition-colors ${
                                  isChecked
                                    ? 'bg-[#FF6600]/10 text-white border border-[#FF6600]/30'
                                    : 'text-[#a1a1aa] hover:bg-white/5 border border-transparent'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePerm(p.id)}
                                  className="accent-[#FF6600] rounded"
                                />
                                <span className="truncate">{p.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-[#242432] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#a1a1aa] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#FF6600] hover:bg-[#3dbdb5] text-[#0D0D0D] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141c] border border-red-500/30 rounded-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Delete Role?</h3>
            <p className="text-xs text-[#a1a1aa] mb-6 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">'{deleteConfirm.name}'</strong>?
              This role will be unassigned from all {deleteConfirm.user_count || 0} user(s).
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-[#a1a1aa] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
              >
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
