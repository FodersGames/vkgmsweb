import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FileText, FunnelSimple } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const LogsViewer = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    type: '',
    user: '',
    uid: '',
    limit: 100
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
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
    send: '#2563EB',
    claim: '#16A34A',
    status: '#F59E0B',
    auth: '#9333EA',
    user_action: '#EC4899'
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="bg-white border border-neutral-300 p-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText size={28} weight="bold" className="text-neutral-950" />
          <h2 className="text-3xl font-bold text-neutral-950" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            LOGS VIEWER
          </h2>
        </div>

        {/* Filters */}
        <div className="mb-6 p-6 bg-neutral-50 border border-neutral-300">
          <div className="flex items-center gap-2 mb-4">
            <FunnelSimple size={20} weight="bold" className="text-neutral-950" />
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500"
                 style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              FILTERS
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                TYPE
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                data-testid="filter-type"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                <option value="">All</option>
                <option value="send">Send</option>
                <option value="claim">Claim</option>
                <option value="status">Status</option>
                <option value="auth">Auth</option>
                <option value="user_action">User Action</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                USER
              </label>
              <input
                type="text"
                value={filters.user}
                onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                placeholder="Filter by user"
                data-testid="filter-user"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                UID
              </label>
              <input
                type="text"
                value={filters.uid}
                onChange={(e) => setFilters({ ...filters, uid: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                placeholder="Filter by UID"
                data-testid="filter-uid"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                LIMIT
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950"
                data-testid="filter-limit"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="mt-4 px-6 py-2 bg-neutral-950 text-white font-bold uppercase hover:bg-neutral-800 transition-all duration-200 disabled:opacity-50"
            data-testid="apply-filters"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            {loading ? 'LOADING...' : 'APPLY FILTERS'}
          </button>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3"
               style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            TOTAL LOGS: {logs.length}
          </div>
          <table className="w-full border-collapse" data-testid="logs-table">
            <thead>
              <tr className="border-b-2 border-neutral-300">
                <th className="text-left p-3 text-xs font-bold uppercase text-neutral-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>TYPE</th>
                <th className="text-left p-3 text-xs font-bold uppercase text-neutral-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>TIMESTAMP</th>
                <th className="text-left p-3 text-xs font-bold uppercase text-neutral-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>USER</th>
                <th className="text-left p-3 text-xs font-bold uppercase text-neutral-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>MESSAGE</th>
                <th className="text-left p-3 text-xs font-bold uppercase text-neutral-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={index} className="border-b border-neutral-200 hover:bg-neutral-100 transition-all duration-200">
                  <td className="p-3">
                    <span
                      className="px-2 py-1 text-xs font-mono uppercase font-bold"
                      style={{
                        backgroundColor: `${logTypeColors[log.type] || '#6B7280'}20`,
                        color: logTypeColors[log.type] || '#6B7280',
                        border: `1px solid ${logTypeColors[log.type] || '#6B7280'}`
                      }}
                    >
                      {log.type}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-neutral-700" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="p-3 text-sm text-neutral-950 font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    {log.user || '-'}
                  </td>
                  <td className="p-3 text-sm text-neutral-700" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    {log.message}
                  </td>
                  <td className="p-3 text-xs text-neutral-600" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {log.uid && `UID: ${log.uid}`}
                    {log.variable && ` | ${log.variable}`}
                    {log.amount && ` x${log.amount}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="text-center py-12 text-neutral-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              No logs found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};