import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import {
  Users, Activity, FileText, LogOut,
  Gamepad2, Settings, PenTool,
  Menu, X, LayoutDashboard,
  Home, Ticket, UserCircle, Server, Shield,
  ChevronRight, ChevronLeft, Briefcase, Terminal, Search, Sun, Moon, GripVertical,
} from 'lucide-react';
import { UserManagement }     from '../components/UserManagement';
import { RoleManagement }     from '../components/RoleManagement';
import { DashboardOverview }   from '../components/DashboardOverview';
import { GamesManagement }     from '../components/GamesManagement';
import { BlogManagement }      from '../components/BlogManagement';
import { GlobalManagement }    from '../components/GlobalManagement';
import { Health }              from '../components/Health';
import { VpsStats }            from '../components/VpsStats';
import TicketManagement        from '../components/TicketManagement';
import { AccountSettings }     from '../components/AccountSettings';
import CareersManagement      from '../components/CareersManagement';
import { CliConsole }         from '../components/CliConsole';
import { CommandPalette }     from '../components/CommandPalette';
import CriticalActionBanner   from '../components/CriticalActionBanner';

// ── Navigation groups ─────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'account',  label: 'Account',  icon: UserCircle },
    ],
  },
  {
    label: 'Website',
    items: [
      { id: 'website-games',    label: 'Games',    icon: Gamepad2,  permission: 'manage_website' },
      { id: 'website-blog',     label: 'Blog',     icon: PenTool,   permission: 'create_blog'    },
      { id: 'careers',          label: 'Careers',  icon: Briefcase, permission: 'manager_careers' },
      { id: 'website-settings', label: 'Settings', icon: Settings,  permission: 'manage_website'  },
    ],
  },
  {
    label: 'Support',
    items: [
      { id: 'support', label: 'Tickets', icon: Ticket, permission: 'manage_tickets' },
    ],
  },
  {
    label: 'Team',
    items: [
      { id: 'users',  label: 'Users',  icon: Users,  permission: 'manage_users' },
      { id: 'roles',  label: 'Roles',  icon: Shield, permission: 'manage_users' },
      { id: 'system', label: 'System', icon: Server, permission: 'view_vps'    },
    ],
  },
];

// ── Workspace sub-tabs ────────────────────────────────────────────────────────
const SYSTEM_SUBTABS = [
  { id: 'vps',    label: 'VPS',    icon: Server,   component: VpsStats,   permission: 'view_vps' },
  { id: 'health', label: 'Health', icon: Activity, component: Health,     permission: 'view_vps' },
  { id: 'cli',    label: 'CLI',    icon: Terminal, component: CliConsole, superAdminOnly: true    },
];

const WEBSITE_SETTINGS_SUBTABS = [
  { id: 'global', label: 'Global Management', icon: Settings, component: GlobalManagement, permission: 'manage_website' },
];

const VALID_TAB_IDS = new Set([
  'overview', 'account', 'website-games', 'website-blog',
  'careers', 'website-settings', 'support', 'users', 'roles', 'system',
]);

const NAV_ORDER_KEY = 'vg_admin_nav_order';

const applyNavOrder = (groups) => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || '{}'); } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return groups;
  return groups.map(g => {
    const order = saved[g.label];
    if (!Array.isArray(order) || !order.length) return g;
    const byId = new Map(g.items.map(i => [i.id, i]));
    const ordered = order.map(id => byId.get(id)).filter(Boolean);
    const known = new Set(ordered.map(i => i.id));
    return { ...g, items: [...ordered, ...g.items.filter(i => !known.has(i.id))] };
  });
};

const persistNavOrder = (groups) => {
  const map = {};
  groups.forEach(g => { map[g.label] = g.items.map(i => i.id); });
  try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(map)); } catch {}
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const itemVisible = (item, hasPermission, isSuperAdmin) => {
  if (item.superAdminOnly) return !!isSuperAdmin;
  if (item.anyPermission) return item.anyPermission.some(p => hasPermission(p));
  if (!item.permission) return true;
  return hasPermission(item.permission);
};

const findCurrentGroup = (tabId) =>
  NAV_GROUPS.find(g => g.items.some(i => i.id === tabId));

const findCurrentItem = (tabId) => {
  for (const g of NAV_GROUPS) {
    const found = g.items.find(i => i.id === tabId);
    if (found) return found;
  }
  return null;
};

