import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Gamepad2,
  PenTool,
  Ticket,
  GripVertical,
  Shield,
  Settings,
  Briefcase,
  Activity,
  Plus,
  ArrowUpRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Server,
  Sparkles,
  Terminal,
  ChevronRight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CARD_ORDER_KEY = 'vg_overview_card_order';

const applySavedOrder = (cards) => {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(CARD_ORDER_KEY) || '[]');
  } catch {}
  if (!Array.isArray(saved) || !saved.length) return cards;
  const byLabel = new Map(cards.map((c) => [c.label, c]));
  const ordered = saved.map((label) => byLabel.get(label)).filter(Boolean);
  const known = new Set(ordered.map((c) => c.label));
  return [...ordered, ...cards.filter((c) => !known.has(c.label))];
};

export const DashboardOverview = ({ goTo }) => {
  const { user, hasPermission } = useAuth();

  const canManageUsers = hasPermission('manage_users');
  const canManageWebsite = hasPermission('manage_website');
  const canManageTickets = hasPermission('manage_tickets');
  const canManageCareers = hasPermission('manager_careers');
  const canViewVps = hasPermission('view_vps');

  const [globalStats, setGlobalStats] = useState({ users: null, games: null, blog: null, tickets: null });
  const [globalLoading, setGlobalLoading] = useState(false);
  const [recentTickets, setRecentTickets] = useState([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);

  const dateStr = useMemo(() => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  useEffect(() => {
    const fetches = [];
    if (canManageUsers) {
      fetches.push(
        api
          .get('/api/users?limit=200&page=1')
          .then((r) => {
            const all = r.data.users || [];
            const withPerms = all.filter(
              (u) => u.role === 'super_admin' || u.role === 'admin' || (u.permissions && u.permissions.length > 0)
            );
            setGlobalStats((s) => ({ ...s, users: withPerms.length }));
          })
          .catch(() => {})
      );
    }
    fetches.push(
      api
        .get('/api/website/games/public')
        .then((r) => setGlobalStats((s) => ({ ...s, games: Array.isArray(r.data.games) ? r.data.games.length : null })))
        .catch(() => {})
    );
    fetches.push(
      api
        .get('/api/website/blog/public')
        .then((r) => setGlobalStats((s) => ({ ...s, blog: Array.isArray(r.data.posts) ? r.data.posts.length : null })))
        .catch(() => {})
    );
    if (canManageTickets) {
      fetches.push(
        api
          .get('/api/admin/tickets')
          .then((r) => {
            const list = Array.isArray(r.data.tickets) ? r.data.tickets : [];
            setGlobalStats((s) => ({ ...s, tickets: list.filter((t) => t.status !== 'closed').length }));
            setRecentTickets(list.slice(0, 4));
          })
          .catch(() => {})
      );
    }

    api
      .get('/api/website/settings')
      .then((r) => {
        setMaintenanceMode(!!r.data?.maintenance_mode);
        setApiOnline(true);
      })
      .catch(() => setApiOnline(false));

    if (fetches.length > 0) {
      setGlobalLoading(true);
      Promise.all(fetches).finally(() => setGlobalLoading(false));
    }
  }, [canManageUsers, canManageWebsite, canManageTickets]);

  const statCards = applySavedOrder(
    [
      canManageUsers
        ? {
            label: 'Membres du Studio',
            value: globalStats.users,
            accent: '#FF6600',
            icon: Users,
            loading: globalLoading && globalStats.users === null,
            sub: 'Admins & Staff accrédités',
          }
        : null,
      {
        label: 'Jeux Répertoriés',
        value: globalStats.games,
        accent: '#1D1D1F',
        icon: Gamepad2,
        loading: globalLoading && globalStats.games === null,
        sub: 'Titres publiés & à venir',
      },
      {
        label: 'Articles de Devlog',
        value: globalStats.blog,
        accent: '#5856D6',
        icon: PenTool,
        loading: globalLoading && globalStats.blog === null,
        sub: 'Publications studio',
      },
      canManageTickets
        ? {
            label: 'Tickets Support',
            value: globalStats.tickets,
            accent: '#EB5757',
            icon: Ticket,
            loading: globalLoading && globalStats.tickets === null,
            sub: 'Demandes ouvertes',
          }
        : null,
    ].filter(Boolean)
  );

  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const persistOrder = (cards) => {
    try {
      localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(cards.map((c) => c.label)));
    } catch {}
  };

  const [cardOrder, setCardOrder] = useState(null);
  const orderedCards = cardOrder ?? statCards;

  const handleDragStart = (index) => {
    dragIndexRef.current = index;
  };
  const handleDragOver = (index, e) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
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
  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const displayName = user?.name || user?.firstName || user?.username || 'Équipe Vakar';

  const quickActions = [
    canManageWebsite
      ? {
          id: 'games',
          label: 'Catalogue des Jeux',
          desc: 'Ajouter, éditer et mettre en avant les titres du studio',
          icon: Gamepad2,
          color: '#FF6600',
          action: () => goTo('website-games'),
        }
      : null,
    hasPermission('create_blog')
      ? {
          id: 'blog',
          label: 'Devlog & Journal',
          desc: 'Rédiger les annonces studio et devlogs de développement',
          icon: PenTool,
          color: '#1D1D1F',
          action: () => goTo('website-blog'),
        }
      : null,
    canManageTickets
      ? {
          id: 'support',
          label: 'Support Joueurs',
          desc: 'Répondre aux tickets et traiter les retours de bugs',
          icon: Ticket,
          color: '#EB5757',
          action: () => goTo('support'),
        }
      : null,
    canViewVps
      ? {
          id: 'system',
          label: 'Santé & Serveur VPS',
          desc: 'Sondes CPU, RAM, latence MongoDB et télémétrie',
          icon: Activity,
          color: '#30D158',
          action: () => goTo('system', 'health'),
        }
      : null,
    canManageUsers
      ? {
          id: 'users',
          label: 'Gestion Utilisateurs',
          desc: 'Comptes, staff, réinitialisations et permissions',
          icon: Users,
          color: '#007AFF',
          action: () => goTo('users'),
        }
      : null,
    canManageUsers
      ? {
          id: 'roles',
          label: 'Rôles & Accréditations',
          desc: 'Définition des privilèges et niveaux de sécurité',
          icon: Shield,
          color: '#5856D6',
          action: () => goTo('roles'),
        }
      : null,
    canManageCareers
      ? {
          id: 'careers',
          label: 'Carrières & Recrutement',
          desc: 'Offres demploi et candidatures au studio',
          icon: Briefcase,
          color: '#FF9500',
          action: () => goTo('careers'),
        }
      : null,
    canManageWebsite
      ? {
          id: 'settings',
          label: 'Paramètres du Site',
          desc: 'Mode maintenance, bannière publique, SEO et support',
          icon: Settings,
          color: '#8E8E93',
          action: () => goTo('website-settings', 'global'),
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="max-w-[1120px] mx-auto space-y-8 pb-12 antialiased">
      {/* ── CINEMATIC APPLE HERO SECTION ────────────────────────────────── */}
      <div className="relative rounded-3xl bg-[#1D1D1F] text-white overflow-hidden shadow-xl border border-black/10">
        {/* Real photography background layer with Apple cinematic contrast */}
        <div className="absolute inset-0 z-0">
          <img
            src="/photos/studio-landscape.jpg"
            alt="Vakar Games Studio"
            className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity scale-105 transition-transform duration-1000"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, rgba(29, 29, 31, 0.95) 0%, rgba(29, 29, 31, 0.82) 50%, rgba(255, 102, 0, 0.18) 100%)',
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 p-7 sm:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/15">
                Centre de Contrôle Studio
              </span>
              <span className="text-xs text-white/60 capitalize">
                {dateStr}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white mb-2.5">
              Bonjour, {displayName}.
            </h1>
            <p className="text-sm sm:text-[15px] text-white/75 leading-relaxed font-normal">
              Pilotez les titres en production, administrez la plateforme Vakar Games et surveillez les systèmes en temps réel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Status Link */}
            <Link
              to="/status"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] shadow-sm transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
              <span>Systèmes opérationnels</span>
              <ArrowUpRight size={13} className="text-[#86868B] group-hover:text-[#1D1D1F] transition-colors" />
            </Link>

            {maintenanceMode && (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-[#FF6600] text-white shadow-sm">
                <AlertTriangle size={13} />
                <span>Maintenance Active</span>
              </div>
            )}

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all"
            >
              <span>Site public</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── METRIC CARDS (APPLE WHITE WITH DRAG & DROP) ──────────────────── */}
      {orderedCards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
              Indicateurs Clés
            </h2>
            <span className="text-[11px] text-[#86868B]">Glisser pour réorganiser</span>
          </div>

          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}
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
                  className={`group relative bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                    dragOverIndex === i ? 'ring-2 ring-inset ring-[#FF6600]' : ''
                  }`}
                >
                  <GripVertical
                    size={13}
                    className="absolute top-4 right-4 text-[#D2D2D7] opacity-0 group-hover:opacity-100 transition-opacity"
                  />

                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${card.accent}14`, color: card.accent }}
                    >
                      <Icon size={18} />
                    </div>
                  </div>

                  {card.loading ? (
                    <div className="h-8 w-16 bg-[#F5F5F7] animate-pulse rounded-lg mb-1" />
                  ) : (
                    <div className="text-3xl font-bold tracking-tight text-[#1D1D1F] mb-1 font-mono">
                      {card.value ?? '0'}
                    </div>
                  )}

                  <div className="text-xs font-semibold text-[#1D1D1F] tracking-tight truncate">
                    {card.label}
                  </div>
                  {card.sub && (
                    <div className="text-[11px] text-[#86868B] mt-0.5 truncate">
                      {card.sub}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── WORKSPACES GRID (MIXED APPLE LIGHT & BLACK CARDS) ─────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
            Espaces Studio & Outils
          </h2>
          <span className="text-[11px] text-[#86868B]">Accès rapide</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.action}
                className="group relative text-left rounded-2xl p-5 bg-white border border-[#E5E5EA] hover:border-[#D2D2D7] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs"
                      style={{ backgroundColor: `${action.color}14`, color: action.color }}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#86868B] group-hover:text-[#FF6600] group-hover:bg-[#FF6600]/10 transition-colors">
                      <ArrowUpRight size={14} />
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-[#1D1D1F] mb-1 group-hover:text-[#FF6600] transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-[11.5px] text-[#86868B] leading-relaxed line-clamp-2">
                    {action.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LOWER SECTION: TICKETS & LIVE SYSTEM TELEMETRY ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Tickets Queue */}
        {canManageTickets && (
          <div className="lg:col-span-2 rounded-3xl bg-white border border-[#E5E5EA] p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F5F5F7]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EB5757]/10 text-[#EB5757] flex items-center justify-center">
                  <Ticket size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F]">
                    File de Support Joueurs
                  </h3>
                  <p className="text-[11px] text-[#86868B]">Dernières demandes enregistrées</p>
                </div>
              </div>
              <button
                onClick={() => goTo('support')}
                className="text-xs font-semibold text-[#FF6600] hover:text-[#E05A00] transition-colors"
              >
                Voir tout →
              </button>
            </div>

            {recentTickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#86868B]">
                <CheckCircle size={24} className="mx-auto text-[#30D158] mb-2" />
                <p className="font-medium text-[#1D1D1F]">Aucun ticket en attente</p>
                <p className="mt-0.5">Toutes les demandes ont été traitées.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F5F7]">
                {recentTickets.map((t) => {
                  const isOpen = t.status === 'open';
                  const isInProgress = t.status === 'in_progress';
                  return (
                    <div
                      key={t.ticket_number || t.id}
                      onClick={() => goTo('support')}
                      className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F5F5F7]/80 rounded-xl px-2.5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[10px] font-semibold text-[#86868B] px-1.5 py-0.5 rounded bg-[#F5F5F7]">
                            {t.ticket_number}
                          </span>
                          <span className="text-xs font-semibold text-[#1D1D1F] truncate">
                            {t.subject}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#86868B] truncate">
                          {t.user_email || t.username || 'Joueur'}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-tight ${
                          isOpen
                            ? 'bg-amber-500/10 text-amber-600'
                            : isInProgress
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-[#30D158]/10 text-[#28a745]'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Infrastructure & Status Shortcut (Apple Dark Accent Card) */}
        <div
          className={`rounded-3xl bg-[#1D1D1F] text-white p-6 shadow-sm flex flex-col justify-between border border-black/15 ${
            canManageTickets ? '' : 'lg:col-span-3'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 text-[#FF6600] flex items-center justify-center">
                  <Server size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Infrastructure Live
                  </h3>
                  <p className="text-[11px] text-white/60">Télémétrie de production</p>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/60">Votre Accréditation</span>
                <span className="font-semibold text-white text-[11px] uppercase tracking-wide">
                  {user?.is_super_admin ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Staff'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/60">Permissions Actives</span>
                <span className="font-mono text-[#FF6600] font-semibold text-[11px]">
                  {user?.is_super_admin ? 'TOTAL (Super Admin)' : `${user?.permissions?.length || 0} permissions`}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-white/60">Statut Maintenance</span>
                <span
                  className={`font-semibold text-[11px] ${
                    maintenanceMode ? 'text-[#FF6600]' : 'text-[#30D158]'
                  }`}
                >
                  {maintenanceMode ? 'Active (Restreint)' : 'Désactivée (Public)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-white/60">Passerelle API</span>
                <span className="text-[#30D158] font-medium flex items-center gap-1 text-[11px]">
                  <CheckCircle size={12} /> FastAPI En Ligne
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <Link
              to="/status"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs font-semibold shadow-sm transition-all"
            >
              <span>Ouvrir la Page Statut Public</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
