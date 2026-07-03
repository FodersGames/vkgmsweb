import React, { useState, useEffect, useMemo } from 'react';
import {
  Gamepad2, Users, Globe, ClipboardList, Activity,
  FileText, Package, ArrowRight, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import api from '../utils/api';
import { StatCard } from './StatCard';

const STATUS_CFG = {
  open:        { color: '#4ECDC4', label: 'Open' },
  maintenance: { color: '#F2994A', label: 'Maintenance' },
  closed:      { color: '#EB5757', label: 'Closed' },
};

const LOG_COLORS = {
  send:            '#F2994A',
  claim:           '#4ECDC4',
  status:          '#F2C94C',
  variable_action: '#2F80ED',
  variable_access: '#A8A29E',
  delete:          '#EB5757',
};

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-3">{children}</p>
);

const Panel = ({ children, className = '' }) => (
  <div className={`bg-white border border-[#E8E3DB] ${className}`}>
    {children}
  </div>
);

const STAT_GRID = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-2 sm:grid-cols-3', 'grid-cols-2 lg:grid-cols-4'];

export const DashboardOverview = ({ setActiveTab }) => {
  const { user, hasPermission } = useAuth();
  const { projects, selectedProject } = useProject();

  const canManageUsers = hasPermission('manage_users');
  const canSeeGames    = hasPermission('create_games');
  const canSeeMissions = hasPermission('claim_missions') || hasPermission('create_missions') || hasPermission('manage_missions');
  const canSeeLogs     = hasPermission('view_logs');
  const canSeeStatus   = hasPermission('change_status');
  const canSeeProjects = hasPermission('view_projects');

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
    (canSeeMissions && selectedProject) ? { label: 'Open Missions', value: openMissions,        accent: '#9B51E0', icon: ClipboardList, loading: missionsLoading && openMissions === null } : null,
  ].filter(Boolean);

  const quickActions = [
    (hasPermission('send_items') && selectedProject)  ? { label: 'Send Items',   tab: 'send-items', icon: Package,       color: '#F2994A' } : null,
    (canSeeMissions && selectedProject)               ? { label: 'Missions',      tab: 'missions',   icon: ClipboardList, color: '#9B51E0' } : null,
    (canSeeLogs && selectedProject)                   ? { label: 'Logs',          tab: 'logs',       icon: FileText,      color: '#6C5CE7' } : null,
    (canSeeStatus && selectedProject)                 ? { label: 'Server Status', tab: 'status',     icon: Activity,      color: '#4ECDC4' } : null,
  ].filter(Boolean);

  const displayName = user?.firstName || user?.username;
  const greeting = displayName
    ? `Welcome, ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}`
    : 'Welcome';

  const gridClass = STAT_GRID[Math.min(statCards.length, 4)] || 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className="max-w-5xl space-y-8">

      {/* Greeting */}
      <div className="border-b border-[#E8E3DB] pb-6">
        <p className="text-xs font-semibold text-[#4ECDC4] tracking-[0.16em] uppercase mb-2">{dateStr}</p>
        <h1
          className="text-4xl font-black text-[#1C1917]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {greeting.toUpperCase()}
        </h1>
      </div>

      {/* Stat cards */}
      {statCards.length > 0 && (
        <div className={`grid ${gridClass} gap-4`}>
          {statCards.map(card => <StatCard key={card.label} {...card} />)}
        </div>
      )}

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <div>
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.tab}
                  onClick={() => setActiveTab(action.tab)}
                  className="flex items-center gap-3 px-4 py-3 bg-white border border-[#E8E3DB] hover:border-[#C9C3BB] transition-colors group text-left"
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: `${action.color}18` }}>
                    <Icon size={14} style={{ color: action.color }} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-[#1C1917] truncate">{action.label}</span>
                  <ArrowRight size={12} className="text-[#C9C3BB] group-hover:text-[#1C1917] transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No project selected */}
      {!selectedProject && (canSeeLogs || canSeeStatus || canSeeMissions || hasPermission('send_items')) && (
        <Panel className="p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-[#F9F7F4] border border-[#E8E3DB] flex items-center justify-center mb-5">
            <Gamepad2 size={20} className="text-[#C9C3BB]" />
          </div>
          <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-2">Project</p>
          <h3
            className="text-xl font-black text-[#1C1917] mb-2"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            NO PROJECT SELECTED
          </h3>
          <p className="text-sm text-[#78716C] mb-6 max-w-xs">
            Select a project from the sidebar to view its activity, status and missions.
          </p>
          {canSeeProjects && (
            <button
              onClick={() => setActiveTab('projects')}
              className="inline-flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              View Projects <ArrowRight size={13} />
            </button>
          )}
        </Panel>
      )}

      {/* Recent activity */}
      {selectedProject && canSeeLogs && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Recent Activity — {selectedProject.name}</SectionLabel>
            <button
              onClick={() => setActiveTab('logs')}
              className="text-xs font-semibold text-[#4ECDC4] hover:text-[#45b8b0] flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>

          <Panel>
            {logsLoading ? (
              <div className="p-4 space-y-3">
                {[75, 55, 65].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-[#E8E3DB] animate-pulse shrink-0" />
                    <div className="h-4 bg-[#E8E3DB] animate-pulse" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            ) : logsError ? (
              <div className="p-5 flex items-center gap-3">
                <AlertCircle size={15} className="text-[#F2994A] shrink-0" />
                <span className="text-sm text-[#78716C]">
                  Could not load activity.{' '}
                  <button onClick={() => setLogsRetry(r => r + 1)} className="text-[#4ECDC4] hover:underline">
                    Retry
                  </button>
                </span>
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#A8A29E]">No recent activity.</div>
            ) : (
              <div className="divide-y divide-[#F0EDE8]">
                {recentLogs.map((log, i) => {
                  const dotColor = LOG_COLORS[log.type] || '#A8A29E';
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: dotColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#1C1917] truncate">{log.message}</p>
                        <p className="text-[11px] text-[#A8A29E]">
                          {log.user || '—'} · {timeAgo(log.timestamp)}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-[10px] font-semibold px-2 py-0.5"
                        style={{ backgroundColor: `${dotColor}15`, color: dotColor }}
                      >
                        {log.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Project status widget */}
      {selectedProject && canSeeStatus && (
        <div>
          <SectionLabel>Status — {selectedProject.name}</SectionLabel>
          <Panel className="px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#F9F7F4] border border-[#E8E3DB] flex items-center justify-center">
                  <Gamepad2 size={15} className="text-[#A8A29E]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1C1917]">{selectedProject.name}</p>
                  {statusInfo ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 animate-pulse" style={{ backgroundColor: statusInfo.color }} />
                      <span className="text-xs font-semibold" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                    </div>
                  ) : (
                    <div className="h-3 w-16 bg-[#E8E3DB] animate-pulse mt-1" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canSeeLogs && (
                  <button onClick={() => setActiveTab('logs')} className="text-xs text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] px-3 py-1.5 transition-colors font-medium">
                    Logs
                  </button>
                )}
                {hasPermission('view_variables') && (
                  <button onClick={() => setActiveTab('variables')} className="text-xs text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] px-3 py-1.5 transition-colors font-medium">
                    Variables
                  </button>
                )}
                {hasPermission('send_items') && (
                  <button onClick={() => setActiveTab('send-items')} className="text-xs text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] px-3 py-1.5 transition-colors font-medium">
                    Send Items
                  </button>
                )}
                <button onClick={() => setActiveTab('status')} className="text-xs bg-[#1C1917] text-white hover:bg-[#2D2926] px-3 py-1.5 transition-colors font-medium">
                  Manage Status
                </button>
              </div>
            </div>
          </Panel>
        </div>
      )}

    </div>
  );
};
