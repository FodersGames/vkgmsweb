import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { ActivityIcon } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ServerStatus = () => {
  const { token } = useAuth();
  const [currentStatus, setCurrentStatus] = useState('open');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
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

  const statusColors = {
    open: '#16A34A',
    maintenance: '#F59E0B',
    closed: '#DC2626'
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-neutral-300 p-8">
        <div className="flex items-center gap-3 mb-6">
          <ActivityIcon size={28} weight="bold" className="text-neutral-950" />
          <h2 className="text-3xl font-bold text-neutral-950" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            SERVER STATUS
          </h2>
        </div>

        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2"
               style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            CURRENT STATUS
          </div>
          <div 
            className="inline-block px-4 py-2 border-2 font-bold uppercase"
            style={{ 
              borderColor: statusColors[currentStatus],
              color: statusColors[currentStatus],
              fontFamily: 'JetBrains Mono, monospace'
            }}
            data-testid="current-status"
          >
            {currentStatus}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4"
               style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            CHANGE STATUS
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => changeStatus('open')}
              disabled={loading || currentStatus === 'open'}
              className="py-3 border-2 font-bold uppercase transition-all duration-200 disabled:opacity-50"
              style={{
                borderColor: '#16A34A',
                backgroundColor: currentStatus === 'open' ? '#16A34A' : 'white',
                color: currentStatus === 'open' ? 'white' : '#16A34A',
                fontFamily: 'IBM Plex Sans, sans-serif'
              }}
              data-testid="status-open-button"
            >
              OPEN
            </button>

            <button
              onClick={() => changeStatus('maintenance')}
              disabled={loading || currentStatus === 'maintenance'}
              className="py-3 border-2 font-bold uppercase transition-all duration-200 disabled:opacity-50"
              style={{
                borderColor: '#F59E0B',
                backgroundColor: currentStatus === 'maintenance' ? '#F59E0B' : 'white',
                color: currentStatus === 'maintenance' ? 'white' : '#F59E0B',
                fontFamily: 'IBM Plex Sans, sans-serif'
              }}
              data-testid="status-maintenance-button"
            >
              MAINTENANCE
            </button>

            <button
              onClick={() => changeStatus('closed')}
              disabled={loading || currentStatus === 'closed'}
              className="py-3 border-2 font-bold uppercase transition-all duration-200 disabled:opacity-50"
              style={{
                borderColor: '#DC2626',
                backgroundColor: currentStatus === 'closed' ? '#DC2626' : 'white',
                color: currentStatus === 'closed' ? 'white' : '#DC2626',
                fontFamily: 'IBM Plex Sans, sans-serif'
              }}
              data-testid="status-closed-button"
            >
              CLOSED
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};