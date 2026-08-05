import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppWindow, ClipboardCheck, Users, GripVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CARD_ORDER_KEY = 'vg_overview_card_order';

// Reorders `cards` (each needs a stable `.label`) to match a saved order,
// appending any new cards the saved order doesn't know about yet.
const applySavedOrder = (cards) => {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(CARD_ORDER_KEY) || '[]'); } catch {}
  if (!saved.length) return cards;
  const byLabel = new Map(cards.map(c => [c.label, c]));
  const ordered = saved.map(label => byLabel.get(label)).filter(Boolean);
  const known = new Set(ordered.map(c => c.label));
  return [...ordered, ...cards.filter(c => !known.has(c.label))];
};

const Panel = ({ children, className = '' }) => (
  <div className={`animate-appear rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden ${className}`}>
    {children}
  </div>
);

export const DashboardOverview = ({ goTo }) => {
  const { user, hasPermission } = useAuth();

  const canManageUsers = hasPermission('manage_users');
  const canSeeStudio    = hasPermission('manage_studio_apps');

  const [globalStats, setGlobalStats]     = useState({ users: null, apps: null, pendingReviews: null });
  const [globalLoading, setGlobalLoading] = useState(false);

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
    if (canSeeStudio) {
      fetches.push(
        api.get('/api/admin/studio-apps')
          .then(r => setGlobalStats(s => ({ ...s, apps: Array.isArray(r.data.apps) ? r.data.apps.length : null })))
          .catch(() => {})
      );
      fetches.push(
        api.get('/api/admin/studio-apps/reviews?status=pending')
          .then(r => setGlobalStats(s => ({ ...s, pendingReviews: Array.isArray(r.data.reviews) ? r.data.reviews.length : null })))
          .catch(() => {})
      );
    }
    if (fetches.length > 0) {
      setGlobalLoading(true);
      Promise.all(fetches).finally(() => setGlobalLoading(false));
    }
  }, [canManageUsers, canSeeStudio]);

  const statCards = applySavedOrder([
    canManageUsers ? { label: 'Staff',           value: globalStats.users,          accent: '#F2994A', icon: Users,          loading: globalLoading && globalStats.users === null } : null,
    canSeeStudio   ? { label: 'Studio Apps',      value: globalStats.apps,           accent: '#4ECDC4', icon: AppWindow,      loading: globalLoading && globalStats.apps === null } : null,
    canSeeStudio   ? { label: 'Pending reviews',  value: globalStats.pendingReviews, accent: '#9B51E0', icon: ClipboardCheck, loading: globalLoading && globalStats.pendingReviews === null } : null,
  ].filter(Boolean));

  // Drag-to-reorder for the stat cards, persisted per-browser.
  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const persistOrder = (cards) => {
    try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(cards.map(c => c.label))); } catch {}
  };

  const [cardOrder, setCardOrder] = useState(null); // null = "use computed statCards as-is"
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

  const displayName = user?.firstName || user?.username;

  return (
    <div className="max-w-[980px] mx-auto space-y-7">

      {/* Page head */}
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#1D1D1F] dark:text-white">
          {displayName ? `Welcome, ${displayName}` : 'Welcome'}
        </h1>
        <p className="text-[13.5px] text-[#6E6E73] dark:text-[#a1a1aa] mt-1">{dateStr} — here's what's happening across Vakar Studio.</p>
      </div>

      {/* Stat cards — drag to reorder, saved per-browser */}
      {orderedCards.length > 0 && (
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
                  dragOverIndex === i ? 'ring-2 ring-inset ring-[#4ECDC4]' : ''
                }`}
              >
                <GripVertical size={13} className="absolute top-3 right-3 text-[#D2D2D7] dark:text-[#2a2a3c] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-[26px] h-[26px] rounded-lg flex items-center justify-center mb-3.5" style={{ backgroundColor: `${card.accent}18` }}>
                  <Icon size={13} style={{ color: card.accent }} />
                </div>
                {card.loading ? (
                  <div className="h-[26px] w-10 bg-[#EDEDEF] dark:bg-[#1c1c2e] animate-pulse rounded" />
                ) : (
                  <div className="text-[26px] font-bold tracking-[-0.01em] text-[#1D1D1F] dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {card.value ?? '—'}
                  </div>
                )}
                <div className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5 truncate">{card.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending reviews shortcut */}
      {canSeeStudio && !!globalStats.pendingReviews && (
        <Panel className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#9B51E0]/10 flex items-center justify-center shrink-0">
              <ClipboardCheck size={18} className="text-[#9B51E0]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">
                {globalStats.pendingReviews} app{globalStats.pendingReviews !== 1 ? 's' : ''} waiting for review
              </p>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">Community submissions need your approval before they go live.</p>
            </div>
          </div>
          <button
            onClick={() => goTo('app-reviews')}
            className="rounded-full inline-flex items-center gap-2 bg-[#1D1D1F] dark:bg-[#e4e4e7] hover:bg-[#3A3A3C] dark:hover:bg-white text-white dark:text-[#0e0e15] px-4 py-2 text-xs font-semibold transition-colors shrink-0"
          >
            Review now
          </button>
        </Panel>
      )}

    </div>
  );
};
