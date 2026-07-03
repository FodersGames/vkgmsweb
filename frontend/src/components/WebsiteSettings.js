import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Settings, AlertTriangle } from 'lucide-react';
import { Button, Card, CardHeader, CardBody } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const WebsiteSettings = () => {
  const { token } = useAuth();
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/settings`).then(r => setMaintenance(r.data.maintenance_mode)).catch(() => {});
  }, []);

  const toggleMaintenance = async () => {
    setLoading(true);
    try {
      const r = await axios.put(`${API_URL}/api/website/settings`, { maintenance_mode: !maintenance }, { headers: { Authorization: `Bearer ${token}` } });
      setMaintenance(r.data.maintenance_mode);
      toast.success(`Maintenance mode ${r.data.maintenance_mode ? 'enabled' : 'disabled'}`);
    } catch (e) { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#71717a18' }}>
              <Settings size={16} style={{ color: '#71717a' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Website Settings</h3>
              <p className="text-xs text-[#71717a]">Global website configuration</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className={`p-5 rounded-xl border ${maintenance ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-50 dark:bg-[#111118] border-zinc-200 dark:border-[#2a2a3c]'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className={maintenance ? 'text-red-400' : 'text-[#71717a]'} />
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Maintenance Mode</h4>
                  <p className="text-xs text-[#71717a]">
                    {maintenance ? 'Website is currently in maintenance' : 'Website is live and accessible'}
                  </p>
                </div>
              </div>
              <Button
                variant={maintenance ? 'primary' : 'danger'}
                loading={loading}
                onClick={toggleMaintenance}
                data-testid="maintenance-toggle"
              >
                {maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
