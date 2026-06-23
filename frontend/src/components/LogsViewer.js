import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { FileText, Filter, RefreshCw } from 'lucide-react';
import { Button, Card, CardHeader, CardBody, EmptyState, Badge, Input, Select } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LOG_COLORS = {
  send:            '#F2994A',
  claim:           '#4ECDC4',
  status:          '#F2C94C',
  variable_action: '#2F80ED',
  variable_access: '#71717a',
  delete:          '#EB5757',
};

const logVariant = (type) => {
  const map = { send: 'orange', claim: 'info', status: 'warning', variable_action: 'blue', delete: 'error' };
  return map[type] || 'default';
};

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

  return (
    <div className="max-w-7xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#9B51E018' }}>
              <FileText size={16} style={{ color: '#9B51E0' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Activity Logs</h3>
              <p className="text-xs text-[#71717a]">View project activity</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchLogs} loading={loading}>
            Refresh
          </Button>
        </CardHeader>

        <div className="px-6 py-4 bg-zinc-50 dark:bg-[#111118] border-b border-zinc-200 dark:border-[#2a2a3c]">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={13} className="text-[#71717a]" />
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest">Filters</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select
              label="Type"
              value={filters.type}
              onChange={e => setFilters({...filters, type: e.target.value})}
              data-testid="filter-type"
            >
              <option value="">All</option>
              <option value="send">Send</option>
              <option value="claim">Claim</option>
              <option value="status">Status</option>
              <option value="variable_action">Variable</option>
            </Select>
            <Input label="User" value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})} data-testid="filter-user" />
            <Input label="UID" value={filters.uid} onChange={e => setFilters({...filters, uid: e.target.value})} data-testid="filter-uid" />
            <Input label="Limit" type="number" min="10" max="1000" value={filters.limit} onChange={e => setFilters({...filters, limit: parseInt(e.target.value)})} data-testid="filter-limit" />
          </div>
          <Button className="mt-3" onClick={fetchLogs} loading={loading} data-testid="apply-filters">
            Apply Filters
          </Button>
        </div>

        <CardBody className="p-0">
          <div className="px-6 py-3 border-b border-zinc-100 dark:border-[#1c1c2e]">
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest">
              {logs.length} result{logs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {logs.length === 0 ? (
            <EmptyState icon={FileText} title="No logs found" description="Try adjusting your filters or wait for new activity." className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="logs-table">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-[#111118]">
                    {['Type', 'Time', 'User', 'Message'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest border-b border-zinc-200 dark:border-[#2a2a3c]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-[#111118] border-b border-zinc-100 dark:border-[#1c1c2e] last:border-0 transition-colors">
                      <td className="px-4 py-3">
                        <Badge variant={logVariant(l.type)}>{l.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#71717a] font-mono whitespace-nowrap">
                        {new Date(l.timestamp).toLocaleString('fr-FR', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-900 dark:text-[#e4e4e7]">{l.user || '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 dark:text-[#e4e4e7]">{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
