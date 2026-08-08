import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Settings, AlertTriangle, Mail, Megaphone, Save, Link2, Clock, X } from 'lucide-react';
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

const SOCIAL_FIELDS = [
  { key: 'discord', label: 'Discord' },
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
];

export const GlobalManagement = () => {
  const [maintenance,  setMaintenance]  = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [emailInput,   setEmailInput]   = useState('');
  const [updatedAt,    setUpdatedAt]    = useState(null);
  const [updatedBy,    setUpdatedBy]    = useState(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [savingEmail,  setSavingEmail]  = useState(false);
  const [emailSaved, flashEmailSaved] = useSavedFlash();

  const [scheduledAt, setScheduledAt] = useState(null);
  const [scheduledMessage, setScheduledMessage] = useState('');
  const [scheduleMinutes, setScheduleMinutes] = useState('10');
  const [scheduleMessageInput, setScheduleMessageInput] = useState('');
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [cancelingSchedule, setCancelingSchedule] = useState(false);

  const [bannerInput, setBannerInput] = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [savedBanner, setSavedBanner] = useState({ text: '', active: false });
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerSaved, flashBannerSaved] = useSavedFlash();

  const [socialInputs, setSocialInputs] = useState({});
  const [savedSocial, setSavedSocial] = useState({});
  const [savingSocial, setSavingSocial] = useState(false);
  const [socialSaved, flashSocialSaved] = useSavedFlash();

  const [seoInput, setSeoInput] = useState('');
  const [savedSeo, setSavedSeo] = useState('');
  const [savingSeo, setSavingSeo] = useState(false);
  const [seoSaved, flashSeoSaved] = useSavedFlash();

  const fetchSettings = useCallback(async () => {
    try {
      const r = await api.get('/api/website/settings');
      setMaintenance(r.data.maintenance_mode);
      setScheduledAt(r.data.maintenance_scheduled_at || null);
      setScheduledMessage(r.data.maintenance_announcement || '');
      setSupportEmail(r.data.support_email);
      setEmailInput(r.data.support_email);
      setUpdatedAt(r.data.updated_at || null);
      setUpdatedBy(r.data.updated_by || null);
      setBannerInput(r.data.announcement_banner || '');
      setBannerActive(!!r.data.announcement_active);
      setSavedBanner({ text: r.data.announcement_banner || '', active: !!r.data.announcement_active });
      setSocialInputs(r.data.social_links || {});
      setSavedSocial(r.data.social_links || {});
      setSeoInput(r.data.seo_description || '');
      setSavedSeo(r.data.seo_description || '');
    } catch {}
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const toggleMaintenance = async () => {
    setLoadingMaintenance(true);
    try {
      const r = await api.put('/api/website/settings', { maintenance_mode: !maintenance });
      setMaintenance(r.data.maintenance_mode);
      setScheduledAt(r.data.maintenance_scheduled_at || null);
      setScheduledMessage(r.data.maintenance_announcement || '');
      setUpdatedAt(new Date().toISOString());
      toast.success(`Maintenance mode ${r.data.maintenance_mode ? 'enabled' : 'disabled'}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
    finally { setLoadingMaintenance(false); }
  };

  const scheduleMaintenance = async (e) => {
    e.preventDefault();
    const minutes = parseFloat(scheduleMinutes);
    if (!(minutes > 0)) { toast.error('Enter a number of minutes greater than 0'); return; }
    setSchedulingLoading(true);
    try {
      const at = new Date(Date.now() + minutes * 60000).toISOString();
      const r = await api.put('/api/website/settings', {
        maintenance_scheduled_at: at,
        maintenance_announcement: scheduleMessageInput.trim(),
      });
      setScheduledAt(r.data.maintenance_scheduled_at || null);
      setScheduledMessage(r.data.maintenance_announcement || '');
      setUpdatedAt(new Date().toISOString());
      toast.success(`Maintenance scheduled in ${minutes} minute(s)`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to schedule maintenance'); }
    finally { setSchedulingLoading(false); }
  };

  const cancelSchedule = async () => {
    setCancelingSchedule(true);
    try {
      const r = await api.put('/api/website/settings', { maintenance_scheduled_at: '' });
      setScheduledAt(r.data.maintenance_scheduled_at || null);
      setScheduledMessage(r.data.maintenance_announcement || '');
      setUpdatedAt(new Date().toISOString());
      toast.success('Scheduled maintenance cancelled');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to cancel schedule'); }
    finally { setCancelingSchedule(false); }
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

  const saveBanner = async (e) => {
    e.preventDefault();
    setSavingBanner(true);
    try {
      const r = await api.put('/api/website/settings', { announcement_banner: bannerInput.trim(), announcement_active: bannerActive });
      setSavedBanner({ text: r.data.announcement_banner, active: r.data.announcement_active });
      setUpdatedAt(new Date().toISOString());
      flashBannerSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update banner'); }
    finally { setSavingBanner(false); }
  };

  const saveSocial = async (e) => {
    e.preventDefault();
    setSavingSocial(true);
    try {
      const r = await api.put('/api/website/settings', { social_links: socialInputs });
      setSavedSocial(r.data.social_links);
      setUpdatedAt(new Date().toISOString());
      flashSocialSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update social links'); }
    finally { setSavingSocial(false); }
  };

  const saveSeo = async (e) => {
    e.preventDefault();
    setSavingSeo(true);
    try {
      const r = await api.put('/api/website/settings', { seo_description: seoInput.trim() });
      setSavedSeo(r.data.seo_description);
      setUpdatedAt(new Date().toISOString());
      flashSeoSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update SEO description'); }
    finally { setSavingSeo(false); }
  };

  const emailDirty = emailInput.trim() !== supportEmail;
  const bannerDirty = bannerInput.trim() !== savedBanner.text || bannerActive !== savedBanner.active;
  const socialDirty = JSON.stringify(socialInputs) !== JSON.stringify(savedSocial);
  const seoDirty = seoInput.trim() !== savedSeo;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg w-10 h-10 bg-[#6E6E73]/10 flex items-center justify-center">
          <Settings size={20} className="text-[#6E6E73] dark:text-[#a1a1aa]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Global Website Management</h1>
          <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Site-wide configuration for the public site</p>
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

      {/* Scheduled maintenance */}
      <div className="rounded-xl p-5 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14]">
        <div className="flex items-center gap-3 mb-4">
          <Clock size={18} className="text-[#F2994A]" />
          <div>
            <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Scheduled Maintenance</h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
              Plan a maintenance window ahead of time — a countdown banner shows on the public site, and everyone is automatically switched to the maintenance page the moment it's due, wherever they are on the site.
            </p>
          </div>
        </div>

        {scheduledAt ? (
          <div className="flex items-center justify-between gap-4 flex-wrap p-3 rounded-lg bg-[#F2994A]/10 border border-[#F2994A]/20">
            <div>
              <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">
                Starts {new Date(scheduledAt).toLocaleString()}
              </p>
              {scheduledMessage && (
                <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-1">"{scheduledMessage}"</p>
              )}
            </div>
            <Button variant="danger" icon={X} loading={cancelingSchedule} onClick={cancelSchedule}>
              Cancel schedule
            </Button>
          </div>
        ) : (
          <form onSubmit={scheduleMaintenance} className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] shrink-0">Start in</label>
              <Input
                type="number"
                min="1"
                value={scheduleMinutes}
                onChange={e => setScheduleMinutes(e.target.value)}
                className="w-24"
              />
              <span className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">minutes</span>
            </div>
            <Input
              value={scheduleMessageInput}
              onChange={e => setScheduleMessageInput(e.target.value)}
              placeholder="Message shown to visitors (optional)"
              maxLength={280}
            />
            <Button type="submit" icon={Clock} loading={schedulingLoading} disabled={maintenance}>
              Schedule maintenance
            </Button>
            {maintenance && (
              <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a]">Maintenance is already enabled — disable it first to schedule a future window.</p>
            )}
          </form>
        )}
      </div>

      {/* Announcement banner */}
      <div className="rounded-xl p-5 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14]">
        <div className="flex items-center gap-3 mb-4">
          <Megaphone size={18} className="text-[#4ECDC4]" />
          <div>
            <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Announcement Banner</h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">A site-wide banner independent of maintenance mode — for "we're aware of an issue" or promo callouts.</p>
          </div>
        </div>
        <form onSubmit={saveBanner} className="space-y-3">
          <Input
            value={bannerInput}
            onChange={e => setBannerInput(e.target.value)}
            placeholder="e.g. Black Friday sale is live — 20% off everything!"
            maxLength={280}
          />
          <label className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
            <input type="checkbox" checked={bannerActive} onChange={e => setBannerActive(e.target.checked)} className="w-3.5 h-3.5 rounded" />
            Show this banner on the public site
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" icon={Save} loading={savingBanner} disabled={!bannerDirty}>Save</Button>
            <SavedFlash show={bannerSaved} />
          </div>
        </form>
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

      {/* Social links */}
      <div className="rounded-xl p-5 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14]">
        <div className="flex items-center gap-3 mb-4">
          <Link2 size={18} className="text-[#4ECDC4]" />
          <div>
            <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Social Links</h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">Shown in the site footer. Leave blank to hide a platform.</p>
          </div>
        </div>
        <form onSubmit={saveSocial} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SOCIAL_FIELDS.map(f => (
              <div key={f.key}>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-wider mb-1">{f.label}</label>
                <Input
                  value={socialInputs[f.key] || ''}
                  onChange={e => setSocialInputs(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={`https://...`}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" icon={Save} loading={savingSocial} disabled={!socialDirty}>Save</Button>
            <SavedFlash show={socialSaved} />
          </div>
        </form>
      </div>

      {/* SEO description */}
      <div className="rounded-xl p-5 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14]">
        <div className="flex items-center gap-3 mb-4">
          <Settings size={18} className="text-[#4ECDC4]" />
          <div>
            <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Default SEO Description</h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">Used as the meta description on public pages that don't set their own.</p>
          </div>
        </div>
        <form onSubmit={saveSeo} className="space-y-3">
          <Input value={seoInput} onChange={e => setSeoInput(e.target.value)} maxLength={300} placeholder="A short, compelling description of Vakar Games." />
          <div className="flex items-center gap-2">
            <Button type="submit" icon={Save} loading={savingSeo} disabled={!seoDirty}>Save</Button>
            <SavedFlash show={seoSaved} />
          </div>
        </form>
      </div>
    </div>
  );
};
