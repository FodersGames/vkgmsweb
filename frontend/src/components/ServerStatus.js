import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ServerStatus = () => {
  const { token } = useAuth();
  const { selectedProject } = useProject();
  const [currentStatus, setCurrentStatus] = useState('open');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (selectedProject) fetchStatus(); /* eslint-disable-next-line */ }, [selectedProject]);

  const fetchStatus = async () => {
    try { const r = await axios.get(`${API_URL}/api/projects/${selectedProject.slug}/status`); setCurrentStatus(r.data.status); } catch (e) {}
  };

  const changeStatus = async (s) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/status`, { status: s }, { headers: { Authorization: `Bearer ${token}` } });
      setCurrentStatus(s);
      toast.success(`Status changed to ${s}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const cfg = { open: { color: '#4ECDC4', label: 'Open' }, maintenance: { color: '#F2994A', label: 'Maintenance' }, closed: { color: '#EB5757', label: 'Closed' } };

  return (
    <div className="max-w-2xl">
      <div className="bg-[#151520] rounded-xl border border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a3c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4ECDC4] to-[#2CB5AC] flex items-center justify-center"><Activity size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-[#e4e4e7]">Server Status</h3><p className="text-xs text-[#71717a]">Control your server state</p></div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <div className="text-xs font-semibold text-[#71717a] mb-3 uppercase tracking-wider">Current Status</div>
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm" style={{ backgroundColor: `${cfg[currentStatus].color}15`, color: cfg[currentStatus].color }} data-testid="current-status">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: cfg[currentStatus].color }}></span>
              {cfg[currentStatus].label}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#71717a] mb-3 uppercase tracking-wider">Change Status</div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(cfg).map(([s, c]) => (
                <button key={s} onClick={() => changeStatus(s)} disabled={loading || currentStatus === s}
                  className={`py-3 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 ${currentStatus === s ? 'text-white shadow-lg' : 'bg-[#1c1c2e] border border-[#2a2a3c] hover:border-[#4ECDC4]/20'}`}
                  style={currentStatus === s ? { background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)` } : { color: c.color }}
                  data-testid={`status-${s}-button`}>{c.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
