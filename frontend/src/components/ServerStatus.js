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

  useEffect(() => {
    if (selectedProject) fetchStatus();
    // eslint-disable-next-line
  }, [selectedProject]);

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/projects/${selectedProject.slug}/status`);
      setCurrentStatus(response.data.status);
    } catch (error) {
      console.error('Failed to fetch status');
    }
  };

  const changeStatus = async (newStatus) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/status`, { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } });
      setCurrentStatus(newStatus);
      toast.success(`Server status changed to ${newStatus}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change status');
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    open: { color: '#27AE60', gradient: 'from-[#27AE60] to-[#219653]', label: 'Open' },
    maintenance: { color: '#F2994A', gradient: 'from-[#F2994A] to-[#F2C94C]', label: 'Maintenance' },
    closed: { color: '#EB5757', gradient: 'from-[#EB5757] to-[#E04848]', label: 'Closed' }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-[#EDE5DB] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE5DB] bg-gradient-to-r from-[#27AE60]/5 to-[#219653]/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#27AE60] to-[#219653] flex items-center justify-center shadow-sm">
              <Activity size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1A1A2E]">Server Status</h3>
              <p className="text-xs text-[#8A8A9A]">Control your server state</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <div className="text-xs font-semibold text-[#8A8A9A] mb-3 uppercase tracking-wider">Current Status</div>
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm"
              style={{ backgroundColor: `${statusConfig[currentStatus].color}15`, color: statusConfig[currentStatus].color }}
              data-testid="current-status">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: statusConfig[currentStatus].color }}></span>
              {statusConfig[currentStatus].label}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#8A8A9A] mb-3 uppercase tracking-wider">Change Status</div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(statusConfig).map(([status, config]) => (
                <button key={status} onClick={() => changeStatus(status)}
                  disabled={loading || currentStatus === status}
                  className={`py-3 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    currentStatus === status
                      ? `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                      : 'bg-[#FBF9F7] border border-[#EDE5DB] hover:shadow-sm'
                  }`}
                  style={currentStatus !== status ? { color: config.color } : {}}
                  data-testid={`status-${status}-button`}>
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
