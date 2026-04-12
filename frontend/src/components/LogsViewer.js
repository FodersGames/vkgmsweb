import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FileText, Filter } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const LogsViewer = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ type: '', user: '', uid: '', limit: 100 });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('log_type', filters.type);
      if (filters.user) params.append('user', filters.user);
      if (filters.uid) params.append('uid', filters.uid);
      params.append('limit', filters.limit);
      const response = await axios.get(`${API_URL}/api/logs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      setLogs(response.data.logs);
    } catch (error) { console.error('Failed to fetch logs'); }
    finally { setLoading(false); }
  };

  const logTypeColors = {
    send: { color: '#F2994A', bg: '#F2994A' },
    claim: { color: '#27AE60', bg: '#27AE60' },
    status: { color: '#F2C94C', bg: '#F2C94C' },
    auth: { color: '#9B51E0', bg: '#9B51E0' },
    user_action: { color: '#EB5757', bg: '#EB5757' },
    variable_action: { color: '#2F80ED', bg: '#2F80ED' },
    variable_access: { color: '#8A8A9A', bg: '#8A8A9A' }
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return timestamp; }
  };

  return (
    <div className="max-w-7xl">
      <div className="bg-white rounded-xl border border-[#EDE5DB] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE5DB] bg-gradient-to-r from-[#9B51E0]/5 to-[#BB6BD9]/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#9B51E0] to-[#BB6BD9] flex items-center justify-center shadow-sm">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1A1A2E]">Activity Logs</h3>
              <p className="text-xs text-[#8A8A9A]">View and filter all system activity</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#FBF9F7] border-b border-[#EDE5DB]">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-[#8A8A9A]" />
            <div className="text-xs font-semibold text-[#8A8A9A] uppercase tracking-wider">Filters</div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A8A9A] mb-2">Type</label>
              <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2.5 border border-[#EDE5DB] bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#9B51E0]/20"
                data-testid="filter-type">
                <option value="">All</option>
                <option value="send">Send</option>
                <option value="claim">Claim</option>
                <option value="status">Status</option>
                <option value="auth">Auth</option>
                <option value="user_action">User Action</option>
                <option value="variable_action">Variable Action</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A8A9A] mb-2">User</label>
              <input type="text" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                className="w-full px-3 py-2.5 border border-[#EDE5DB] bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#9B51E0]/20"
                placeholder="Filter by user" data-testid="filter-user" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A8A9A] mb-2">UID</label>
              <input type="text" value={filters.uid} onChange={(e) => setFilters({ ...filters, uid: e.target.value })}
                className="w-full px-3 py-2.5 border border-[#EDE5DB] bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#9B51E0]/20"
                placeholder="Filter by UID" data-testid="filter-uid" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#8A8A9A] mb-2">Limit</label>
              <input type="number" min="10" max="1000" value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 border border-[#EDE5DB] bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#9B51E0]/20"
                data-testid="filter-limit" />
            </div>
          </div>
          <button onClick={fetchLogs} disabled={loading}
            className="mt-4 bg-gradient-to-r from-[#9B51E0] to-[#BB6BD9] text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 shadow-sm"
            data-testid="apply-filters">
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>

        <div className="p-6">
          <div className="text-xs font-semibold text-[#8A8A9A] mb-3 uppercase tracking-wider">Total Logs: {logs.length}</div>
          <div className="overflow-x-auto rounded-lg border border-[#EDE5DB]">
            <table className="w-full border-collapse" data-testid="logs-table">
              <thead>
                <tr className="bg-[#FBF9F7]">
                  <th className="text-left p-3 text-xs font-semibold text-[#8A8A9A] border-b border-[#EDE5DB]">Type</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#8A8A9A] border-b border-[#EDE5DB]">Timestamp</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#8A8A9A] border-b border-[#EDE5DB]">User</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#8A8A9A] border-b border-[#EDE5DB]">Message</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#8A8A9A] border-b border-[#EDE5DB]">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={index} className="hover:bg-[#FBF9F7] transition-colors border-b border-[#EDE5DB] last:border-b-0">
                    <td className="p-3">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full"
                        style={{ backgroundColor: `${logTypeColors[log.type]?.bg || '#8A8A9A'}15`, color: logTypeColors[log.type]?.color || '#8A8A9A' }}>
                        {log.type}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-[#8A8A9A] font-mono text-xs">{formatTimestamp(log.timestamp)}</td>
                    <td className="p-3 text-sm text-[#1A1A2E] font-medium">{log.user || '-'}</td>
                    <td className="p-3 text-sm text-[#1A1A2E]">{log.message}</td>
                    <td className="p-3 text-xs text-[#C4B5A5] font-mono">
                      {log.uid && `UID: ${log.uid}`}{log.variable && ` | ${log.variable}`}{log.amount && ` x${log.amount}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (<div className="text-center py-12 text-[#C4B5A5]">No logs found</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};
