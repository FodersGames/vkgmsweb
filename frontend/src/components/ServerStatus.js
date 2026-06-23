import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_CFG = {
  open:        { label: 'Open',        variant: 'success', color: '#4ECDC4' },
  maintenance: { label: 'Maintenance', variant: 'warning', color: '#F2994A' },
  closed:      { label: 'Closed',      variant: 'error',   color: '#EB5757' },
};

export const ServerStatus = () => {
  const { token } = useAuth();
  const { selectedProject } = useProject();
  const [currentStatus, setCurrentStatus] = useState('open');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (selectedProject) fetchStatus(); /* eslint-disable-next-line */ }, [selectedProject]);

  const fetchStatus = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/projects/${selectedProject.slug}/status`);
      setCurrentStatus(r.data.status);
    } catch (e) {}
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

  const cfg = STATUS_CFG[currentStatus] || STATUS_CFG.open;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4ECDC418' }}>
              <Activity size={16} style={{ color: '#4ECDC4' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Server Status</h3>
              <p className="text-xs text-[#71717a]">Control your server state</p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest mb-3">
              Current Status
            </p>
            <div className="flex items-center gap-2" data-testid="current-status">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest mb-3">
              Change Status
            </p>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(STATUS_CFG).map(([s, c]) => {
                const isActive = currentStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={loading || isActive}
                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                      isActive
                        ? 'text-white'
                        : 'bg-zinc-50 dark:bg-[#111118] border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/20'
                    }`}
                    style={isActive ? { backgroundColor: c.color, color: '#fff' } : { color: c.color }}
                    data-testid={`status-${s}-button`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
