import React, { useState, useEffect, useMemo } from 'react';
import {
  Gamepad2, Users, Globe, ClipboardList, Activity,
  FileText, ArrowRight, AlertCircle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import api from '../utils/api';

const STATUS_CFG = {
  open:        { color: '#2FA84F', label: 'Open' },
  maintenance: { color: '#C08A1E', label: 'Maintenance' },
  closed:      { color: '#D64545', label: 'Closed' },
};

const LOG_COLORS = {
  send:            '#F2994A',
  claim:           '#4ECDC4',
  status:          '#F2C94C',
  variable_action: '#2F80ED',
  variable_access: '#A1A1A6',
  delete:          '#EB5757',
};

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-xl bg-white border border-[#D2D2D7] overflow-hidden ${className}`}>
    {children}
  </div>
);

const PanelHead = ({ title, action }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-[#D2D2D7]">
    <h2 className="text-[14.5px] font-bold text-[#1D1D1F]">{title}</h2>
    {action}
  </div>
);

export const DashboardOverview = ({ setActiveTab }) => {
  const { user, hasPermission } = useAuth();
  const { projects, selectedProject } = useProject();

  const canManageUsers = hasPermission('manage_users');
  const canSeeGames    = hasPermission('create_games');
  const canSeeMissions = hasPermission('claim_missions') || hasPermission('create_missions') || hasPermission('manage_missions');
  const canSeeLogs     = hasPermission('view_logs');
  const canSeeStatus   = hasPermission('change_status');
  const canSeeProjects = hasPermission('view_projects');
  const canSeeVariables = hasPermission('view_variables');

  const [globalStats, setGlobalStats]         = useState({ users: null, games: null });
  const [globalLoading, setGlobalLoading]     = useState(false);
  const [openMissions, setOpenMissions]       = useState(null);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [recentLogs, setRecentLogs]           = useState([]);
  const [logsLoading, setLogsLoading]         = useState(false);
  const [logsError, setLogsError]             = useState(false);
  const [logsRetry, setLogsRetry]             = useState(0);
  const [projectStatus, setProjectStatus]     = useState(null);

  const dateStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date());
  }, []);

  useEffect(() => {
    const fetches = [];
    if (canManageUsers) {
      fetches.push(
        api.get('/api/users?limit=200&page=1')
          .then(r => {
            const all = r.data.users || [];
            const withPerms = all.filter(u =>
              u.role === 'super_admin' || u.role === 'admin' || (u.permissions && u.permissions.length > 0)
            );
            setGlobalStats(s => ({ ...s, users: withPerms.length }));
          })
          .catch(() => {})
      );
    }
    if (canSeeGames) {
      fetches.push(
        api.get('/api/website/games')
          .then(r => setGlobalStats(s => ({ ...s, games: Array.isArray(r.data.games) ? r.data.games.length : null })))
          .catch(() => {})
      );
    }
    if (fetches.length > 0) {
      setGlobalLoading(true);
      Promise.all(fetches).finally(() => setGlobalLoading(false));
    }
  }, [canManageUsers, canSeeGames]);

  useEffect(() => {
    setOpenMissions(null);
    if (!selectedProject || !canSeeMissions) return;
    setMissionsLoading(true);
    api.get(`/api/projects/${selectedProject.slug}/missions?status=open&limit=1&page=1`)
      .then(r => setOpenMissions(r.data.total ?? null))
      .catch(() => setOpenMissions(null))
      .finally(() => setMissionsLoading(false));
  }, [selectedProject?.slug, canSeeMissions]);

  useEffect(() => {
    if (!selectedProject || !canSeeLogs) { setRecentLogs([]); setLogsError(false); return; }
    setLogsLoading(true);
    setLogsError(false);
    api.get(`/api/projects/${selectedProject.slug}/logs?limit=5`)
      .then(r => setRecentLogs(r.data.logs || []))
      .catch(() => setLogsError(true))
      .finally(() => setLogsLoading(false));
  }, [selectedProject?.slug, canSeeLogs, logsRetry]);

  useEffect(() => {
    setProjectStatus(null);
    if (!selectedProject || !canSeeStatus) return;
    api.get(`/api/projects/${selectedProject.slug}/status`)
      .then(r => setProjectStatus(r.data.status ?? null))
      .catch(() => setProjectStatus(null));
  }, [selectedProject?.slug, canSeeStatus]);

  const statusInfo = projectStatus && STATUS_CFG[projectStatus] ? STATUS_CFG[projectStatus] : null;

  const statCards = [
    { label: 'Projects',      value: projects.length,      accent: '#6C5CE7', icon: Gamepad2,     loading: false },
    canManageUsers ? { label: 'Staff',          value: globalStats.users,  accent: '#F2994A', icon: Users,        loading: globalLoading && globalStats.users === null } : null,
    canSeeGames    ? { label: 'Games',           value: globalStats.games,  accent: '#4ECDC4', icon: Globe,        loading: globalLoading && globalStats.games === null } : null,
    (canSeeMissions && selectedProject) ? { label: 'Open missions', value: openMissions,        accent: '#9B51E0', icon: ClipboardList, loading: missionsLoading && openMissions === null } : null,
  ].filter(Boolean);

  const quickActions = [
    (canSeeMissions && selectedProject)               ? { label: 'Missions',      tab: 'missions',   icon: ClipboardList } : null,
    (canSeeLogs && selectedProject)                   ? { label: 'Logs',          tab: 'logs',       icon: FileText } : null,
    (canSeeStatus && selectedProject)                 ? { label: 'Server status', tab: 'status',     icon: Activity } : null,
  ].filter(Boolean);

  const displayName = user?.firstName || user?.username;

  return (
    <div className="max-w-[980px] mx-auto space-y-7">

      {/* Page head */}
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#1D1D1F]">
          {displayName ? `Welcome, ${displayName}` : 'Welcome'}
        </h1>
        <p className="text-[13.5px] text-[#6E6E73] mt-1">{dateStr} — here's what's happening across your studio.</p>
      </div>

      {/* Stat cards */}
      {statCards.length > 0 && (
        <div
          className="grid gap-px bg-[#D2D2D7] border border-[#D2D2D7] rounded-xl overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${Math.min(statCards.length, 4)}, 1fr)` }}
        >
          {statCards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white p-5 min-w-0">
                <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center mb-3.5" style={{ backgroundColor: `${card.accent}18` }}>
                  <Icon size={13} style={{ color: card.accent }} />
                </div>
                {card.loading ? (
                  <div className="h-[26px] w-10 bg-[#EDEDEF] animate-pulse rounded" />
                ) : (
                  <div className="text-[26px] font-bold tracking-[-0.01em] text-[#1D1D1F]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {card.value ?? '—'}
                  </div>
                )}
                <div className="text-xs text-[#6E6E73] mt-0.5 truncate">{card.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* No project selected */}
      {!selectedProject && (canSeeLogs || canSeeStatus || canSeeMissions) && (
        <Panel className="p-10 flex flex-col items-center text-center">
          <div className="rounded-lg w-12 h-12 bg-[#F5F5F7] border border-[#D2D2D7] flex items-center justify-center mb-5">
            <Gamepad2 size={20} className="text-[#BFBFC4]" />
          </div>
          <p className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-[0.1em] mb-2">Project</p>
          <h3 className="text-lg font-bold text-[#1D1D1F] mb-2">No project selected</h3>
          <p className="text-sm text-[#6E6E73] mb-6 max-w-xs">
            Select a project from the sidebar to view its activity, status and missions.
          </p>
          {canSeeProjects && (
            <button
              onClick={() => setActiveTab('projects')}
              className="rounded-full inline-flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              View projects <ArrowRight size={13} />
            </button>
          )}
        </Panel>
      )}

      {/* Two-column layout */}
      {selectedProject && (canSeeLogs || quickActions.length > 0 || canSeeStatus) && (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">

          {/* Recent activity */}
          {canSeeLogs && (
            <Panel>
              <PanelHead
                title="Recent activity"
                action={
                  <button
                    onClick={() => setActiveTab('logs')}
                    className="text-[12.5px] font-medium text-[#4ECDC4] hover:text-[#45b8b0] flex items-center gap-1 transition-colors"
                  >
                    View all logs
                  </button>
                }
              />
              {logsLoading ? (
                <div className="p-5 space-y-3">
                  {[75, 55, 65].map((w, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-[26px] h-[26px] rounded-lg bg-[#EDEDEF] animate-pulse shrink-0" />
                      <div className="h-3.5 bg-[#EDEDEF] animate-pulse rounded" style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
              ) : logsError ? (
                <div className="p-5 flex items-center gap-3">
                  <AlertCircle size={15} className="text-[#C08A1E] shrink-0" />
                  <span className="text-sm text-[#6E6E73]">
                    Could not load activity.{' '}
                    <button onClick={() => setLogsRetry(r => r + 1)} className="text-[#4ECDC4] hover:underline">
                      Retry
                    </button>
                  </span>
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#A1A1A6]">No recent activity.</div>
              ) : (
                <div>
                  {recentLogs.map((log, i) => {
                    const dotColor = LOG_COLORS[log.type] || '#A1A1A6';
                    return (
                      <div key={i} className="flex items-start gap-3 px-5 py-3.5 border-b border-[#EDEDEF] last:border-0">
                        <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${dotColor}18` }}>
                          <FileText size={13} style={{ color: dotColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#1D1D1F] leading-snug">{log.message}</p>
                          <p className="text-[11.5px] text-[#A1A1A6] mt-0.5">
                            {timeAgo(log.timestamp)} · {log.user || '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          {/* Side stack */}
          <div className="flex flex-col gap-5">

            {/* Quick actions */}
            {quickActions.length > 0 && (
              <Panel>
                <PanelHead title="Quick actions" />
                <div>
                  {quickActions.map(action => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.tab}
                        onClick={() => setActiveTab(action.tab)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-[#EDEDEF] last:border-0 hover:bg-[#F5F5F7] transition-colors text-left"
                      >
                        <Icon size={15} className="text-[#A1A1A6] shrink-0" />
                        <span className="flex-1 text-[13px] font-medium text-[#1D1D1F] truncate">{action.label}</span>
                        <ChevronRight size={12} className="text-[#BFBFC4] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </Panel>
            )}

            {/* Project status card */}
            {canSeeStatus && (
              <Panel className="p-5">
                <p className="text-[14.5px] font-bold text-[#1D1D1F] mb-2.5">{selectedProject.name}</p>
                {statusInfo ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: `${statusInfo.color}18`, color: statusInfo.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                    {statusInfo.label}
                  </span>
                ) : (
                  <div className="h-[22px] w-16 bg-[#EDEDEF] animate-pulse rounded-full" />
                )}

                {canSeeMissions && (
                  <div className="text-xs text-[#6E6E73] mt-3 flex items-center justify-between">
                    <span>Open missions</span>
                    <b className="text-[#1D1D1F] font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{openMissions ?? '—'}</b>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap mt-4">
                  {canSeeLogs && (
                    <button onClick={() => setActiveTab('logs')} className="text-xs font-medium rounded-full text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] px-3 py-1.5 transition-colors">
                      Logs
                    </button>
                  )}
                  {canSeeVariables && (
                    <button onClick={() => setActiveTab('variables')} className="text-xs font-medium rounded-full text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] px-3 py-1.5 transition-colors">
                      Variables
                    </button>
                  )}
                  <button onClick={() => setActiveTab('status')} className="text-xs font-medium rounded-full bg-[#1D1D1F] text-white hover:bg-[#3A3A3C] px-3 py-1.5 transition-colors">
                    Manage status
                  </button>
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
