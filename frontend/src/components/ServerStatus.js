import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { ActivityIcon } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ServerStatus = () => {
  const { token } = useAuth();
  const [currentStatus, setCurrentStatus] = useState('open');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/status`);
      setCurrentStatus(response.data.status);
    } catch (error) {
      console.error('Failed to fetch status');
    }
  };

  const changeStatus = async (newStatus) => {
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentStatus(newStatus);
      toast.success(`Server status changed to ${newStatus}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change status');
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    open: { color: '#107C10', bg: '#DFF6DD', label: 'Open' },
    maintenance: { color: '#F59E0B', bg: '#FEF3C7', label: 'Maintenance' },
    closed: { color: '#A4262C', bg: '#FDE7E9', label: 'Closed' }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-[#EDEBE9] rounded-sm shadow-sm">
        <div className="px-6 py-4 border-b border-[#EDEBE9] bg-[#FAFAFA]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0078D4] rounded-sm flex items-center justify-center">
              <ActivityIcon size={16} className="text-white" />
            </div>
            <h3 className="text-lg font-medium text-[#201F1E]">Server Status</h3>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="text-xs font-semibold text-[#605E5C] mb-3">CURRENT STATUS</div>
            <div 
              className="inline-flex items-center px-4 py-2 rounded-sm font-medium text-sm"
              style={{ 
                backgroundColor: statusConfig[currentStatus].bg,
                color: statusConfig[currentStatus].color
              }}
              data-testid="current-status"
            >
              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: statusConfig[currentStatus].color }}></span>
              {statusConfig[currentStatus].label}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#605E5C] mb-3">CHANGE STATUS</div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(statusConfig).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => changeStatus(status)}
                  disabled={loading || currentStatus === status}
                  className="py-2.5 px-4 border rounded-sm text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: config.color,
                    backgroundColor: currentStatus === status ? config.color : 'white',
                    color: currentStatus === status ? 'white' : config.color
                  }}
                  data-testid={`status-${status}-button`}
                >
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