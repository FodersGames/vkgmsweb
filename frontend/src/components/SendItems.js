import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Package, Send } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SendItems = () => {
  const { token } = useAuth();
  const { selectedProject } = useProject();
  const [formData, setFormData] = useState({ uid: '', variable: '', amount: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/items/send`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Sent ${formData.amount}x ${formData.variable} to ${formData.uid}`);
      setFormData({ uid: '', variable: '', amount: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send items');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-[#EDE5DB] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE5DB] bg-gradient-to-r from-[#F2994A]/5 to-[#EB5757]/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F2994A] to-[#EB5757] flex items-center justify-center shadow-sm">
              <Package size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1A1A2E]">Send Items</h3>
              <p className="text-xs text-[#8A8A9A]">Send items to a player</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6" data-testid="send-items-form">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Player UID</label>
              <input type="text" value={formData.uid} onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                className="w-full border border-[#EDE5DB] bg-[#FBF9F7] rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F2994A]/20 focus:border-[#F2994A] transition-all"
                placeholder="player_12345" required data-testid="uid-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Item Variable</label>
              <input type="text" value={formData.variable} onChange={(e) => setFormData({ ...formData, variable: e.target.value })}
                className="w-full border border-[#EDE5DB] bg-[#FBF9F7] rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F2994A]/20 focus:border-[#F2994A] transition-all"
                placeholder="wood, workbench, etc." required data-testid="variable-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">Amount (text or number)</label>
              <input type="text" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full border border-[#EDE5DB] bg-[#FBF9F7] rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F2994A]/20 focus:border-[#F2994A] transition-all"
                placeholder="10, '100 gold', 'legendary', etc." required data-testid="amount-input" />
              <p className="text-xs text-[#C4B5A5] mt-1.5">Accepts any text or number value</p>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#F2994A] to-[#EB5757] text-white hover:from-[#E88A3A] hover:to-[#D84848] rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-[#F2994A]/15 flex items-center justify-center gap-2"
              data-testid="send-items-submit">
              <Send size={16} />
              {loading ? 'Sending...' : 'Send Items'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
