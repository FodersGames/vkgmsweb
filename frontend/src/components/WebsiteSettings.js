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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#71717a18' }}>
              <Settings size={16} style={{ color: '#71717a' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Website Settings</h3>
              <p className="text-xs text-gray-500">Global website configuration</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className={`p-5 rounded-xl border ${maintenance ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className={maintenance ? 'text-error-400' : 'text-gray-500'} />
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Maintenance Mode</h4>
                  <p className="text-xs text-gray-500">
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
