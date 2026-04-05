import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Users, Copy } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const UserManagement = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    permissions: []
  });
  const [loading, setLoading] = useState(false);

  const availablePermissions = [
    { id: 'send_items', label: 'Send Items' },
    { id: 'change_status', label: 'Change Status' },
    { id: 'view_logs', label: 'View Logs' },
    { id: 'manage_users', label: 'Manage Users' }
  ];

  const togglePermission = (permId) => {
    setFormData(prev => ({
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
      toast.success(`User ${formData.username} created successfully`);
      setFormData({ username: '', permissions: [] });
      setShowCreateForm(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

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

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="max-w-4xl">
      <div className="bg-white border border-neutral-300 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users size={28} weight="bold" className="text-neutral-950" />
            <h2 className="text-3xl font-bold text-neutral-950" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
              USER MANAGEMENT
            </h2>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-2 bg-neutral-950 text-white font-bold uppercase hover:bg-neutral-800 transition-all duration-200"
            data-testid="create-user-button"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            {showCreateForm ? 'CANCEL' : 'CREATE USER'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateUser} className="mb-8 p-6 bg-neutral-50 border border-neutral-300" data-testid="create-user-form">
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                USERNAME
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                required
                data-testid="username-input"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3"
                   style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                PERMISSIONS
              </div>
              <div className="grid grid-cols-2 gap-3">
                {availablePermissions.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-2 p-3 border border-neutral-300 bg-white cursor-pointer hover:bg-neutral-100 transition-all duration-200"
                    data-testid={`permission-${perm.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-neutral-950" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {perm.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || formData.permissions.length === 0}
              className="w-full bg-neutral-950 text-white py-3 font-bold uppercase hover:bg-neutral-800 transition-all duration-200 disabled:opacity-50"
              data-testid="create-user-submit"
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              {loading ? 'CREATING...' : 'CREATE USER'}
            </button>
          </form>
        )}

        {createdUser && (
          <div className="mb-8 p-6 border-2 border-green-600 bg-green-50" data-testid="created-user-info">
            <div className="text-sm font-bold uppercase text-green-900 mb-3" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              USER CREATED SUCCESSFULLY
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-bold text-green-800">USERNAME:</span>
                <span className="ml-2 font-mono text-sm text-green-900">{createdUser.username}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-green-800">ACCESS KEY:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-white border border-green-600 text-green-900 font-mono text-sm break-all">
                    {createdUser.access_key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdUser.access_key)}
                    className="p-2 border border-green-600 hover:bg-green-100"
                    data-testid="copy-access-key"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>
              <div className="text-xs text-green-800 mt-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                ⚠️ Save this access key now. It won't be shown again.
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4"
               style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            EXISTING USERS ({users.length})
          </div>
          <div className="space-y-3" data-testid="users-list">
            {users.map((user, index) => (
              <div key={index} className="p-4 border border-neutral-300 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-neutral-950 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {user.username}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {user.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-1 border border-neutral-950 bg-neutral-100 text-neutral-900 text-xs font-mono uppercase"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    Created by: {user.created_by}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};