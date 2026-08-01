import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import {
  Activity, Tag, ChevronDown, Check, Loader2, CheckCircle2, AlertTriangle, XCircle, Info,
} from 'lucide-react';
import api from '../utils/api';

const STATUS_CFG = {
  open:        { label: 'Open',        color: '#4ECDC4', icon: CheckCircle2, desc: 'Accepting players normally.' },
  maintenance: { label: 'Maintenance', color: '#F2994A', icon: AlertTriangle, desc: 'Marked under maintenance.' },
  closed:      { label: 'Closed',      color: '#EB5757', icon: XCircle,      desc: 'Marked as closed to players.' },
};

const timeAgo = (iso) => {
  if (!iso) return null;
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

export const ServerStatus = () => {
  const { selectedProject } = useProject();
  const slug = selectedProject?.slug;

  const [currentStatus, setCurrentStatus] = useState('open');
  const [statusUpdatedAt, setStatusUpdatedAt] = useState(null);
  const [statusUpdatedBy, setStatusUpdatedBy] = useState(null);
  const [loading, setLoading] = useState(false);

  const [versions,    setVersions]    = useState(['default']);
  const [fileCounts,  setFileCounts]  = useState({});
  const [liveVersion, setLiveVersion] = useState('default');
  const [lvUpdatedAt, setLvUpdatedAt] = useState(null);
  const [lvUpdatedBy, setLvUpdatedBy] = useState(null);
  const [versionOpen,   setVersionOpen]   = useState(false);
  const [versionSaving, setVersionSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await api.get(`/api/projects/${slug}/status`);
      setCurrentStatus(r.data.status);
      setStatusUpdatedAt(r.data.updated_at || null);
      setStatusUpdatedBy(r.data.updated_by || null);
    } catch {}
  }, [slug]);

  const fetchVersions = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await api.get(`/api/admin/projects/${slug}/versions`);
      setVersions(r.data.versions || ['default']);
      setFileCounts(r.data.file_counts || {});
      setLiveVersion(r.data.live_version || 'default');
      setLvUpdatedAt(r.data.live_version_updated_at || null);
      setLvUpdatedBy(r.data.live_version_updated_by || null);
    } catch {}
  }, [slug]);

  useEffect(() => { fetchStatus(); fetchVersions(); }, [fetchStatus, fetchVersions]);

  const changeStatus = async (s) => {
    if (s === currentStatus) return;
    setLoading(true);
    try {
      await api.post(`/api/projects/${slug}/status`, { status: s });
      setCurrentStatus(s);
      setStatusUpdatedAt(new Date().toISOString());
      toast.success(`Status changed to ${STATUS_CFG[s].label}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to change status'); }
    finally { setLoading(false); }
  };

  const changeLiveVersion = async (tag) => {
    setVersionSaving(true);
    setVersionOpen(false);
    try {
      await api.put(`/api/admin/projects/${slug}/live-version`, { live_version: tag });
      setLiveVersion(tag);
      setLvUpdatedAt(new Date().toISOString());
      toast.success(`Live version set to "${tag}"`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update live version'); }
    finally { setVersionSaving(false); }
  };

  if (!selectedProject) return null;

  const cfg = STATUS_CFG[currentStatus] || STATUS_CFG.open;
  const StatusIcon = cfg.icon;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg w-10 h-10 flex items-center justify-center" style={{ backgroundColor: `${cfg.color}18` }}>
          <Activity size={20} style={{ color: cfg.color }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Server Status</h1>
          <p className="text-xs text-[#A1A1A6]">{selectedProject.name}</p>
        </div>
      </div>

      {/* Current status hero */}
      <div
        className="flex items-center justify-between gap-4 p-6 border"
        style={{ borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}0A` }}
        data-testid="current-status"
      >
        <div className="flex items-center gap-4">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: cfg.color }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: cfg.color }} />
          </span>
          <div>
            <p className="text-2xl font-black leading-none" style={{ color: cfg.color }}>
              {cfg.label.toUpperCase()}
            </p>
            <p className="text-xs text-[#6E6E73] mt-1.5">
              {statusUpdatedAt
                ? `Changed ${timeAgo(statusUpdatedAt)}${statusUpdatedBy ? ` by ${statusUpdatedBy}` : ''}`
                : 'No changes recorded yet'}
            </p>
          </div>
        </div>
        <StatusIcon size={36} style={{ color: cfg.color, opacity: 0.35 }} />
      </div>

      {/* Status switch */}
      <div>
        <p className="text-[11px] font-semibold text-[#A1A1A6] dark:text-[#52525b] uppercase tracking-widest mb-3">
          Change Status
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(STATUS_CFG).map(([s, c]) => {
            const isActive = currentStatus === s;
            const Icon = c.icon;
            return (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={loading || isActive}
                data-testid={`status-${s}-button`}
                className="text-left p-4 border transition-all disabled:cursor-default"
                style={isActive
                  ? { borderColor: c.color, backgroundColor: `${c.color}0F` }
                  : { borderColor: '#D2D2D7' }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={15} style={{ color: c.color }} />
                  <span className="text-sm font-semibold" style={{ color: isActive ? c.color : '#1D1D1F' }}>{c.label}</span>
                  {isActive && <Check size={13} className="ml-auto" style={{ color: c.color }} />}
                </div>
                <p className="text-xs text-[#6E6E73] leading-relaxed">{c.desc}</p>
              </button>
            );
          })}
        </div>
        <div className="flex items-start gap-2 mt-3 text-[#A1A1A6]">
          <Info size={12} className="shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            This status is informational only — it isn't checked by the game yet, so it won't block or warn players in-game.
          </p>
        </div>
      </div>

      {/* Live version */}
      <div className="border border-[#D2D2D7] dark:border-[#2a2a3c]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
          <div className="rounded-lg w-9 h-9 flex items-center justify-center bg-[#4ECDC4]/10">
            <Tag size={15} className="text-[#4ECDC4]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Live Game Version</h3>
            <p className="text-xs text-[#6E6E73]">The version your players download. Change it when releasing an update.</p>
          </div>
        </div>

        <div className="p-5">
          <div className="relative inline-block">
            <button
              onClick={() => setVersionOpen(v => !v)}
              disabled={versionSaving}
              className="rounded-full flex items-center gap-2 border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14] hover:border-[#BFBFC4] px-4 py-2.5 text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] transition-colors disabled:opacity-50 min-w-[220px] justify-between"
            >
              <span className="flex items-center gap-2">
                {versionSaving
                  ? <Loader2 size={12} className="animate-spin text-[#4ECDC4]" />
                  : <span className="w-2 h-2 rounded-full bg-[#4ECDC4]" />}
                {liveVersion}
                <span className="text-xs text-[#A1A1A6] font-normal">
                  ({fileCounts[liveVersion] ?? 0} file{(fileCounts[liveVersion] ?? 0) !== 1 ? 's' : ''})
                </span>
              </span>
              <ChevronDown size={13} className={`text-[#A1A1A6] transition-transform ${versionOpen ? 'rotate-180' : ''}`} />
            </button>
            {versionOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-lg min-w-[220px]">
                {versions.map(tag => (
                  <button
                    key={tag}
                    onClick={() => changeLiveVersion(tag)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-[#1D1D1F] dark:text-[#e4e4e7] hover:bg-[#F5F5F7] dark:hover:bg-[#111118] transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      {tag === liveVersion
                        ? <Check size={12} className="text-[#4ECDC4] shrink-0" />
                        : <span className="w-3 shrink-0" />}
                      {tag}
                    </span>
                    <span className="text-xs text-[#A1A1A6]">{fileCounts[tag] ?? 0} file{(fileCounts[tag] ?? 0) !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#A1A1A6] mt-3">
            {lvUpdatedAt
              ? `Live version last changed ${timeAgo(lvUpdatedAt)}${lvUpdatedBy ? ` by ${lvUpdatedBy}` : ''}`
              : 'No changes recorded yet'}
          </p>
          <p className="text-[10px] text-[#A1A1A6] mt-2 leading-relaxed">
            The TurboWarp block <code className="bg-[#F5F5F7] dark:bg-[#111118] px-1">use live version</code> fetches this value at game startup.
            Players always load assets from this version.
          </p>
        </div>
      </div>
    </div>
  );
};
