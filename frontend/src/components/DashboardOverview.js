import React, { useState, useEffect, useMemo } from 'react';
import {
  Gamepad2, Users, Globe, ClipboardList, Activity,
  FileText, Package, ArrowRight, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import api from '../utils/api';
import { StatCard } from './StatCard';

// ─── constants ────────────────────────────────────────────────────────────────

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
  variable_access: '#71717a',
  delete:          '#EB5757',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "à l'instant";
  if (s < 3600)  return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
};

// ─── internal sub-components ──────────────────────────────────────────────────

const QuickAction = ({ label, icon: Icon, color, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl shadow-sm hover:border-[#4ECDC4]/40 hover:shadow-md transition-all group text-left"
  >
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
      <Icon size={14} style={{ color }} />
    </div>
    <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-[#e4e4e7] truncate">{label}</span>
    <ArrowRight size={13} className="text-zinc-300 dark:text-[#52525b] group-hover:text-[#4ECDC4] transition-colors shrink-0" />
  </button>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-[10px] font-semibold text-[#71717a] uppercase tracking-widest mb-3">{children}</h2>
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] shadow-sm ${className}`}>
    {children}
  </div>
);

// ─── grid class lookup (avoids runtime Tailwind purge issues) ─────────────────
const STAT_GRID = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-2 sm:grid-cols-3', 'grid-cols-2 lg:grid-cols-4'];

// ─── main component ───────────────────────────────────────────────────────────

export const DashboardOverview = ({ setActiveTab }) => {
  const { user, hasPermission } = useAuth();
  const { projects, selectedProject } = useProject();

  // permission flags — derived each render from user object, stable as long as user is stable
  const canManageUsers = hasPermission('manage_users');
  const canSeeGames    = hasPermission('create_games');
  const canSeeMissions = hasPermission('claim_missions') || hasPermission('create_missions') || hasPermission('manage_missions');
  const canSeeLogs     = hasPermission('view_logs');
  const canSeeStatus   = hasPermission('change_status');
  const canSeeProjects = hasPermission('view_projects');

  // global stats (users, games) — fetched once on mount / permission change
  const [globalStats, setGlobalStats]       = useState({ users: null, games: null });
  const [globalLoading, setGlobalLoading]   = useState(false);

  // project-scoped stat (open missions) — reset on project change
  const [openMissions, setOpenMissions]     = useState(null);
  const [missionsLoading, setMissionsLoading] = useState(false);

  // logs — independent error handling
  const [recentLogs, setRecentLogs]   = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError]     = useState(false);
  const [logsRetry, setLogsRetry]     = useState(0);

  // project status — fetched independently
  const [projectStatus, setProjectStatus] = useState(null);

  // French date — computed once at mount
  const dateStr = useMemo(() => {
    const d = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date());
    return d.charAt(0).toUpperCase() + d.slice(1);
  }, []);

  // ── global stats fetch (users, games) ───────────────────────────────────────
  useEffect(() => {
    const fetches = [];

    if (canManageUsers) {
      fetches.push(
        api.get('/api/users?limit=1&page=1')
          .then(r => setGlobalStats(s => ({ ...s, users: r.data.total ?? null })))
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

  // ── open missions count — project-scoped, reset on project change ────────────
  useEffect(() => {
    setOpenMissions(null);
    if (!selectedProject || !canSeeMissions) return;

    setMissionsLoading(true);
    api.get(`/api/projects/${selectedProject.slug}/missions?status=open&limit=1&page=1`)
      .then(r => setOpenMissions(r.data.total ?? null))
      .catch(() => setOpenMissions(null))
      .finally(() => setMissionsLoading(false));
  }, [selectedProject?.slug, canSeeMissions]);

  // ── recent logs — independent error state ───────────────────────────────────
  useEffect(() => {
    if (!selectedProject || !canSeeLogs) {
      setRecentLogs([]);
      setLogsError(false);
      return;
    }
    setLogsLoading(true);
    setLogsError(false);
    api.get(`/api/projects/${selectedProject.slug}/logs?limit=5`)
      .then(r => setRecentLogs(r.data.logs || []))
      .catch(() => setLogsError(true))
      .finally(() => setLogsLoading(false));
  }, [selectedProject?.slug, canSeeLogs, logsRetry]);

  // ── project status ───────────────────────────────────────────────────────────
  useEffect(() => {
    setProjectStatus(null);
    if (!selectedProject || !canSeeStatus) return;
    api.get(`/api/projects/${selectedProject.slug}/status`)
      .then(r => setProjectStatus(r.data.status ?? null))
      .catch(() => setProjectStatus(null));
  }, [selectedProject?.slug, canSeeStatus]);

  // ── derived display values ───────────────────────────────────────────────────

  // Only display status if the value is one we know about — never show raw API values
  const statusInfo = projectStatus && STATUS_CFG[projectStatus] ? STATUS_CFG[projectStatus] : null;

  const statCards = [
    { label: 'Projets', value: projects.length, accent: '#6C5CE7', icon: Gamepad2, loading: false },
    canManageUsers ? { label: 'Utilisateurs', value: globalStats.users, accent: '#F2994A', icon: Users,        loading: globalLoading && globalStats.users === null } : null,
    canSeeGames    ? { label: 'Jeux',          value: globalStats.games, accent: '#4ECDC4', icon: Globe,        loading: globalLoading && globalStats.games === null } : null,
    (canSeeMissions && selectedProject) ? { label: 'Missions ouvertes', value: openMissions, accent: '#9B51E0', icon: ClipboardList, loading: missionsLoading && openMissions === null } : null,
  ].filter(Boolean);

  const quickActions = [
    (hasPermission('send_items') && selectedProject)  ? { label: 'Send Items',    tab: 'send-items', icon: Package,      color: '#F2994A' } : null,
    (canSeeMissions && selectedProject)               ? { label: 'Missions',       tab: 'missions',   icon: ClipboardList, color: '#9B51E0' } : null,
    (canSeeLogs && selectedProject)                   ? { label: 'Logs',           tab: 'logs',       icon: FileText,     color: '#6C5CE7' } : null,
    (canSeeStatus && selectedProject)                 ? { label: 'Server Status',  tab: 'status',     icon: Activity,     color: '#4ECDC4' } : null,
  ].filter(Boolean);

  const displayName = user?.firstName || user?.username;
  const greeting = displayName
    ? `Welcome, ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}`
    : 'Welcome';

  const gridClass = STAT_GRID[Math.min(statCards.length, 4)] || 'grid-cols-2 lg:grid-cols-4';

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl space-y-6">

      {/* ── greeting ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-[#e4e4e7]">{greeting}</h1>
        <p className="text-sm text-[#71717a] mt-0.5">{dateStr}</p>
      </div>

      {/* ── stat cards ────────────────────────────────────────────────────────── */}
      {statCards.length > 0 && (
        <div className={`grid ${gridClass} gap-4`}>
          {statCards.map(card => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* ── quick actions ─────────────────────────────────────────────────────── */}
      {quickActions.length > 0 && (
        <div>
          <SectionTitle>Accès rapide</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map(action => (
              <QuickAction
                key={action.tab}
                label={action.label}
                icon={action.icon}
                color={action.color}
                onClick={() => setActiveTab(action.tab)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── no project selected ───────────────────────────────────────────────── */}
      {!selectedProject && (canSeeLogs || canSeeStatus || canSeeMissions || hasPermission('send_items')) && (
        <Card className="p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-[#6C5CE7]/10 flex items-center justify-center mb-3">
            <Gamepad2 size={22} className="text-[#A29BFE]" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7] mb-1">
            Aucun projet sélectionné
          </h3>
          <p className="text-xs text-[#71717a] mb-4 max-w-xs">
            Sélectionne un projet dans le menu pour voir son activité, son statut et ses missions.
          </p>
          {canSeeProjects && (
            <button
              onClick={() => setActiveTab('projects')}
              className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
            >
              Voir les projets
            </button>
          )}
        </Card>
      )}

      {/* ── recent activity (logs) ────────────────────────────────────────────── */}
      {selectedProject && canSeeLogs && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Activité récente — {selectedProject.name}</SectionTitle>
            <button
              onClick={() => setActiveTab('logs')}
              className="text-xs text-[#4ECDC4] hover:text-[#45b8b0] font-medium flex items-center gap-1 transition-colors"
            >
              Voir tout <ArrowRight size={12} />
            </button>
          </div>

          <Card>
            {logsLoading ? (
              <div className="p-4 space-y-3">
                {[75, 55, 65].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse shrink-0" />
                    <div className="h-4 rounded-md bg-zinc-200 dark:bg-zinc-700 animate-pulse" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            ) : logsError ? (
              <div className="p-5 flex items-center gap-3">
                <AlertCircle size={15} className="text-[#F2994A] shrink-0" />
                <span className="text-sm text-[#71717a]">
                  Impossible de charger l'activité.{' '}
                  <button
                    onClick={() => setLogsRetry(r => r + 1)}
                    className="text-[#4ECDC4] hover:underline"
                  >
                    Réessayer
                  </button>
                </span>
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#71717a]">Aucune activité récente.</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-[#2a2a3c]">
                {recentLogs.map((log, i) => {
                  const dotColor = LOG_COLORS[log.type] || '#71717a';
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-900 dark:text-[#e4e4e7] truncate">{log.message}</p>
                        <p className="text-[11px] text-[#71717a]">
                          {log.user || '—'} · {timeAgo(log.timestamp)}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${dotColor}15`, color: dotColor }}
                      >
                        {log.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── project status widget ─────────────────────────────────────────────── */}
      {selectedProject && canSeeStatus && (
        <div>
          <SectionTitle>Statut — {selectedProject.name}</SectionTitle>
          <Card className="px-5 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center">
                  <Gamepad2 size={16} className="text-[#A29BFE]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">
                    {selectedProject.name}
                  </p>
                  {statusInfo ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: statusInfo.color }}
                      />
                      <span className="text-xs font-medium" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </div>
                  ) : (
                    <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse mt-1" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canSeeLogs && (
                  <button
                    onClick={() => setActiveTab('logs')}
                    className="text-xs text-[#71717a] hover:text-[#4ECDC4] border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg px-3 py-1.5 transition-all font-medium"
                  >
                    Logs
                  </button>
                )}
                {hasPermission('view_variables') && (
                  <button
                    onClick={() => setActiveTab('variables')}
                    className="text-xs text-[#71717a] hover:text-[#4ECDC4] border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg px-3 py-1.5 transition-all font-medium"
                  >
                    Variables
                  </button>
                )}
                {hasPermission('send_items') && (
                  <button
                    onClick={() => setActiveTab('send-items')}
                    className="text-xs text-[#71717a] hover:text-[#4ECDC4] border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg px-3 py-1.5 transition-all font-medium"
                  >
                    Send Items
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('status')}
                  className="text-xs bg-[#4ECDC4]/10 text-[#4ECDC4] hover:bg-[#4ECDC4]/20 border border-[#4ECDC4]/25 rounded-lg px-3 py-1.5 transition-all font-medium"
                >
                  Gérer le statut
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};
