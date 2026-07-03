import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { Activity, Tag, ChevronDown, Check, Loader2 } from 'lucide-react';
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
  const headers = { Authorization: `Bearer ${token}` };

  const [currentStatus, setCurrentStatus] = useState('open');
  const [loading,       setLoading]       = useState(false);

  const [versions,      setVersions]      = useState(['default']);
  const [liveVersion,   setLiveVersion]   = useState('default');
  const [versionOpen,   setVersionOpen]   = useState(false);
  const [versionSaving, setVersionSaving] = useState(false);

  const slug = selectedProject?.slug;

  const fetchStatus = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await axios.get(`${API_URL}/api/projects/${slug}/status`);
      setCurrentStatus(r.data.status);
    } catch {}
  }, [slug]);

  const fetchVersions = useCallback(async () => {
    if (!slug || !token) return;
    try {
      const r = await axios.get(`${API_URL}/api/admin/projects/${slug}/versions`, { headers });
      setVersions(r.data.versions || ['default']);
      setLiveVersion(r.data.live_version || 'default');
    } catch {}
  }, [slug, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchStatus();
    fetchVersions();
  }, [fetchStatus, fetchVersions]);

  const changeStatus = async (s) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/projects/${slug}/status`, { status: s }, { headers });
      setCurrentStatus(s);
      toast.success(`Status changed to ${s}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const changeLiveVersion = async (tag) => {
    setVersionSaving(true);
    setVersionOpen(false);
    try {
      await axios.put(`${API_URL}/api/admin/projects/${slug}/live-version`, { live_version: tag }, { headers });
      setLiveVersion(tag);
      toast.success(`Live version set to "${tag}"`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setVersionSaving(false); }
  };

  const cfg = STATUS_CFG[currentStatus] || STATUS_CFG.open;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Server status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4ECDC418' }}>
              <Activity size={16} style={{ color: '#4ECDC4' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Server Status</h3>
              <p className="text-xs text-gray-500">Control your server state</p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Current Status
            </p>
            <div className="flex items-center gap-2" data-testid="current-status">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
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
                        : 'bg-gray-50 border border-gray-200 hover:border-brand-400/20'
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

      {/* Live version card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#4ECDC418' }}>
              <Tag size={16} style={{ color: '#4ECDC4' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Live Game Version</h3>
              <p className="text-xs text-gray-500">
                The version your players download. Change it when releasing an update.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Current live version
          </p>
          <div className="relative inline-block">
            <button
              onClick={() => setVersionOpen(v => !v)}
              disabled={versionSaving}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50 min-w-[180px] justify-between"
            >
              <span className="flex items-center gap-2">
                {versionSaving
                  ? <Loader2 size={12} className="animate-spin text-brand-400" />
                  : <span className="w-2 h-2 rounded-full bg-brand-400" />
                }
                {liveVersion}
              </span>
              <ChevronDown size={13} className={`text-gray-400 transition-transform ${versionOpen ? 'rotate-180' : ''}`} />
            </button>
            {versionOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 shadow-lg min-w-[180px]">
                {versions.map(tag => (
                  <button
                    key={tag}
                    onClick={() => changeLiveVersion(tag)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50 transition-colors text-left"
                  >
                    {tag === liveVersion
                      ? <Check size={12} className="text-brand-400 shrink-0" />
                      : <span className="w-3 shrink-0" />
                    }
                    {tag}
                  </button>
                ))}
                {versions.length === 0 && (
                  <p className="px-4 py-3 text-xs text-gray-400">No versions yet — upload files first.</p>
                )}
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
            The TurboWarp block <code className="bg-gray-50 px-1">use live version</code> fetches this value at game startup.
            Players always load assets from this version.
          </p>
        </CardBody>
      </Card>
    </div>
  );
};
