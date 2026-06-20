import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { FileText, Filter } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const LogsViewer = () => {
  const { token } = useAuth();
  const { selectedProject } = useProject();
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ type: '', user: '', uid: '', limit: 100 });
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (selectedProject) fetchLogs(); /* eslint-disable-next-line */ }, [selectedProject]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.type) p.append('log_type', filters.type);
      if (filters.user) p.append('user_filter', filters.user);
      if (filters.uid) p.append('uid', filters.uid);
      p.append('limit', filters.limit);
      const r = await axios.get(`${API_URL}/api/projects/${selectedProject.slug}/logs?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      setLogs(r.data.logs);
    } catch (e) {} finally { setLoading(false); }
  };

  const colors = { send: '#F2994A', claim: '#4ECDC4', status: '#F2C94C', variable_action: '#2F80ED', variable_access: '#71717a', delete: '#EB5757' };

  return (
    <div className="max-w-7xl">
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#9B51E0] to-[#BB6BD9] flex items-center justify-center"><FileText size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-zinc-900 dark:text-[#e4e4e7]">Activity Logs</h3><p className="text-xs text-[#71717a]">View project activity</p></div>
          </div>
        </div>
        <div className="p-6 bg-slate-50 dark:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c]">
          <div className="flex items-center gap-2 mb-4"><Filter size={14} className="text-[#71717a]" /><span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Filters</span></div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#71717a] mb-2">Type</label>
              <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})} className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none" data-testid="filter-type">
                <option value="">All</option><option value="send">Send</option><option value="claim">Claim</option><option value="status">Status</option><option value="variable_action">Variable</option>
              </select>
            </div>
            <div><label className="block text-xs font-semibold text-[#71717a] mb-2">User</label><input type="text" value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})} className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none" data-testid="filter-user" /></div>
            <div><label className="block text-xs font-semibold text-[#71717a] mb-2">UID</label><input type="text" value={filters.uid} onChange={e => setFilters({...filters, uid: e.target.value})} className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none" data-testid="filter-uid" /></div>
            <div><label className="block text-xs font-semibold text-[#71717a] mb-2">Limit</label><input type="number" min="10" max="1000" value={filters.limit} onChange={e => setFilters({...filters, limit: parseInt(e.target.value)})} className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none" data-testid="filter-limit" /></div>
          </div>
          <button onClick={fetchLogs} disabled={loading} className="mt-4 bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" data-testid="apply-filters">{loading ? 'Loading...' : 'Apply Filters'}</button>
        </div>
        <div className="p-6">
          <div className="text-xs font-semibold text-[#71717a] mb-3 uppercase tracking-wider">Logs: {logs.length}</div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-[#2a2a3c]">
            <table className="w-full" data-testid="logs-table">
              <thead><tr className="bg-slate-50 dark:bg-[#1c1c2e]">
                <th className="text-left p-3 text-xs font-semibold text-[#71717a] border-b border-zinc-200 dark:border-[#2a2a3c]">Type</th>
                <th className="text-left p-3 text-xs font-semibold text-[#71717a] border-b border-zinc-200 dark:border-[#2a2a3c]">Time</th>
                <th className="text-left p-3 text-xs font-semibold text-[#71717a] border-b border-zinc-200 dark:border-[#2a2a3c]">User</th>
                <th className="text-left p-3 text-xs font-semibold text-[#71717a] border-b border-zinc-200 dark:border-[#2a2a3c]">Message</th>
              </tr></thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-100 dark:hover:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c] last:border-0">
                    <td className="p-3"><span className="px-2 py-1 text-[10px] font-bold rounded-full" style={{ backgroundColor: `${colors[l.type] || '#71717a'}15`, color: colors[l.type] || '#71717a' }}>{l.type}</span></td>
                    <td className="p-3 text-xs text-[#71717a] font-mono">{new Date(l.timestamp).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3 text-sm text-zinc-900 dark:text-[#e4e4e7]">{l.user || '-'}</td>
                    <td className="p-3 text-sm text-zinc-900 dark:text-[#e4e4e7]">{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <div className="text-center py-12 text-[#71717a]">No logs found</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