// ── Nav item ──────────────────────────────────────────────────────────────
const NavItem = ({ item, activeTab, onSelect, draggable, onDragStart, onDragOver, onDrop, onDragEnd, dragOver }) => {
  const Icon     = item.icon;
  const isActive = activeTab === item.id;

  return (
    <button
      onClick={() => onSelect(item.id)}
      data-testid={`sidebar-nav-${item.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 ${
        dragOver ? 'ring-2 ring-inset ring-[#4ECDC4]' : ''
      } ${
        isActive
          ? 'bg-[#4ECDC4]/10 text-[#4ECDC4] font-medium'
          : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.045] dark:hover:bg-white/[0.06] hover:text-[#1D1D1F] dark:hover:text-white'
      }`}
    >
      <Icon
        size={15}
        className={`shrink-0 transition-colors ${isActive ? 'text-[#4ECDC4]' : 'text-[#A1A1A6] dark:text-[#71717a]'}`}
      />
      <span className="flex-1 text-[13px] leading-none truncate">{item.label}</span>
      {draggable && (
        <GripVertical size={12} className="shrink-0 text-[#D2D2D7] dark:text-[#3a3a4c] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
      )}
    </button>
  );
};

const WorkspaceTabs = ({ tabs, active, onChange }) => (
  <div className="flex items-center gap-1 border-b border-[#D2D2D7] dark:border-[#2a2a3c] mb-6 overflow-x-auto">
    {tabs.map(t => {
      const Icon = t.icon;
      const isActive = t.id === active;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 focus-visible:rounded-md ${
            isActive ? 'border-[#4ECDC4] text-[#1D1D1F] dark:text-white' : 'border-transparent text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white'
          }`}
        >
          <Icon size={14} className={isActive ? 'text-[#4ECDC4]' : 'text-[#A1A1A6] dark:text-[#71717a]'} />
          {t.label}
        </button>
      );
    })}
  </div>
);

const subtabVisible = (t, hasPermission, isSuperAdmin) => {
  if (t.superAdminOnly) return !!isSuperAdmin;
  if (t.anyPermission) return t.anyPermission.some(p => hasPermission(p));
  if (!t.permission) return true;
  return hasPermission(t.permission);
};

const SystemWorkspace = ({ tab, setTab, hasPermission, isSuperAdmin }) => {
  const visible = SYSTEM_SUBTABS.filter(t => subtabVisible(t, hasPermission, isSuperAdmin));
  const active = visible.find(t => t.id === tab) || visible[0];
  if (!active) return null;
  const ActiveComponent = active.component;
  return (
    <div>
      <WorkspaceTabs tabs={visible} active={active.id} onChange={setTab} />
      <ActiveComponent />
    </div>
  );
};

const WebsiteSettingsWorkspace = ({ tab, setTab, hasPermission, isSuperAdmin }) => {
  const visible = WEBSITE_SETTINGS_SUBTABS.filter(t => subtabVisible(t, hasPermission, isSuperAdmin));
  const active = visible.find(t => t.id === tab) || visible[0];
  if (!active) return null;
  const ActiveComponent = active.component;
  return (
    <div>
      <WorkspaceTabs tabs={visible} active={active.id} onChange={setTab} />
      <ActiveComponent />
    </div>
  );
};

const SidebarContent = ({
  onClose, hasPermission, user, activeTab, onSelectTab,
  displayName, initials, logout, onOpenPalette,
  navGroups, onNavDragStart, onNavDragOver, onNavDrop, onNavDragEnd, navDragOverId,
}) => (
  <div className="flex flex-col h-full bg-[#F5F5F7] dark:bg-[#151520] border-r border-[#D2D2D7] dark:border-[#2a2a3c]">
    {/* Logo */}
    <div className="flex items-center gap-3 px-5 h-14 shrink-0 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
      <p className="flex-1 min-w-0 text-[14.5px] font-bold tracking-tight text-[#1D1D1F] dark:text-white truncate">
        Vakar Games
      </p>
      {onClose && (
        <button onClick={onClose} className="text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white transition-colors ml-1">
          <X size={18} />
        </button>
      )}
    </div>

    {/* Jump to… */}
    <div className="px-3 pt-3">
      <button
        onClick={onOpenPalette}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-colors"
      >
        <Search size={13} className="text-[#A1A1A6] dark:text-[#71717a] shrink-0" />
        <span className="flex-1 text-[12px] text-[#A1A1A6] dark:text-[#71717a]">Jump to…</span>
        <kbd className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] border border-[#D2D2D7] dark:border-[#2a2a3c] rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
      </button>
    </div>

    {/* Nav groups */}
    <nav className="flex-1 overflow-y-auto py-5" data-testid="sidebar-nav">
      {navGroups.map((group, gi) => {
        const visibleItems = group.items.filter(i => itemVisible(i, hasPermission, user?.is_super_admin));
        if (!visibleItems.length) return null;

        return (
          <div key={group.label} className={gi > 0 ? 'mt-6' : ''}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#A1A1A6] dark:text-[#71717a] px-2.5 mb-1.5">
              {group.label}
            </p>

            <div className="px-2">
              {visibleItems.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  onSelect={onSelectTab}
                  draggable={visibleItems.length > 1}
                  dragOver={navDragOverId?.groupLabel === group.label && navDragOverId?.itemId === item.id}
                  onDragStart={() => onNavDragStart(group.label, item.id)}
                  onDragOver={(e) => onNavDragOver(e, group.label, item.id)}
                  onDrop={() => onNavDrop(group.label, item.id)}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>

    {/* User card */}
    <div className="shrink-0 border-t border-[#D2D2D7] dark:border-[#2a2a3c] p-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="w-8 h-8 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate leading-tight">{displayName}</p>
          <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] leading-tight">
            {user?.is_super_admin ? 'Super Admin' : 'Admin'}
          </p>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          data-testid="logout-button"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#A1A1A6] dark:text-[#71717a] hover:text-red-500 hover:bg-red-500/10 outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 transition-colors shrink-0"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  </div>
);

const SESSION_KEY = 'vg_admin_last_section';

const restoreSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        ...parsed,
        activeTab: VALID_TAB_IDS.has(parsed.activeTab) ? parsed.activeTab : 'overview',
      };
    }
    return {};
  } catch {
    return {};
  }
};

class TabErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(err) {
    console.warn('[Dashboard Tab Error]', err);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.tabKey !== this.props.tabKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-8 text-center max-w-lg mx-auto my-8">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3 text-lg font-bold">!</div>
          <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white mb-1">Section Temporarily Unavailable</h3>
          <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mb-4">
            An error occurred while displaying this section. You can return to the overview safely.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); this.props.onReset(); }}
            className="px-4 py-2 bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#0D0D0D] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
          >
            Back to Overview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const isSuperAdmin = !!user?.is_super_admin;

  const restored = useRef(restoreSession()).current;

  const [activeTab,    setActiveTab]    = useState(() => {
    const tab = restored.activeTab || 'overview';
    return VALID_TAB_IDS.has(tab) ? tab : 'overview';
  });
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [paletteOpen,  setPaletteOpen]  = useState(false);

  const [navGroups, setNavGroups] = useState(() => applyNavOrder(NAV_GROUPS));
  const [navDragOverId, setNavDragOverId] = useState(null);
  const navDragRef = useRef(null);

  const onNavDragStart = (groupLabel, itemId) => { navDragRef.current = { groupLabel, itemId }; };
  const onNavDragOver = (e, groupLabel, itemId) => {
    e.preventDefault();
    if (navDragRef.current?.groupLabel !== groupLabel) return;
    setNavDragOverId({ groupLabel, itemId });
  };
  const onNavDrop = (groupLabel, targetItemId) => {
    const from = navDragRef.current;
    navDragRef.current = null;
    setNavDragOverId(null);
    if (!from || from.groupLabel !== groupLabel || from.itemId === targetItemId) return;
    setNavGroups(prev => {
      const next = prev.map(g => {
        if (g.label !== groupLabel) return g;
        const items = [...g.items];
        const fromIdx = items.findIndex(i => i.id === from.itemId);
        const toIdx = items.findIndex(i => i.id === targetItemId);
        if (fromIdx === -1 || toIdx === -1) return g;
        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        return { ...g, items };
      });
      persistNavOrder(next);
      return next;
    });
  };
  const onNavDragEnd = () => { navDragRef.current = null; setNavDragOverId(null); };

  const [systemTab,  setSystemTab]  = useState(restored.systemTab || 'vps');
  const [websiteSettingsTab, setWebsiteSettingsTab] = useState(restored.websiteSettingsTab || 'global');

  const historyStack = useRef([]);
  const historyIndex = useRef(-1);
  const suppressHistoryPush = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [navDirection, setNavDirection] = useState('forward');

  useEffect(() => {
    const snap = { activeTab, systemTab, websiteSettingsTab };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap)); } catch {}

    if (suppressHistoryPush.current) {
      suppressHistoryPush.current = false;
    } else {
      historyStack.current = historyStack.current.slice(0, historyIndex.current + 1);
      historyStack.current.push(snap);
      if (historyStack.current.length > 50) historyStack.current.shift();
      historyIndex.current = historyStack.current.length - 1;
    }
    setCanGoBack(historyIndex.current > 0);
    setCanGoForward(historyIndex.current < historyStack.current.length - 1);
  }, [activeTab, systemTab, websiteSettingsTab]);

  const applySnapshot = (snap) => {
    suppressHistoryPush.current = true;
    setActiveTab(snap.activeTab);
    setSystemTab(snap.systemTab);
    setWebsiteSettingsTab(snap.websiteSettingsTab || 'global');
  };
  const goBack = () => {
    if (historyIndex.current <= 0) return;
    historyIndex.current -= 1;
    setNavDirection('back');
    applySnapshot(historyStack.current[historyIndex.current]);
  };
  const goForward = () => {
    if (historyIndex.current >= historyStack.current.length - 1) return;
    historyIndex.current += 1;
    setNavDirection('forward');
    applySnapshot(historyStack.current[historyIndex.current]);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const displayName = user?.name || (user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : (user?.firstName || user?.username || ''));

  const initials = (user?.name?.[0] || user?.firstName?.[0] || user?.username?.charAt(0) || '?').toUpperCase();

  const currentGroup = findCurrentGroup(activeTab);
  const currentItem  = findCurrentItem(activeTab);
  const currentSubLabel = useMemo(() => {
    if (activeTab === 'system') return SYSTEM_SUBTABS.find(t => t.id === systemTab)?.label;
    if (activeTab === 'website-settings') return WEBSITE_SETTINGS_SUBTABS.find(t => t.id === websiteSettingsTab)?.label;
    return null;
  }, [activeTab, systemTab, websiteSettingsTab]);

  const onSelectTab = (id) => { setNavDirection('forward'); setActiveTab(id); setMobileOpen(false); };

  const goTo = (tab, subtab) => {
    setNavDirection('forward');
    setActiveTab(tab);
    if (tab === 'system' && subtab) setSystemTab(subtab);
    if (tab === 'website-settings' && subtab) setWebsiteSettingsTab(subtab);
  };

  const paletteDestinations = useMemo(() => {
    const dest = [];
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (!itemVisible(item, hasPermission, isSuperAdmin)) continue;
        if (item.id === 'system') {
          for (const t of SYSTEM_SUBTABS) {
            if (!subtabVisible(t, hasPermission, isSuperAdmin)) continue;
            dest.push({ label: t.label, group: 'Team', icon: t.icon, onSelect: () => { setNavDirection('forward'); setActiveTab('system'); setSystemTab(t.id); } });
          }
        } else if (item.id === 'website-settings') {
          for (const t of WEBSITE_SETTINGS_SUBTABS) {
            if (!subtabVisible(t, hasPermission, isSuperAdmin)) continue;
            dest.push({ label: t.label, group: 'Website', icon: t.icon, onSelect: () => { setNavDirection('forward'); setActiveTab('website-settings'); setWebsiteSettingsTab(t.id); } });
          }
        } else {
          dest.push({ label: item.label, group: group.label, icon: item.icon, onSelect: () => { setNavDirection('forward'); setActiveTab(item.id); } });
        }
      }
    }
    return dest;
  }, [hasPermission, isSuperAdmin]);

  const sidebarProps = {
    hasPermission, user, activeTab, onSelectTab,
    displayName, initials, logout, onOpenPalette: () => setPaletteOpen(true),
    navGroups, onNavDragStart, onNavDragOver, onNavDrop, onNavDragEnd, navDragOverId,
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'dark bg-[#0e0e15]' : 'bg-[#F5F5F7]'}`}>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[240px] shrink-0 h-full">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[280px] max-w-[85vw] h-full shadow-2xl z-10 animate-appear">
            <SidebarContent {...sidebarProps} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ⌘K palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        destinations={paletteDestinations}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto theme-transition">

        {/* Header */}
        <header className="sticky top-0 z-20 h-14 shrink-0 bg-white/75 dark:bg-[#151520]/75 backdrop-blur-xl backdrop-saturate-150 border-b border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center px-5 gap-4">
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center -ml-1.5 rounded-lg text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.045] dark:hover:bg-white/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          <span className="lg:hidden text-[14.5px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">
            Vakar Games
          </span>

          <div className="hidden lg:flex items-center gap-0.5 -ml-1.5 shrink-0">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              title="Back (Alt+←)"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.045] dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              title="Forward (Alt+→)"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.045] dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 min-w-0">
            <span className="text-sm text-[#A1A1A6] dark:text-[#71717a] shrink-0">
              {currentGroup?.label || 'Dashboard'}
            </span>
            {currentItem && currentGroup && (
              <>
                <ChevronRight size={13} className="text-[#BFBFC4] dark:text-[#3a3a4c] shrink-0" />
                <span className={`text-sm font-semibold shrink-0 ${currentSubLabel ? 'text-[#A1A1A6] dark:text-[#71717a] font-normal' : 'text-[#1D1D1F] dark:text-white'}`}>{currentItem.label}</span>
              </>
            )}
            {currentSubLabel && (
              <>
                <ChevronRight size={13} className="text-[#BFBFC4] dark:text-[#3a3a4c] shrink-0" />
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-white truncate">{currentSubLabel}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setPaletteOpen(true)}
              title="Jump to… (⌘K)"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 rounded-full text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-all"
            >
              <Search size={13} />
              Jump to…
              <kbd className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">⌘K</kbd>
            </button>
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-all"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <Link
              to="/"
              title="View site"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 rounded-full text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-all"
            >
              <Home size={13} />
              View site
            </Link>
            <div className="flex items-center gap-2.5 pl-0.5">
              <div className="w-8 h-8 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
                {initials}
              </div>
              <span className="hidden md:block text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{displayName}</span>
            </div>
          </div>
        </header>

        {isSuperAdmin && <CriticalActionBanner />}

        <main>
          <TabErrorBoundary tabKey={activeTab} onReset={() => setActiveTab('overview')}>
            <div key={`${activeTab}:${activeTab === 'system' ? systemTab : activeTab === 'website-settings' ? websiteSettingsTab : ''}`} className={`p-6 md:p-8 ${navDirection === 'back' ? 'animate-nav-back' : 'animate-nav-forward'}`}>
              {activeTab === 'overview' && <DashboardOverview goTo={goTo} />}
              {activeTab === 'users'    && hasPermission('manage_users')    && <UserManagement />}
              {activeTab === 'roles'    && hasPermission('manage_users')    && <RoleManagement />}
              {activeTab === 'website-games'    && <GamesManagement />}
              {activeTab === 'website-blog'     && <BlogManagement />}
              {activeTab === 'website-settings' && (
                <WebsiteSettingsWorkspace tab={websiteSettingsTab} setTab={setWebsiteSettingsTab} hasPermission={hasPermission} isSuperAdmin={isSuperAdmin} />
              )}
              {activeTab === 'support'          && hasPermission('manage_tickets')  && <TicketManagement />}
              {activeTab === 'careers'          && hasPermission('manager_careers') && <CareersManagement />}
              {activeTab === 'system'           && (
                <SystemWorkspace tab={systemTab} setTab={setSystemTab} hasPermission={hasPermission} isSuperAdmin={isSuperAdmin} />
              )}
              {activeTab === 'account'          && <AccountSettings />}

              {/* Fallback to Overview if no tab condition matched */}
              {activeTab !== 'overview' &&
               !(activeTab === 'users' && hasPermission('manage_users')) &&
               !(activeTab === 'roles' && hasPermission('manage_users')) &&
               activeTab !== 'website-games' &&
               activeTab !== 'website-blog' &&
               activeTab !== 'website-settings' &&
               !(activeTab === 'support' && hasPermission('manage_tickets')) &&
               !(activeTab === 'careers' && hasPermission('manager_careers')) &&
               activeTab !== 'system' &&
               activeTab !== 'account' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-200">
                    Cette section n'est pas accessible ou ne dispose pas des permissions requises. Affichage de la vue d'ensemble.
                  </div>
                  <DashboardOverview goTo={goTo} />
                </div>
              )}
            </div>
          </TabErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export const Dashboard = () => <DashboardContent />;
