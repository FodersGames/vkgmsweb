import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, Gamepad2, PenTool, Ticket, GripVertical, Shield, Settings,
  Briefcase, Activity, Plus, ArrowUpRight, CheckCircle, Clock, AlertTriangle,
  Server, Sparkles, Terminal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CARD_ORDER_KEY = 'vg_overview_card_order';

const applySavedOrder = (cards) => {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(CARD_ORDER_KEY) || '[]'); } catch {}
  if (!Array.isArray(saved) || !saved.length) return cards;
  const byLabel = new Map(cards.map(c => [c.label, c]));
  const ordered = saved.map(label => byLabel.get(label)).filter(Boolean);
  const known = new Set(ordered.map(c => c.label));
  return [...ordered, ...cards.filter(c => !known.has(c.label))];
};

export const DashboardOverview = ({ goTo }) => {
  const { user, hasPermission } = useAuth();

  const canManageUsers   = hasPermission('manage_users');
  const canManageWebsite = hasPermission('manage_website');
  const canManageTickets = hasPermission('manage_tickets');
  const canManageCareers = hasPermission('manager_careers');
  const canViewVps       = hasPermission('view_vps');

  const [globalStats, setGlobalStats] = useState({ users: null, games: null, blog: null, tickets: null });
  const [globalLoading, setGlobalLoading] = useState(false);
  const [recentTickets, setRecentTickets] = useState([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);

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
    fetches.push(
      api.get('/api/website/games/public')
        .then(r => setGlobalStats(s => ({ ...s, games: Array.isArray(r.data.games) ? r.data.games.length : null })))
        .catch(() => {})
    );
    fetches.push(
      api.get('/api/website/blog/public')
        .then(r => setGlobalStats(s => ({ ...s, blog: Array.isArray(r.data.posts) ? r.data.posts.length : null })))
        .catch(() => {})
    );
    if (canManageTickets) {
      fetches.push(
        api.get('/api/admin/tickets')
          .then(r => {
            const list = Array.isArray(r.data.tickets) ? r.data.tickets : [];
            setGlobalStats(s => ({ ...s, tickets: list.filter(t => t.status !== 'closed').length }));
            setRecentTickets(list.slice(0, 4));
          })
          .catch(() => {})
      );
    }

    // Check website settings (maintenance mode)
    api.get('/api/website/settings')
      .then(r => {
        setMaintenanceMode(!!r.data?.maintenance_mode);
        setApiOnline(true);
      })
      .catch(() => setApiOnline(false));

    if (fetches.length > 0) {
      setGlobalLoading(true);
      Promise.all(fetches).finally(() => setGlobalLoading(false));
    }
  }, [canManageUsers, canManageWebsite, canManageTickets]);

  const statCards = applySavedOrder([
    canManageUsers ? { label: 'Staff Members', value: globalStats.users, accent: '#F2994A', icon: Users, loading: globalLoading && globalStats.users === null } : null,
    { label: 'Published Games', value: globalStats.games, accent: '#FF6600', icon: Gamepad2, loading: globalLoading && globalStats.games === null },
    { label: 'Blog Posts', value: globalStats.blog, accent: '#9B51E0', icon: PenTool, loading: globalLoading && globalStats.blog === null },
    canManageTickets ? { label: 'Open Tickets', value: globalStats.tickets, accent: '#EB5757', icon: Ticket, loading: globalLoading && globalStats.tickets === null } : null,
  ].filter(Boolean));

  // Drag-to-reorder for stat cards
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const persistOrder = (cards) => {
    try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(cards.map(c => c.label))); } catch {}
  };

  const [cardOrder, setCardOrder] = useState(null);
  const orderedCards = cardOrder ?? statCards;

  const handleDragStart = (index) => { dragIndexRef.current = index; };
  const handleDragOver = (index, e) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (index) => {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (from === null || from === index) return;
    const next = [...orderedCards];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setCardOrder(next);
    persistOrder(next);
  };
  const handleDragEnd = () => { dragIndexRef.current = null; setDragOverIndex(null); };

  const displayName = user?.name || user?.firstName || user?.username;

  const quickActions = [
    canManageWebsite ? {
      id: 'games',
      label: 'Games Catalog',
      desc: 'Add, edit or feature game releases',
      icon: Gamepad2,
      color: '#FF6600',
      action: () => goTo('website-games'),
    } : null,
    hasPermission('create_blog') ? {
      id: 'blog',
      label: 'Dev Blog',
      desc: 'Write studio updates & announcements',
      icon: PenTool,
      color: '#9B51E0',
      action: () => goTo('website-blog'),
    } : null,
    canManageTickets ? {
      id: 'support',
      label: 'Support Desk',
      desc: 'Resolve player queries & bug reports',
      icon: Ticket,
      color: '#EB5757',
      action: () => goTo('support'),
    } : null,
    canManageUsers ? {
      id: 'roles',
      label: 'Custom Roles',
      desc: 'Create roles, permissions & colors',
      icon: Shield,
      color: '#3B82F6',
      action: () => goTo('roles'),
    } : null,
    canManageUsers ? {
      id: 'users',
      label: 'User Management',
      desc: 'Manage accounts, staff & roles',
      icon: Users,
      color: '#F2994A',
      action: () => goTo('users'),
    } : null,
    canManageCareers ? {
      id: 'careers',
      label: 'Careers & Hiring',
      desc: 'Post job openings & review applicants',
      icon: Briefcase,
      color: '#10B981',
      action: () => goTo('careers'),
    } : null,
    canManageWebsite ? {
      id: 'settings',
      label: 'Website Settings',
      desc: 'Maintenance, banner, SEO & social links',
      icon: Settings,
      color: '#8B5CF6',
      action: () => goTo('website-settings', 'global'),
    } : null,
    canViewVps ? {
      id: 'system',
      label: 'System & Health',
      desc: 'VPS resource metrics & API status',
      icon: Activity,
      color: '#16A085',
      action: () => goTo('system', 'health'),
    } : null,
  ].filter(Boolean);

  return (
    <div className="max-w-[980px] mx-auto space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#1D1D1F] dark:text-white">
            {displayName ? `Welcome, ${displayName}` : 'Welcome'}
          </h1>
          <p className="text-[13.5px] text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">
            {dateStr} | Vakar Games Studio Control Board.
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            API Online
          </div>
          {maintenanceMode && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <AlertTriangle size={12} />
              Maintenance Active
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards (draggable) */}
      {orderedCards.length > 0 && (
        <div>
          <div
            className="animate-appear grid gap-px bg-[#D2D2D7] dark:bg-[#2a2a3c] border border-[#D2D2D7] dark:border-[#2a2a3c] rounded-xl overflow-hidden"
            style={{ gridTemplateColumns: `repeat(${Math.min(orderedCards.length, 4)}, 1fr)` }}
          >
            {orderedCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(i, e)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={`group relative bg-white dark:bg-[#151520] p-5 min-w-0 cursor-grab active:cursor-grabbing transition-opacity ${
                    dragOverIndex === i ? 'ring-2 ring-inset ring-[#FF6600]' : ''
                  }`}
                >
                  <GripVertical size={13} className="absolute top-3 right-3 text-[#D2D2D7] dark:text-[#2a2a3c] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-[28px] h-[28px] rounded-lg flex items-center justify-center mb-3.5" style={{ backgroundColor: `${card.accent}18` }}>
                    <Icon size={14} style={{ color: card.accent }} />
                  </div>
                  {card.loading ? (
                    <div className="h-[26px] w-10 bg-[#EDEDEF] dark:bg-[#1c1c2e] animate-pulse rounded" />
                  ) : (
                    <div className="text-[26px] font-bold tracking-[-0.01em] text-[#1D1D1F] dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {card.value ?? '0'}
                    </div>
                  )}
                  <div className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5 truncate">{card.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[#A1A1A6] dark:text-[#71717a]">
            Studio Workspaces
          </h2>
          <span className="text-[11px] text-[#A1A1A6] dark:text-[#71717a]">Quick Navigation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.action}
                className="group relative text-left rounded-xl p-4 bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#FF6600]/50 dark:hover:border-[#FF6600]/40 transition-all hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${action.color}15`, color: action.color }}>
                    <Icon size={16} />
                  </div>
                  <ArrowUpRight size={14} className="text-[#A1A1A6] dark:text-[#71717a] group-hover:text-[#FF6600] transition-colors" />
                </div>
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white mb-0.5">{action.label}</h3>
                <p className="text-[11px] text-[#6E6E73] dark:text-[#a1a1aa] line-clamp-2 leading-relaxed">{action.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lower Section: Recent Tickets & Studio Environment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tickets (2 cols if available) */}
        {canManageTickets && (
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
              <div className="flex items-center gap-2">
                <Ticket size={15} className="text-[#EB5757]" />
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#1D1D1F] dark:text-white">
                  Recent Support Tickets
                </h3>
              </div>
              <button
                onClick={() => goTo('support')}
                className="text-[11px] font-semibold text-[#FF6600] hover:underline"
              >
                View all →
              </button>
            </div>

            {recentTickets.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#A1A1A6] dark:text-[#71717a]">
                No recent support tickets. All queues clear!
              </div>
            ) : (
              <div className="divide-y divide-[#D2D2D7]/60 dark:divide-[#2a2a3c]/60">
                {recentTickets.map(t => {
                  const isOpen = t.status === 'open';
                  const isInProgress = t.status === 'in_progress';
                  return (
                    <div
                      key={t.ticket_number || t.id}
                      onClick={() => goTo('support')}
                      className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded px-1 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[10px] font-bold text-[#A1A1A6] dark:text-[#71717a]">
                            {t.ticket_number}
                          </span>
                          <span className="text-xs font-semibold text-[#1D1D1F] dark:text-white truncate">
                            {t.subject}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] truncate">
                          {t.user_email || t.username || 'User'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        isOpen ? 'bg-amber-500/10 text-amber-500' :
                        isInProgress ? 'bg-blue-500/10 text-blue-500' :
                        'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Studio Info Card (1 col) */}
        <div className={`rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 ${canManageTickets ? '' : 'lg:col-span-3'}`}>
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
            <Sparkles size={15} className="text-[#FF6600]" />
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#1D1D1F] dark:text-white">
              Studio Environment
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-[#6E6E73] dark:text-[#a1a1aa]">Your Role</span>
              <span className="font-bold text-[#1D1D1F] dark:text-white uppercase text-[11px]">
                {user?.is_super_admin ? 'Super Admin' : (user?.role === 'admin' ? 'Admin' : 'Staff')}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-[#D2D2D7]/40 dark:border-[#2a2a3c]/40">
              <span className="text-[#6E6E73] dark:text-[#a1a1aa]">Permissions</span>
              <span className="font-mono font-semibold text-[#FF6600]">
                {user?.is_super_admin ? 'ALL (Super)' : `${user?.permissions?.length || 0} active`}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-[#D2D2D7]/40 dark:border-[#2a2a3c]/40">
              <span className="text-[#6E6E73] dark:text-[#a1a1aa]">Maintenance</span>
              <span className={`font-semibold text-[11px] ${maintenanceMode ? 'text-amber-500 font-bold' : 'text-[#6E6E73] dark:text-[#a1a1aa]'}`}>
                {maintenanceMode ? 'Active (Staff only)' : 'Off (Public)'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-[#D2D2D7]/40 dark:border-[#2a2a3c]/40">
              <span className="text-[#6E6E73] dark:text-[#a1a1aa]">Backend</span>
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <CheckCircle size={12} /> FastAPI (Vercel)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

