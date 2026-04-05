import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Users, Plus, Edit2, Trash2, Save, X, Copy } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const UserManagement = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', permissions: [] });
  const [loading, setLoading] = useState(false);

  const availablePermissions = [
    { id: 'send_items', label: 'Send Items' },
    { id: 'change_status', label: 'Change Status' },
    { id: 'view_logs', label: 'View Logs' },
    { id: 'manage_users', label: 'Manage Users' },
    { id: 'manage_variables', label: 'Manage Variables' }
  ];

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users');
    }
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/users`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCreatedUser(response.data);
      toast.success(`User ${formData.username} created`);
      setFormData({ username: '', permissions: [] });
      setShowCreateForm(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermissions = async (username) => {
    setLoading(true);
    try {
      await axios.put(
        `${API_URL}/api/users/${username}/permissions`,
        { permissions: editingUser.permissions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Permissions updated');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/users/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="max-w-6xl">
      <div className="bg-white border border-[#EDEBE9] rounded-sm shadow-sm">
        <div className="px-6 py-4 border-b border-[#EDEBE9] bg-[#FAFAFA] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0078D4] rounded-sm flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#201F1E]">User Management</h3>
              <p className="text-xs text-[#605E5C] mt-1">Create and manage user accounts</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
            data-testid="create-user-button"
          >
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Cancel' : 'Create User'}
          </button>
        </div>

        {showCreateForm && (
          <div className="p-6 bg-[#FAFAFA] border-b border-[#EDEBE9]">
            <form onSubmit={handleCreateUser} data-testid="create-user-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#605E5C] mb-2">USERNAME</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full border border-[#EDEBE9] bg-white rounded-sm text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0078D4] focus:border-[#0078D4]"
                    required
                    data-testid="username-input"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#605E5C] mb-3">PERMISSIONS</div>
                  <div className="grid grid-cols-2 gap-3">
                    {availablePermissions.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 p-3 border border-[#EDEBE9] bg-white rounded-sm cursor-pointer hover:bg-[#F3F2F1] transition-colors"
                        data-testid={`permission-${perm.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-[#201F1E]">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || formData.permissions.length === 0}
                  className="w-full bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  data-testid="create-user-submit"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {createdUser && (
          <div className="mx-6 mt-6 p-4 border border-[#107C10] bg-[#DFF6DD] rounded-sm" data-testid="created-user-info">
            <div className="text-sm font-medium text-[#107C10] mb-3">✓ User created successfully</div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs font-semibold text-[#605E5C]">USERNAME:</span>
                <span className="ml-2 text-[#201F1E]">{createdUser.username}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#605E5C]">ACCESS KEY:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-white border border-[#107C10] text-[#201F1E] text-xs rounded-sm break-all font-mono">
                    {createdUser.access_key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdUser.access_key)}
                    className="p-2 border border-[#107C10] bg-white hover:bg-[#DFF6DD] rounded-sm"
                    data-testid="copy-access-key"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              <div className="text-xs text-[#605E5C] mt-2">⚠️ Save this key now. It won't be shown again.</div>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#605E5C] mb-4">USERS ({users.length})</div>
          <div className="space-y-3" data-testid="users-list">
            {users.map((user) => {
              const isEditing = editingUser?.username === user.username;
              return (
                <div key={user.username} className="border border-[#EDEBE9] rounded-sm bg-white">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-[#201F1E] mb-1">{user.username}</div>
                        <div className="text-xs text-[#605E5C]">Created by: {user.created_by}</div>
                      </div>
                      {!isEditing && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUser({ ...user })}
                            className="px-3 py-1.5 border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm text-[#0078D4] text-sm flex items-center gap-1"
                            data-testid={`edit-user-${user.username}`}
                          >
                            <Edit2 size={14} />Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="px-3 py-1.5 border border-[#A4262C] hover:bg-[#A4262C] hover:text-white rounded-sm text-[#A4262C] text-sm flex items-center gap-1 transition-colors"
                            data-testid={`delete-user-${user.username}`}
                          >
                            <Trash2 size={14} />Delete
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div>
                        <div className="text-xs font-semibold text-[#605E5C] mb-3">EDIT PERMISSIONS</div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {availablePermissions.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2 p-2 border border-[#EDEBE9] bg-white rounded-sm cursor-pointer hover:bg-[#F3F2F1] transition-colors">
                              <input
                                type="checkbox"
                                checked={editingUser.permissions.includes(perm.id)}
                                onChange={() => toggleEditPermission(perm.id)}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-[#201F1E]">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdatePermissions(user.username)}
                            disabled={loading}
                            className="bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <Save size={14} />Save
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="bg-white text-[#201F1E] border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <X size={14} />Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.permissions.map((perm) => (
                          <span key={perm} className="px-2 py-1 border border-[#0078D4] bg-[#DEECF9] text-[#0078D4] text-xs rounded-sm font-medium">
                            {availablePermissions.find(p => p.id === perm)?.label || perm}
                          </span>
                        ))}
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