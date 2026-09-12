import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Settings,
  AlertTriangle,
  Mail,
  Megaphone,
  Save,
  Link2,
  Clock,
  X,
  Check,
  Globe,
  Share2,
  Calendar,
  Eye,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import api from '../utils/api';
import { clearWebsiteSettingsCache } from '../utils/publicCache';
import { Button, Input, SavedFlash, useSavedFlash } from '../ui';

const timeAgo = (iso) => {
  if (!iso) return null;
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
};

const SOCIAL_FIELDS = [
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/vakargames', color: '#5865F2' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/vakargames', color: '#1DA1F2' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@vakargames', color: '#FF0000' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@vakargames', color: '#FE2C55' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/vakargames', color: '#E1306C' },
];

const QUICK_DELAYS = [
  { label: '+10 min', value: '10' },
  { label: '+30 min', value: '30' },
  { label: '+1 heure', value: '60' },
  { label: '+2 heures', value: '120' },
  { label: '+4 heures', value: '240' },
];

export const GlobalManagement = () => {
  const [maintenance,  setMaintenance]  = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [emailInput,   setEmailInput]   = useState('');
  const [updatedAt,    setUpdatedAt]    = useState(null);
  const [updatedBy,    setUpdatedBy]    = useState(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [savingEmail,  setSavingEmail]  = useState(false);
  const [emailSaved, flashEmailSaved]   = useSavedFlash();

  const [scheduledAt, setScheduledAt]   = useState(null);
  const [scheduledMessage, setScheduledMessage] = useState('');
  const [scheduleMinutes, setScheduleMinutes]   = useState('10');
  const [scheduleMessageInput, setScheduleMessageInput] = useState('');
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [cancelingSchedule, setCancelingSchedule] = useState(false);

  const [bannerInput, setBannerInput]   = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [savedBanner, setSavedBanner]   = useState({ text: '', active: false });
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerSaved, flashBannerSaved] = useSavedFlash();

  const [socialInputs, setSocialInputs] = useState({});
  const [savedSocial, setSavedSocial]   = useState({});
  const [savingSocial, setSavingSocial] = useState(false);
  const [socialSaved, flashSocialSaved] = useSavedFlash();

  const [seoInput, setSeoInput]         = useState('');
  const [savedSeo, setSavedSeo]         = useState('');
  const [savingSeo, setSavingSeo]       = useState(false);
  const [seoSaved, flashSeoSaved]       = useSavedFlash();

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
      clearWebsiteSettingsCache();
      setMaintenance(r.data.maintenance_mode);
      setScheduledAt(r.data.maintenance_scheduled_at || null);
      setScheduledMessage(r.data.maintenance_announcement || '');
      setUpdatedAt(new Date().toISOString());
      toast.success(`Mode maintenance ${r.data.maintenance_mode ? 'activé' : 'désactivé'}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec de mise à jour');
    } finally {
      setLoadingMaintenance(false);
    }
  };

  const scheduleMaintenance = async (e) => {
    e.preventDefault();
    const minutes = parseFloat(scheduleMinutes);
    if (!(minutes > 0)) {
      toast.error('Indiquez un nombre de minutes supérieur à 0');
      return;
    }
    setSchedulingLoading(true);
    try {
      const at = new Date(Date.now() + minutes * 60000).toISOString();
      const r = await api.put('/api/website/settings', {
        maintenance_scheduled_at: at,
        maintenance_announcement: scheduleMessageInput.trim(),
      });
      clearWebsiteSettingsCache();
      setScheduledAt(r.data.maintenance_scheduled_at || null);
      setScheduledMessage(r.data.maintenance_announcement || '');
      setUpdatedAt(new Date().toISOString());
      toast.success(`Maintenance programmée dans ${minutes} minute(s)`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec de planification');
    } finally {
      setSchedulingLoading(false);
    }
  };

  const cancelSchedule = async () => {
    setCancelingSchedule(true);
    try {
      const r = await api.put('/api/website/settings', { maintenance_scheduled_at: '' });
      clearWebsiteSettingsCache();
      setScheduledAt(r.data.maintenance_scheduled_at || null);
      setScheduledMessage(r.data.maintenance_announcement || '');
      setUpdatedAt(new Date().toISOString());
      toast.success('Maintenance programmée annulée');
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec d'annulation");
    } finally {
      setCancelingSchedule(false);
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const r = await api.put('/api/website/settings', { support_email: emailInput.trim() });
      clearWebsiteSettingsCache();
      setSupportEmail(r.data.support_email);
      setEmailInput(r.data.support_email);
      setUpdatedAt(new Date().toISOString());
      flashEmailSaved();
      toast.success('Adresse e-mail enregistrée');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec de mise à jour');
    } finally {
      setSavingEmail(false);
    }
  };

  const saveBanner = async (e) => {
    e.preventDefault();
    setSavingBanner(true);
    try {
      const r = await api.put('/api/website/settings', {
        announcement_banner: bannerInput.trim(),
        announcement_active: bannerActive,
      });
      clearWebsiteSettingsCache();
      setSavedBanner({ text: r.data.announcement_banner, active: r.data.announcement_active });
      setUpdatedAt(new Date().toISOString());
      flashBannerSaved();
      toast.success('Bannière mise à jour avec succès');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec de mise à jour');
    } finally {
      setSavingBanner(false);
    }
  };

  const saveSocial = async (e) => {
    e.preventDefault();
    setSavingSocial(true);
    try {
      const r = await api.put('/api/website/settings', { social_links: socialInputs });
      setSavedSocial(r.data.social_links);
      setUpdatedAt(new Date().toISOString());
      flashSocialSaved();
      toast.success('Liens sociaux sauvegardés');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec de mise à jour');
    } finally {
      setSavingSocial(false);
    }
  };

  const saveSeo = async (e) => {
    e.preventDefault();
    setSavingSeo(true);
    try {
      const r = await api.put('/api/website/settings', { seo_description: seoInput.trim() });
      setSavedSeo(r.data.seo_description);
      setUpdatedAt(new Date().toISOString());
      flashSeoSaved();
      toast.success('Description SEO mise à jour');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec de mise à jour');
    } finally {
      setSavingSeo(false);
    }
  };

  const emailDirty = emailInput.trim() !== supportEmail;
  const bannerDirty = bannerInput.trim() !== savedBanner.text || bannerActive !== savedBanner.active;
  const socialDirty = JSON.stringify(socialInputs) !== JSON.stringify(savedSocial);
  const seoDirty = seoInput.trim() !== savedSeo;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center shadow-inner">
            <Settings size={24} className="text-[#FF6600]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#1D1D1F] dark:text-white tracking-tight">Paramètres du Site Web</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                Production
              </span>
            </div>
            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">
              Configuration globale de la plateforme publique Vakar Games
            </p>
          </div>
        </div>

        {updatedAt && (
          <div className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#A1A1A6] px-3.5 py-1.5 rounded-full bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
            <Clock size={13} className="text-[#FF6600]" />
            <span>Mis à jour {timeAgo(updatedAt)}{updatedBy ? ` par ${updatedBy}` : ''}</span>
          </div>
        )}
      </div>

      {/* ── SECTION 1 : MAINTENANCE IMMÉDIATE & PROGRAMMÉE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instant Maintenance Switch Card */}
        <div className={`rounded-3xl p-6 md:p-7 border transition-all duration-300 shadow-xs flex flex-col justify-between ${
          maintenance
            ? 'bg-rose-500/5 border-rose-500/30 dark:bg-rose-950/10 dark:border-rose-500/30'
            : 'bg-white dark:bg-[#151520] border-[#E5E5EA] dark:border-[#2a2a3c]'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${maintenance ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {maintenance ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white">Maintenance Immédiate</h3>
                  <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">Bascule instantanée du site en maintenance</p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                maintenance
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${maintenance ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                {maintenance ? 'Actif (Coupure)' : 'En Ligne'}
              </span>
            </div>

            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed mb-6">
              Lorsque la maintenance est activée, tous les visiteurs publics sont redirigés vers l'écran de maintenance. Seuls les comptes Staff / Super Admin conservent l'accès au tableau de bord.
            </p>
          </div>

          <div className="pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
            <span className="text-xs font-medium text-[#1D1D1F] dark:text-white">
              {maintenance ? 'Désactiver la maintenance :' : 'Activer la maintenance :'}
            </span>
            <Button
              variant={maintenance ? 'primary' : 'danger'}
              loading={loadingMaintenance}
              onClick={toggleMaintenance}
              className="px-5 py-2 text-xs font-semibold rounded-xl shadow-xs"
            >
              {maintenance ? 'Rétablir le Site en Ligne' : 'Passer en Maintenance'}
            </Button>
          </div>
        </div>

        {/* Scheduled Maintenance Card */}
        <div className="rounded-3xl p-6 md:p-7 border border-[#E5E5EA] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white">Maintenance Programmée</h3>
                  <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">Planifier un créneau futur avec décompte</p>
                </div>
              </div>

              {scheduledAt && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Planifié
                </span>
              )}
            </div>

            {scheduledAt ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Début de coupure :</span>
                  <span className="text-xs font-mono font-semibold text-[#1D1D1F] dark:text-white">
                    {new Date(scheduledAt).toLocaleString()}
                  </span>
                </div>
                {scheduledMessage && (
                  <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] italic">
                    « {scheduledMessage} »
                  </p>
                )}
                <div className="pt-2">
                  <Button
                    variant="danger"
                    icon={X}
                    loading={cancelingSchedule}
                    onClick={cancelSchedule}
                    className="w-full py-2 text-xs rounded-xl"
                  >
                    Annuler la maintenance planifiée
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={scheduleMaintenance} className="space-y-4">
                {/* Delay quick chips */}
                <div>
                  <label className="block text-xs font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5">
                    Délai avant coupure :
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {QUICK_DELAYS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setScheduleMinutes(d.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                          scheduleMinutes === d.value
                            ? 'bg-[#FF6600] text-white shadow-xs'
                            : 'bg-black/5 dark:bg-white/5 text-[#6E6E73] dark:text-[#A1A1A6] hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <Input
                        type="number"
                        min="1"
                        value={scheduleMinutes}
                        onChange={e => setScheduleMinutes(e.target.value)}
                        className="w-20 text-xs py-1 px-2"
                      />
                      <span className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">min</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6E6E73] dark:text-[#A1A1A6] mb-1.5">
                    Message affiché aux joueurs / visiteurs (optionnel) :
                  </label>
                  <Input
                    value={scheduleMessageInput}
                    onChange={e => setScheduleMessageInput(e.target.value)}
                    placeholder="ex: Mise à jour des serveurs dans quelques instants..."
                    maxLength={280}
                  />
                </div>

                <Button
                  type="submit"
                  icon={Clock}
                  loading={schedulingLoading}
                  disabled={maintenance}
                  className="w-full py-2.5 text-xs font-semibold rounded-xl"
                >
                  Programmer le créneau
                </Button>
                {maintenance && (
                  <p className="text-[11px] text-amber-500 text-center">
                    La maintenance est déjà active actuellement.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2 : BANNIÈRE D'ANNONCE DU SITE ── */}
      <div className="rounded-3xl p-6 md:p-8 border border-[#E5E5EA] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] shadow-xs space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
              <Megaphone size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white">Bannière d'Annonce Globale</h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
                Bandeau d'information affiché tout en haut du site public (promotions, concours, alertes)
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={bannerActive}
              onChange={e => setBannerActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6.5 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-[#FF6600]" />
            <span className="ml-3 text-xs font-semibold text-[#1D1D1F] dark:text-white select-none">
              {bannerActive ? 'Visible' : 'Masquée'}
            </span>
          </label>
        </div>

        {/* Live Announcement Banner Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
            <span className="flex items-center gap-1.5 font-medium">
              <Eye size={13} className="text-[#FF6600]" />
              Aperçu en direct sur le site :
            </span>
            <span className="text-[11px]">
              {bannerActive ? 'Actuellement affiché aux visiteurs' : 'Masqué du public'}
            </span>
          </div>

          <div className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${
            bannerActive
              ? 'bg-gradient-to-r from-[#FF6600] via-[#FF8533] to-[#FF6600] text-white border-transparent shadow-md'
              : 'bg-zinc-100 dark:bg-zinc-800/40 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 opacity-60'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <Megaphone size={16} className="shrink-0" />
              <span className="text-xs font-semibold truncate">
                {bannerInput.trim() || "Texte de l'annonce (ex: Nouvelle mise à jour disponible !)"}
              </span>
            </div>
            <div className="shrink-0 w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
              <X size={12} />
            </div>
          </div>
        </div>

        {/* Input & Save */}
        <form onSubmit={saveBanner} className="space-y-3">
          <div className="relative">
            <Input
              value={bannerInput}
              onChange={e => setBannerInput(e.target.value)}
              placeholder="ex: Le jeu Idle Dino Clicker Tycoon accueille sa toute nouvelle mise à jour !"
              maxLength={280}
              className="pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-400 select-none">
              {bannerInput.length}/280
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              icon={Save}
              loading={savingBanner}
              disabled={!bannerDirty}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold"
            >
              Enregistrer l'annonce
            </Button>
            <SavedFlash show={bannerSaved} />
          </div>
        </form>
      </div>

      {/* ── SECTION 3 : CONTACT & SUPPORT EMAIL ── */}
      <div className="rounded-3xl p-6 md:p-8 border border-[#E5E5EA] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
            <Mail size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white">Adresse E-mail de Contact & Support</h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
              Affichée sur la page Contact, dans le pied de page et les reçus du site
            </p>
          </div>
        </div>

        <form onSubmit={saveEmail} className="flex items-center gap-3 flex-wrap pt-2">
          <div className="flex-1 min-w-[280px]">
            <Input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="support@vakargames.com"
            />
          </div>
          <Button
            type="submit"
            icon={Save}
            loading={savingEmail}
            disabled={!emailDirty}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold"
          >
            Enregistrer
          </Button>
          <SavedFlash show={emailSaved} />
        </form>
      </div>

      {/* ── SECTION 4 : RÉSEAUX SOCIAUX ── */}
      <div className="rounded-3xl p-6 md:p-8 border border-[#E5E5EA] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
            <Share2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white">Réseaux Sociaux Officiels</h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
              Liens affichés dans le footer du site. Laissez un champ vide pour masquer la plateforme.
            </p>
          </div>
        </div>

        <form onSubmit={saveSocial} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SOCIAL_FIELDS.map(f => (
              <div
                key={f.key}
                className="p-3.5 rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c] bg-black/[0.01] dark:bg-white/[0.01] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                    {f.label}
                  </span>
                  {socialInputs[f.key] && (
                    <a
                      href={socialInputs[f.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#FF6600] hover:underline flex items-center gap-0.5"
                    >
                      Tester <ArrowUpRight size={11} />
                    </a>
                  )}
                </div>
                <Input
                  value={socialInputs[f.key] || ''}
                  onChange={e => setSocialInputs(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-xs"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              icon={Save}
              loading={savingSocial}
              disabled={!socialDirty}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold"
            >
              Enregistrer les Réseaux
            </Button>
            <SavedFlash show={socialSaved} />
          </div>
        </form>
      </div>

      {/* ── SECTION 5 : RÉFÉRENCEMENT SEO & APERÇU GOOGLE ── */}
      <div className="rounded-3xl p-6 md:p-8 border border-[#E5E5EA] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] shadow-xs space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
            <Globe size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white">Référencement & SEO Global</h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6]">
              Description méta par défaut utilisée pour les moteurs de recherche (Google, Bing) et le partage social
            </p>
          </div>
        </div>

        {/* Live Google Search Preview Card */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-[#6E6E73] dark:text-[#A1A1A6] flex items-center gap-1.5">
            <Eye size={13} className="text-[#FF6600]" />
            Aperçu de l'extrait Google Search :
          </span>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0E0F17] border border-[#E5E5EA] dark:border-[#2A2B3C] shadow-xs font-sans space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="w-4 h-4 rounded-full bg-[#FF6600] flex items-center justify-center text-[9px] text-white font-bold">
                V
              </div>
              <span className="text-xs text-[#202124] dark:text-zinc-300">Vakar Games</span>
              <span className="text-zinc-400">• https://vakargames.com</span>
            </div>
            <h4 className="text-sm font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer">
              Vakar Games — Studio Indépendant de Jeux Vidéo
            </h4>
            <p className="text-xs text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed line-clamp-2">
              {seoInput.trim() || "Vakar Games est un studio indépendant dédié à la création d'expériences de jeu immersives et amusantes. Découvrez nos titres, sondages et projets communautaires."}
            </p>
          </div>
        </div>

        <form onSubmit={saveSeo} className="space-y-3">
          <div className="relative">
            <Input
              value={seoInput}
              onChange={e => setSeoInput(e.target.value)}
              maxLength={300}
              placeholder="Une description engageante de votre studio Vakar Games pour Google."
              className="pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-400 select-none">
              {seoInput.length}/300
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              icon={Save}
              loading={savingSeo}
              disabled={!seoDirty}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold"
            >
              Enregistrer le SEO
            </Button>
            <SavedFlash show={seoSaved} />
          </div>
        </form>
      </div>
    </div>
  );
};
