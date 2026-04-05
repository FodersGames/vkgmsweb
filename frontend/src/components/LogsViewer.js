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

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('log_type', filters.type);
      if (filters.user) params.append('user', filters.user);
      if (filters.uid) params.append('uid', filters.uid);
      params.append('limit', filters.limit);

      const response = await axios.get(`${API_URL}/api/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const logTypeColors = {
    send: { color: '#2563EB', bg: '#DBEAFE' },
    claim: { color: '#107C10', bg: '#DFF6DD' },
    status: { color: '#F59E0B', bg: '#FEF3C7' },
    auth: { color: '#9333EA', bg: '#F3E8FF' },
    user_action: { color: '#EC4899', bg: '#FCE7F3' },
    variable_action: { color: '#0078D4', bg: '#DEECF9' },
    variable_access: { color: '#605E5C', bg: '#F3F2F1' }
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="max-w-7xl">
      <div className="bg-white border border-[#EDEBE9] rounded-sm shadow-sm">
        <div className="px-6 py-4 border-b border-[#EDEBE9] bg-[#FAFAFA]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0078D4] rounded-sm flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <h3 className="text-lg font-medium text-[#201F1E]">Activity Logs</h3>
          </div>
        </div>

        <div className="p-6 bg-[#FAFAFA] border-b border-[#EDEBE9]">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-[#605E5C]" />
            <div className="text-xs font-semibold text-[#605E5C]">FILTERS</div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#605E5C] mb-2">TYPE</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-[#EDEBE9] bg-white rounded-sm text-sm focus:ring-1 focus:ring-[#0078D4]"
                data-testid="filter-type"
              >
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
              <label className="block text-xs font-semibold text-[#605E5C] mb-2">USER</label>
              <input
                type="text"
                value={filters.user}
                onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                className="w-full px-3 py-2 border border-[#EDEBE9] bg-white rounded-sm text-sm focus:ring-1 focus:ring-[#0078D4]"
                placeholder="Filter by user"
                data-testid="filter-user"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#605E5C] mb-2">UID</label>
              <input
                type="text"
                value={filters.uid}
                onChange={(e) => setFilters({ ...filters, uid: e.target.value })}
                className="w-full px-3 py-2 border border-[#EDEBE9] bg-white rounded-sm text-sm focus:ring-1 focus:ring-[#0078D4]"
                placeholder="Filter by UID"
                data-testid="filter-uid"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#605E5C] mb-2">LIMIT</label>
              <input
                type="number"
                min="10"
                max="1000"
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-[#EDEBE9] bg-white rounded-sm text-sm focus:ring-1 focus:ring-[#0078D4]"
                data-testid="filter-limit"
              />
            </div>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="mt-4 bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            data-testid="apply-filters"
          >
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>

        <div className="p-6">
          <div className="text-xs font-semibold text-[#605E5C] mb-3">TOTAL LOGS: {logs.length}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" data-testid="logs-table">
              <thead>
                <tr className="border-b-2 border-[#EDEBE9] bg-[#FAFAFA]">
                  <th className="text-left p-3 text-xs font-semibold text-[#605E5C]">TYPE</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#605E5C]">TIMESTAMP</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#605E5C]">USER</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#605E5C]">MESSAGE</th>
                  <th className="text-left p-3 text-xs font-semibold text-[#605E5C]">DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={index} className="border-b border-[#EDEBE9] hover:bg-[#FAFAFA] transition-colors">
                    <td className="p-3">
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-sm"
                        style={{
                          backgroundColor: logTypeColors[log.type]?.bg || '#F3F2F1',
                          color: logTypeColors[log.type]?.color || '#605E5C'
                        }}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-[#605E5C] font-mono">{formatTimestamp(log.timestamp)}</td>
                    <td className="p-3 text-sm text-[#201F1E] font-medium">{log.user || '-'}</td>
                    <td className="p-3 text-sm text-[#201F1E]">{log.message}</td>
                    <td className="p-3 text-xs text-[#605E5C] font-mono">
                      {log.uid && `UID: ${log.uid}`}
                      {log.variable && ` | ${log.variable}`}
                      {log.amount && ` x${log.amount}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="text-center py-12 text-[#605E5C]">No logs found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
