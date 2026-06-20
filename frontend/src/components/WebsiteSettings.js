import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Settings, AlertTriangle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const WebsiteSettings = () => {
  const { token } = useAuth();
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/settings`).then(r => setMaintenance(r.data.maintenance_mode)).catch(() => {});
  }, []);

  const toggleMaintenance = async () => {
    setLoading(true);
    try {
      const r = await axios.put(`${API_URL}/api/website/settings`, { maintenance_mode: !maintenance }, { headers: { Authorization: `Bearer ${token}` } });
      setMaintenance(r.data.maintenance_mode);
      toast.success(`Maintenance mode ${r.data.maintenance_mode ? 'enabled' : 'disabled'}`);
    } catch (e) { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#71717a] to-[#52525b] flex items-center justify-center"><Settings size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-zinc-900 dark:text-[#e4e4e7]">Website Settings</h3><p className="text-xs text-[#71717a]">Global website configuration</p></div>
          </div>
        </div>
        <div className="p-6">
          <div className={`p-5 rounded-xl border ${maintenance ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-50 dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c]'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className={maintenance ? 'text-red-400' : 'text-[#71717a]'} />
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-[#e4e4e7]">Maintenance Mode</h4>
                  <p className="text-xs text-[#71717a]">{maintenance ? 'Website is currently in maintenance' : 'Website is live and accessible'}</p>
                </div>
              </div>
              <button onClick={toggleMaintenance} disabled={loading}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                  maintenance ? 'bg-[#4ECDC4] text-[#0a0a0f] hover:bg-[#45b8b0]' : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                }`} data-testid="maintenance-toggle">
                {loading ? '...' : maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
