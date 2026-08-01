import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Settings, AlertTriangle, Mail, ShieldCheck, CheckCircle2, XCircle, Save, Server as ServerIcon,
} from 'lucide-react';
import api from '../utils/api';
import { Button, Input, SavedFlash, useSavedFlash } from '../ui';

const timeAgo = (iso) => {
  if (!iso) return null;
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const HealthRow = ({ label, ok, value, neutral }) => {
  const Icon = neutral ? ServerIcon : (ok ? CheckCircle2 : XCircle);
  const color = neutral ? '#6E6E73' : (ok ? '#4ECDC4' : '#EB5757');
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#EDEDEF] dark:border-[#1c1c2e] last:border-0">
      <span className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">{label}</span>
      <span className="flex items-center gap-1.5 text-xs font-medium shrink-0" style={{ color }}>
        <Icon size={13} />
        {value}
      </span>
    </div>
  );
};

export const WebsiteSettings = () => {
  const [maintenance,  setMaintenance]  = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [emailInput,   setEmailInput]   = useState('');
  const [updatedAt,    setUpdatedAt]    = useState(null);
  const [updatedBy,    setUpdatedBy]    = useState(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [savingEmail,  setSavingEmail]  = useState(false);
  const [health,       setHealth]       = useState(null);
  const [emailSaved, flashEmailSaved] = useSavedFlash();

  const fetchSettings = useCallback(async () => {
    try {
      const r = await api.get('/api/website/settings');
      setMaintenance(r.data.maintenance_mode);
      setSupportEmail(r.data.support_email);
      setEmailInput(r.data.support_email);
      setUpdatedAt(r.data.updated_at || null);
      setUpdatedBy(r.data.updated_by || null);
    } catch {}
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/system/health');
      setHealth(r.data);
    } catch {}
  }, []);

  useEffect(() => { fetchSettings(); fetchHealth(); }, [fetchSettings, fetchHealth]);

  const toggleMaintenance = async () => {
    setLoadingMaintenance(true);
    try {
      const r = await api.put('/api/website/settings', { maintenance_mode: !maintenance });
      setMaintenance(r.data.maintenance_mode);
      setUpdatedAt(new Date().toISOString());
      toast.success(`Maintenance mode ${r.data.maintenance_mode ? 'enabled' : 'disabled'}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
    finally { setLoadingMaintenance(false); }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const r = await api.put('/api/website/settings', { support_email: emailInput.trim() });
      setSupportEmail(r.data.support_email);
      setEmailInput(r.data.support_email);
      setUpdatedAt(new Date().toISOString());
      flashEmailSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update email'); }
    finally { setSavingEmail(false); }
  };

  const emailDirty = emailInput.trim() !== supportEmail;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg w-10 h-10 bg-[#6E6E73]/10 flex items-center justify-center">
          <Settings size={20} className="text-[#6E6E73] dark:text-[#a1a1aa]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Website Settings</h1>
          <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Global configuration for the public site</p>
        </div>
      </div>

      {/* Maintenance mode */}
      <div className={`p-5 border ${maintenance ? 'bg-red-500/5 border-red-500/20' : 'bg-white dark:bg-[#0d0d14] border-[#D2D2D7] dark:border-[#2a2a3c]'}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className={maintenance ? 'text-red-400' : 'text-[#6E6E73]'} />
            <div>
              <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Maintenance Mode</h4>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                {maintenance ? 'Website is currently in maintenance — only staff accounts can sign in' : 'Website is live and accessible'}
              </p>
            </div>
          </div>
          <Button
            variant={maintenance ? 'primary' : 'danger'}
            loading={loadingMaintenance}
            onClick={toggleMaintenance}
            data-testid="maintenance-toggle"
          >
            {maintenance ? 'Disable Maintenance' : 'Enable Maintenance'}
          </Button>
        </div>
        {updatedAt && (
          <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] mt-3">
            Last changed {timeAgo(updatedAt)}{updatedBy ? ` by ${updatedBy}` : ''}
          </p>
        )}
      </div>

      {/* Support email */}
      <div className="rounded-xl p-5 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14]">
        <div className="flex items-center gap-3 mb-4">
          <Mail size={18} className="text-[#4ECDC4]" />
          <div>
            <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Support Contact Email</h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">Shown on the Contact page and the site footer.</p>
          </div>
        </div>
        <form onSubmit={saveEmail} className="flex items-end gap-2 flex-wrap">
          <Input
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            wrapperClassName="flex-1 min-w-[220px]"
            placeholder="support@yourdomain.com"
          />
          <Button type="submit" icon={Save} loading={savingEmail} disabled={!emailDirty}>Save</Button>
          <SavedFlash show={emailSaved} />
        </form>
      </div>

      {/* System health */}
      <div className="rounded-xl p-5 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14]">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck size={18} className="text-[#4ECDC4]" />
          <div>
            <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">System Health</h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">Read-only status of key backend configuration.</p>
          </div>
        </div>
        {health ? (
          <div>
            <HealthRow label="Backend version" ok neutral value={`v${health.version}`} />
            <HealthRow
              label="Stripe payments"
              ok={health.stripe_configured}
              value={health.stripe_configured ? `configured (${health.stripe_mode || 'unknown'})` : 'not configured'}
            />
            <HealthRow
              label="Stripe webhook"
              ok={health.stripe_webhook_configured}
              value={health.stripe_webhook_configured ? 'configured' : 'not configured'}
            />
            <HealthRow
              label="Session persistence"
              ok={health.jwt_persistent}
              value={health.jwt_persistent ? 'persistent across restarts' : 'ephemeral — sessions drop on restart'}
            />
            <HealthRow
              label="Emergency setup key"
              ok={health.master_key_configured}
              value={health.master_key_configured ? 'configured' : 'not set'}
            />
          </div>
        ) : (
          <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Loading…</p>
        )}
      </div>
    </div>
  );
};
