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
      await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/items/send`, formData, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Sent ${formData.amount}x ${formData.variable} to ${formData.uid}`);
      setFormData({ uid: '', variable: '', amount: '' });
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to send items'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F2994A] to-[#EB5757] flex items-center justify-center"><Package size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-zinc-900 dark:text-[#e4e4e7]">Send Items</h3><p className="text-xs text-[#71717a]">Send items to a player</p></div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6" data-testid="send-items-form">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Player UID</label>
              <input type="text" value={formData.uid} onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none transition-all"
                placeholder="player_12345" required data-testid="uid-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Item Variable</label>
              <input type="text" value={formData.variable} onChange={(e) => setFormData({ ...formData, variable: e.target.value })}
                className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none transition-all"
                placeholder="wood, workbench, etc." required data-testid="variable-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Amount</label>
              <input type="text" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none transition-all"
                placeholder="10, legendary, etc." required data-testid="amount-input" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2" data-testid="send-items-submit">
              <Send size={16} />{loading ? 'Sending...' : 'Send Items'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
