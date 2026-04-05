import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Database, Plus, Edit2, Trash2, Save, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const VariablesManagement = () => {
  const { token } = useAuth();
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVar, setEditingVar] = useState(null);
  const [formData, setFormData] = useState({ variable_name: '', values: [''] });

  useEffect(() => {
    fetchVariables();
    // eslint-disable-next-line
  }, []);

  const fetchVariables = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/variables`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVariables(response.data.variables);
    } catch (error) {
      console.error('Failed to fetch variables');
    }
  };

  const handleCreateVariable = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/variables`,
        { variable_name: formData.variable_name, values: formData.values.filter(v => v.trim() !== '') },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Variable created');
      setFormData({ variable_name: '', values: [''] });
      setShowCreateForm(false);
      fetchVariables();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create variable');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVariable = async (variableName) => {
    setLoading(true);
    try {
      await axios.put(
        `${API_URL}/api/variables/${variableName}`,
        { values: editingVar.values.filter(v => v.trim() !== '') },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Variable updated');
      setEditingVar(null);
      fetchVariables();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVariable = async (variableName) => {
    if (!window.confirm(`Delete variable "${variableName}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/variables/${variableName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Variable deleted');
      fetchVariables();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="bg-white border border-[#EDEBE9] rounded-sm shadow-sm">
        <div className="px-6 py-4 border-b border-[#EDEBE9] bg-[#FAFAFA] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0078D4] rounded-sm flex items-center justify-center">
              <Database size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#201F1E]">Variables Management</h3>
              <p className="text-xs text-[#605E5C] mt-1">Create and manage system variables</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
            data-testid="create-variable-button"
          >
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Cancel' : 'New Variable'}
          </button>
        </div>

        {showCreateForm && (
          <div className="p-6 bg-[#FAFAFA] border-b border-[#EDEBE9]">
            <form onSubmit={handleCreateVariable} data-testid="create-variable-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#605E5C] mb-2">VARIABLE NAME</label>
                  <input
                    type="text"
                    value={formData.variable_name}
                    onChange={(e) => setFormData({ ...formData, variable_name: e.target.value })}
                    className="w-full border border-[#EDEBE9] bg-white rounded-sm text-sm px-3 py-2 focus:ring-1 focus:ring-[#0078D4]"
                    placeholder="variable_name"
                    required
                    data-testid="variable-name-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#605E5C] mb-2">VALUES</label>
                  {formData.values.map((value, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setFormData(prev => ({ ...prev, values: prev.values.map((v, i) => i === index ? e.target.value : v) }))}
                        className="flex-1 border border-[#EDEBE9] bg-white rounded-sm text-sm px-3 py-2 focus:ring-1 focus:ring-[#0078D4]"
                        placeholder={`Value ${index + 1}`}
                        data-testid={`value-input-${index}`}
                      />
                      {formData.values.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }))}
                          className="px-3 py-2 border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm text-[#A4262C]"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, values: [...prev.values, ''] }))}
                    className="text-sm text-[#0078D4] hover:text-[#005A9E] flex items-center gap-1 mt-2"
                  >
                    <Plus size={14} />Add value
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                  data-testid="submit-variable-button"
                >
                  {loading ? 'Creating...' : 'Create Variable'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#605E5C] mb-4">VARIABLES ({variables.length})</div>
          {variables.length === 0 ? (
            <div className="text-center py-12 text-[#605E5C]">No variables found. Create one to get started.</div>
          ) : (
            <div className="space-y-3" data-testid="variables-list">
              {variables.map((variable) => {
                const isEditing = editingVar?.variable_name === variable.variable_name;
                return (
                  <div key={variable.variable_name} className="border border-[#EDEBE9] rounded-sm bg-white">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <code className="text-sm font-medium text-[#0078D4] font-mono">{variable.variable_name}</code>
                          <p className="text-xs text-[#605E5C] mt-1">Created by {variable.created_by} • {variable.values.length} value(s)</p>
                        </div>
                        {!isEditing && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingVar({ ...variable })}
                              className="px-3 py-1.5 border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm text-[#0078D4] text-sm flex items-center gap-1"
                              data-testid={`edit-variable-${variable.variable_name}`}
                            >
                              <Edit2 size={14} />Edit
                            </button>
                            <button
                              onClick={() => handleDeleteVariable(variable.variable_name)}
                              className="px-3 py-1.5 border border-[#A4262C] hover:bg-[#A4262C] hover:text-white rounded-sm text-[#A4262C] text-sm flex items-center gap-1 transition-colors"
                              data-testid={`delete-variable-${variable.variable_name}`}
                            >
                              <Trash2 size={14} />Delete
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          {editingVar.values.map((value, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => setEditingVar(prev => ({ ...prev, values: prev.values.map((v, i) => i === index ? e.target.value : v) }))}
                                className="flex-1 border border-[#EDEBE9] bg-white rounded-sm text-sm px-3 py-2"
                              />
                              {editingVar.values.length > 1 && (
                                <button
                                  onClick={() => setEditingVar(prev => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }))}
                                  className="px-3 py-2 border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm text-[#A4262C]"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => setEditingVar(prev => ({ ...prev, values: [...prev.values, ''] }))}
                            className="text-sm text-[#0078D4] hover:text-[#005A9E] flex items-center gap-1 mt-2"
                          >
                            <Plus size={14} />Add value
                          </button>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleUpdateVariable(variable.variable_name)}
                              disabled={loading}
                              className="bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <Save size={14} />Save
                            </button>
                            <button
                              onClick={() => setEditingVar(null)}
                              className="bg-white text-[#201F1E] border border-[#EDEBE9] hover:bg-[#F3F2F1] rounded-sm px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <X size={14} />Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#FAFAFA] rounded-sm p-3 border border-[#EDEBE9]">
                          <div className="text-xs font-semibold text-[#605E5C] mb-2">VALUES:</div>
                          <div className="flex flex-wrap gap-2">
                            {variable.values.map((value, index) => (
                              <span key={index} className="px-3 py-1 bg-white border border-[#EDEBE9] rounded-sm text-sm text-[#201F1E] font-mono">{value}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 bg-[#DEECF9] border border-[#EDEBE9] rounded-sm p-4">
        <h4 className="text-sm font-medium text-[#201F1E] mb-2">📘 API Usage</h4>
        <div className="text-xs text-[#201F1E] space-y-1 font-mono">
          <p>GET /api/variable/&#123;variable_name&#125; - Get variable values (public)</p>
          <div className="mt-2 bg-white p-2 rounded-sm border border-[#EDEBE9]">
            <code className="text-xs">{"{ \"variable_name\": \"name\", \"values\": [\"value1\", \"value2\"] }"}</code>
          </div>
        </div>
      </div>
    </div>
  );
};
