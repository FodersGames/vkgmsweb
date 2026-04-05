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
  const [formData, setFormData] = useState({
    username: '',
    permissions: []
  });
  const [loading, setLoading] = useState(false);

  const availablePermissions = [
    { id: 'send_items', label: 'Envoyer Items' },
    { id: 'change_status', label: 'Changer Statut' },
    { id: 'view_logs', label: 'Voir Journaux' },
    { id: 'manage_users', label: 'Gérer Utilisateurs' },
    { id: 'manage_variables', label: 'Gérer Variables' }
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
      toast.success(`Utilisateur ${formData.username} créé avec succès`);
      setFormData({ username: '', permissions: [] });
      setShowCreateForm(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Échec de la création');
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
      toast.success('Permissions mises à jour');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Échec de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Supprimer "${username}" ?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/users/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Utilisateur supprimé');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Échec de la suppression');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié');
  };

  const startEditing = (user) => {
    setEditingUser({ ...user });
  };

  const cancelEditing = () => {
    setEditingUser(null);
  };

  return (
    <div className="max-w-6xl">
      <div className="bg-white border border-[#EDEBE9] rounded-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EDEBE9] bg-[#FAFAFA] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#0078D4]" />
            <div>
              <h3 className="text-lg font-medium text-[#201F1E]">Gestion des Utilisateurs</h3>
              <p className="text-xs text-[#605E5C] mt-1">Créer et gérer les comptes</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
            data-testid="create-user-button"
          >
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Annuler' : 'Créer Utilisateur'}
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="p-6 bg-[#FAFAFA] border-b border-[#EDEBE9]">
            <form onSubmit={handleCreateUser} data-testid="create-user-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#605E5C] mb-2">
                    NOM D'UTILISATEUR
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full border border-[#EDEBE9] bg-white rounded-sm text-sm p-2 focus:ring-1 focus:ring-[#0078D4] focus:border-[#0078D4]"
                    required
                    data-testid="username-input"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#605E5C] mb-3">
                    PERMISSIONS
                  </div>
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
                          className="w-4 h-4 text-[#0078D4] focus:ring-[#0078D4]"
                        />
                        <span className="text-sm text-[#201F1E]">
                          {perm.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || formData.permissions.length === 0}
                  className="w-full bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  data-testid="create-user-submit"
                >
                  {loading ? 'Création...' : 'Créer Utilisateur'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Created User Info */}
        {createdUser && (
          <div className="mx-6 mt-6 p-4 border border-[#107C10] bg-[#DFF6DD] rounded-sm" data-testid="created-user-info">
            <div className="text-sm font-medium text-[#107C10] mb-3">
              ✓ Utilisateur créé
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs font-semibold text-[#605E5C]">NOM:</span>
                <span className="ml-2 text-[#201F1E]">{createdUser.username}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#605E5C]">CLÉ:</span>
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
              <div className="text-xs text-[#605E5C] mt-2">
                ⚠️ Enregistrez cette clé maintenant
              </div>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="p-6">
          <div className="text-xs font-semibold text-[#605E5C] mb-4">
            UTILISATEURS ({users.length})
          </div>

          <div className="space-y-3" data-testid="users-list">
            {users.map((user) => {
              const isEditing = editingUser?.username === user.username;
              
              return (
                <div key={user.username} className="border border-[#EDEBE9] rounded-sm bg-white">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-[#201F1E] mb-1">{user.username}</div>
                        <div className="text-xs text-[#605E5C]">
                          Créé par: {user.created_by}
                        </div>
                      </div>
                      
                      {!isEditing && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(user)}
                            className="px-3 py-1.5 border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm text-[#0078D4] text-sm flex items-center gap-1"
                            data-testid={`edit-user-${user.username}`}
                          >
                            <Edit2 size={14} />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="px-3 py-1.5 border border-[#A4262C] hover:bg-[#A4262C] hover:text-white rounded-sm text-[#A4262C] text-sm flex items-center gap-1 transition-colors"
                            data-testid={`delete-user-${user.username}`}
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div>
                        <div className="text-xs font-semibold text-[#605E5C] mb-3">
                          MODIFIER PERMISSIONS
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {availablePermissions.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center gap-2 p-2 border border-[#EDEBE9] bg-white rounded-sm cursor-pointer hover:bg-[#F3F2F1] transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={editingUser.permissions.includes(perm.id)}
                                onChange={() => toggleEditPermission(perm.id)}
                                className="w-4 h-4 text-[#0078D4] focus:ring-[#0078D4]"
                              />
                              <span className="text-sm text-[#201F1E]">
                                {perm.label}
                              </span>
                            </label>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdatePermissions(user.username)}
                            disabled={loading}
                            className="bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <Save size={14} />
                            Enregistrer
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="bg-white text-[#201F1E] border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <X size={14} />
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-1 border border-[#0078D4] bg-[#E1DFDD] text-[#0078D4] text-xs rounded-sm font-medium"
                          >
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
