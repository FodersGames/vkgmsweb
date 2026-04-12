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

  useEffect(() => { fetchVariables(); /* eslint-disable-next-line */ }, []);

  const fetchVariables = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/variables`, { headers: { Authorization: `Bearer ${token}` } });
      setVariables(response.data.variables);
    } catch (error) { console.error('Failed to fetch variables'); }
  };

  const handleCreateVariable = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/variables`,
        { variable_name: formData.variable_name, values: formData.values.filter(v => v.trim() !== '') },
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Variable created');
      setFormData({ variable_name: '', values: [''] });
      setShowCreateForm(false);
      fetchVariables();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create variable'); }
    finally { setLoading(false); }
  };

  const handleUpdateVariable = async (variableName) => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/variables/${variableName}`,
        { values: editingVar.values.filter(v => v.trim() !== '') },
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Variable updated');
      setEditingVar(null);
      fetchVariables();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to update'); }
    finally { setLoading(false); }
  };

  const handleDeleteVariable = async (variableName) => {
    if (!window.confirm(`Delete variable "${variableName}"?`)) return;
    try {
      await axios.delete(`${API_URL}/api/variables/${variableName}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Variable deleted');
      fetchVariables();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
  };

  return (
    <div className="max-w-6xl">
      <div className="bg-white rounded-xl border border-[#EDE5DB] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE5DB] bg-gradient-to-r from-[#2F80ED]/5 to-[#2D9CDB]/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2F80ED] to-[#2D9CDB] flex items-center justify-center shadow-sm">
              <Database size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1A1A2E]">Variables Management</h3>
              <p className="text-xs text-[#8A8A9A]">Create and manage system variables</p>
            </div>
          </div>
          <button onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-gradient-to-r from-[#2F80ED] to-[#2D9CDB] text-white hover:from-[#2070DD] hover:to-[#1D8CCB] rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
            data-testid="create-variable-button">
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Cancel' : 'New Variable'}
          </button>
        </div>

        {showCreateForm && (
          <div className="p-6 bg-[#FBF9F7] border-b border-[#EDE5DB]">
            <form onSubmit={handleCreateVariable} data-testid="create-variable-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Variable Name</label>
                  <input type="text" value={formData.variable_name} onChange={(e) => setFormData({ ...formData, variable_name: e.target.value })}
                    className="w-full border border-[#EDE5DB] bg-white rounded-lg text-sm px-3 py-2.5 focus:ring-2 focus:ring-[#2F80ED]/20 focus:border-[#2F80ED]"
                    placeholder="variable_name" required data-testid="variable-name-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Values</label>
                  {formData.values.map((value, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input type="text" value={value}
                        onChange={(e) => setFormData(prev => ({ ...prev, values: prev.values.map((v, i) => i === index ? e.target.value : v) }))}
                        className="flex-1 border border-[#EDE5DB] bg-white rounded-lg text-sm px-3 py-2.5 focus:ring-2 focus:ring-[#2F80ED]/20"
                        placeholder={`Value ${index + 1}`} data-testid={`value-input-${index}`} />
                      {formData.values.length > 1 && (
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }))}
                          className="px-3 py-2 border border-[#EDE5DB] hover:bg-[#EB5757]/5 rounded-lg text-[#EB5757]"><Trash2 size={16} /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, values: [...prev.values, ''] }))}
                    className="text-sm text-[#2F80ED] hover:text-[#2070DD] flex items-center gap-1 mt-2"><Plus size={14} />Add value</button>
                </div>
                <button type="submit" disabled={loading}
                  className="bg-gradient-to-r from-[#2F80ED] to-[#2D9CDB] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 shadow-sm"
                  data-testid="submit-variable-button">
                  {loading ? 'Creating...' : 'Create Variable'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#8A8A9A] mb-4 uppercase tracking-wider">Variables ({variables.length})</div>
          {variables.length === 0 ? (
            <div className="text-center py-12 text-[#C4B5A5]">No variables found. Create one to get started.</div>
          ) : (
            <div className="space-y-3" data-testid="variables-list">
              {variables.map((variable) => {
                const isEditing = editingVar?.variable_name === variable.variable_name;
                return (
                  <div key={variable.variable_name} className="border border-[#EDE5DB] rounded-xl bg-white hover:shadow-sm transition-all">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <code className="text-sm font-semibold text-[#2F80ED] font-mono">{variable.variable_name}</code>
                          <p className="text-xs text-[#C4B5A5] mt-1">Created by {variable.created_by} &bull; {variable.values.length} value(s)</p>
                        </div>
                        {!isEditing && (
                          <div className="flex gap-2">
                            <button onClick={() => setEditingVar({ ...variable })}
                              className="px-3 py-1.5 border border-[#EDE5DB] hover:bg-[#FBF9F7] rounded-lg text-[#2F80ED] text-sm flex items-center gap-1"
                              data-testid={`edit-variable-${variable.variable_name}`}><Edit2 size={14} />Edit</button>
                            <button onClick={() => handleDeleteVariable(variable.variable_name)}
                              className="px-3 py-1.5 border border-[#EB5757]/30 hover:bg-[#EB5757] hover:text-white rounded-lg text-[#EB5757] text-sm flex items-center gap-1 transition-all"
                              data-testid={`delete-variable-${variable.variable_name}`}><Trash2 size={14} />Delete</button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          {editingVar.values.map((value, index) => (
                            <div key={index} className="flex gap-2">
                              <input type="text" value={value}
                                onChange={(e) => setEditingVar(prev => ({ ...prev, values: prev.values.map((v, i) => i === index ? e.target.value : v) }))}
                                className="flex-1 border border-[#EDE5DB] bg-white rounded-lg text-sm px-3 py-2" />
                              {editingVar.values.length > 1 && (
                                <button onClick={() => setEditingVar(prev => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }))}
                                  className="px-3 py-2 border border-[#EDE5DB] hover:bg-[#EB5757]/5 rounded-lg text-[#EB5757]"><Trash2 size={16} /></button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => setEditingVar(prev => ({ ...prev, values: [...prev.values, ''] }))}
                            className="text-sm text-[#2F80ED] flex items-center gap-1 mt-2"><Plus size={14} />Add value</button>
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => handleUpdateVariable(variable.variable_name)} disabled={loading}
                              className="bg-gradient-to-r from-[#2F80ED] to-[#2D9CDB] text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm">
                              <Save size={14} />Save</button>
                            <button onClick={() => setEditingVar(null)}
                              className="bg-white text-[#1A1A2E] border border-[#EDE5DB] hover:bg-[#FBF9F7] rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
                              <X size={14} />Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#FBF9F7] rounded-lg p-3 border border-[#EDE5DB]">
                          <div className="text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Values:</div>
                          <div className="flex flex-wrap gap-2">
                            {variable.values.map((value, index) => (
                              <span key={index} className="px-3 py-1.5 bg-white border border-[#EDE5DB] rounded-lg text-sm text-[#1A1A2E] font-mono">{value}</span>
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

      <div className="mt-4 bg-[#2F80ED]/5 border border-[#2F80ED]/10 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-[#1A1A2E] mb-2">API Response Format</h4>
        <div className="text-xs text-[#1A1A2E] font-mono bg-white p-3 rounded-lg border border-[#EDE5DB]">
          <p className="text-[#8A8A9A] mb-1">GET /api/variable/{'{variable_name}'}</p>
          <p>{'{ "variable_name": "test", "value_0": "val1", "value_1": "val2", "count": 2 }'}</p>
        </div>
      </div>
    </div>
  );
};
