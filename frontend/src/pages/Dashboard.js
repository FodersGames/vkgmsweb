import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Link } from 'react-router-dom';
import {
  Users, Activity, FileText, Database, LogOut,
  Gamepad2, ChevronDown, Check, Settings, PenTool,
  MessageSquare, Menu, X, ShoppingBag, ClipboardList, LayoutDashboard,
  ArrowRight, Home, Ticket, UserCircle, Tag, HardDrive, Server,
  ChevronRight, Briefcase, Terminal, Search, Sun, Moon,
} from 'lucide-react';
import { UserManagement }     from '../components/UserManagement';
import { ServerStatus }        from '../components/ServerStatus';
import { LogsViewer }          from '../components/LogsViewer';
import { VariablesManagement } from '../components/VariablesManagement';
import { DashboardOverview }   from '../components/DashboardOverview';
import { ProjectManagement }   from '../components/ProjectManagement';
import { GamesManagement }     from '../components/GamesManagement';
import { BlogManagement }      from '../components/BlogManagement';
import { ChatManagement }      from '../components/ChatManagement';
import { WebsiteSettings }     from '../components/WebsiteSettings';
import { ShopManagement }      from '../components/ShopManagement';
import { MissionsManagement }  from '../components/MissionsManagement';
import { FilesManagement }     from '../components/FilesManagement';
import { VpsStats }            from '../components/VpsStats';
import TicketManagement        from '../components/TicketManagement';
import { AccountSettings }     from '../components/AccountSettings';
import { CouponManagement }    from '../components/CouponManagement';
import { PlayersManagement }   from '../components/PlayersManagement';
import CareersManagement      from '../components/CareersManagement';
import { CliConsole }         from '../components/CliConsole';
import { CommandPalette }     from '../components/CommandPalette';

// ── Navigation groups ─────────────────────────────────────────────────────────
// Each top-level item is either a single view, or a workspace that owns its
// own internal tab bar (see *_SUBTABS below) — collapsing what used to be 8
// separate "Studio" entries down to one "Projects" workspace, etc.

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'account',  label: 'Account',  icon: UserCircle },
    ],
  },
  {
    label: 'Studio',
    id: 'studio',
    items: [
      {
        id: 'projects', label: 'Projects', icon: Gamepad2,
        anyPermission: ['view_projects', 'change_status', 'view_variables', 'view_logs', 'manage_chat', 'claim_missions', 'create_missions', 'manage_files', 'manage_play'],
      },
    ],
  },
  {
    label: 'Website',
    items: [
      { id: 'website-games',    label: 'Games',    icon: Gamepad2,    permission: 'create_games'   },
      { id: 'website-blog',     label: 'Blog',     icon: PenTool,     permission: 'create_blog'    },
      { id: 'website-shop',     label: 'Shop',     icon: ShoppingBag, permission: 'manage_shop'    },
      { id: 'careers',          label: 'Careers',  icon: Briefcase,   permission: 'manager_careers' },
      { id: 'website-settings', label: 'Settings', icon: Settings,    permission: 'manage_website'  },
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
      { id: 'system', label: 'System', icon: Server, permission: 'view_vps'    },
    ],
  },
];

// ── Workspace sub-tabs ────────────────────────────────────────────────────────

const PROJECT_SUBTABS = [
  { id: 'list',      label: 'Projects',      icon: Gamepad2,      component: ProjectManagement,   permission: 'view_projects' },
  { id: 'status',    label: 'Server Status', icon: Activity,      component: ServerStatus,        permission: 'change_status',  needsProject: true },
  { id: 'variables', label: 'Variables',     icon: Database,      component: VariablesManagement, permission: 'view_variables', needsProject: true },
  { id: 'logs',      label: 'Logs',          icon: FileText,      component: LogsViewer,          permission: 'view_logs',      needsProject: true },
  { id: 'chat',      label: 'Chat',          icon: MessageSquare, component: ChatManagement,      permission: 'manage_chat',    needsProject: true },
  { id: 'missions',  label: 'Missions',      icon: ClipboardList, component: MissionsManagement,  anyPermission: ['claim_missions', 'create_missions'], needsProject: true },
  { id: 'files',     label: 'Files',         icon: HardDrive,     component: FilesManagement,     anyPermission: ['manage_files', 'claim_missions'],    needsProject: true },
  { id: 'players',   label: 'Players',       icon: Users,         component: PlayersManagement,   permission: 'manage_play',    needsProject: true },
];

const SHOP_SUBTABS = [
  { id: 'shop',    label: 'Shop',    icon: ShoppingBag, component: ShopManagement,   permission: 'manage_shop' },
  { id: 'coupons', label: 'Coupons', icon: Tag,         component: CouponManagement, permission: 'manage_shop' },
];

const SYSTEM_SUBTABS = [
  { id: 'vps', label: 'VPS', icon: Server,   component: VpsStats,   permission: 'view_vps' },
  { id: 'cli', label: 'CLI', icon: Terminal, component: CliConsole, superAdminOnly: true    },
];

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
// Hoisted to module scope (not defined inside DashboardContent): keeping it a stable
// component reference means React patches the existing DOM on re-render instead of
// remounting it, which is what preserves the sidebar's scroll position across tab clicks.

const NavItem = ({ item, activeTab, onSelect }) => {
  const Icon     = item.icon;
  const isActive = activeTab === item.id;

  return (
    <button
      onClick={() => onSelect(item.id)}
      data-testid={`sidebar-nav-${item.id}`}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150 ${
        isActive
          ? 'bg-[#4ECDC4]/10 text-[#4ECDC4] font-medium'
          : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.045] dark:hover:bg-white/[0.06] hover:text-[#1D1D1F] dark:hover:text-white'
      }`}
    >
      <Icon
        size={15}
        className={`shrink-0 transition-colors ${isActive ? 'text-[#4ECDC4]' : 'text-[#A1A1A6] dark:text-[#71717a]'}`}
      />
      <span className="text-[13px] leading-none">{item.label}</span>
    </button>
  );
};

// ── Workspace building blocks ────────────────────────────────────────────────
// Shared by the Projects / Shop / System workspaces below: a horizontal
// underline tab bar for the workspace's internal sections.

const WorkspaceTabs = ({ tabs, active, onChange }) => (
  <div className="flex items-center gap-1 border-b border-[#D2D2D7] dark:border-[#2a2a3c] mb-6 overflow-x-auto">
    {tabs.map(t => {
      const Icon = t.icon;
      const isActive = t.id === active;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
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

const NoProjectSelected = ({ onGoToList }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
    <div className="w-14 h-14 rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center mb-5">
      <Gamepad2 size={22} className="text-[#BFBFC4] dark:text-[#52525b]" />
    </div>
    <p className="text-[11px] font-semibold text-[#A1A1A6] dark:text-[#71717a] mb-2">No project selected</p>
    <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7] mb-2">Select a Project</h3>
    <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mb-6 leading-relaxed">
      Choose a project from the sidebar to access its data.
    </p>
    <button
      onClick={onGoToList}
      data-testid="go-to-projects-button"
      className="inline-flex items-center gap-2 rounded-full bg-[#1D1D1F] hover:bg-[#3A3A3C] dark:bg-[#e4e4e7] dark:text-[#0e0e15] dark:hover:bg-white text-white px-5 py-2.5 text-sm font-semibold transition-colors"
    >
      View Projects <ArrowRight size={14} />
    </button>
  </div>
);

const subtabVisible = (t, hasPermission, isSuperAdmin) => {
  if (t.superAdminOnly) return !!isSuperAdmin;
  if (t.anyPermission) return t.anyPermission.some(p => hasPermission(p));
  if (!t.permission) return true;
  return hasPermission(t.permission);
};

const ProjectWorkspace = ({ tab, setTab, hasPermission, isSuperAdmin, selectedProject }) => {
  const visible = PROJECT_SUBTABS.filter(t => subtabVisible(t, hasPermission, isSuperAdmin));
  const active = visible.find(t => t.id === tab) || visible[0];
  if (!active) return null;
  const ActiveComponent = active.component;
  const showEmptyState = active.needsProject && !selectedProject;

  return (
    <div>
      <WorkspaceTabs tabs={visible} active={active.id} onChange={setTab} />
      {showEmptyState ? <NoProjectSelected onGoToList={() => setTab('list')} /> : <ActiveComponent />}
    </div>
  );
};

const ShopWorkspace = ({ tab, setTab, hasPermission, isSuperAdmin }) => {
  const visible = SHOP_SUBTABS.filter(t => subtabVisible(t, hasPermission, isSuperAdmin));
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

// ── Sidebar ───────────────────────────────────────────────────────────────
// Also hoisted for the same reason as NavItem above.

const SidebarContent = ({
  onClose, hasPermission, user, projects, selectedProject, selectProject,
  showProject, setShowProject, projectDropRef, activeTab, onSelectTab,
  displayName, initials, logout, onOpenPalette,
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
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] text-left transition-colors"
      >
        <Search size={13} className="text-[#A1A1A6] dark:text-[#71717a] shrink-0" />
        <span className="flex-1 text-[12px] text-[#A1A1A6] dark:text-[#71717a]">Jump to…</span>
        <kbd className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] border border-[#D2D2D7] dark:border-[#2a2a3c] rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
      </button>
    </div>

    {/* Nav groups */}
    <nav className="flex-1 overflow-y-auto py-5" data-testid="sidebar-nav">
      {NAV_GROUPS.map((group, gi) => {
        const visibleItems = group.items.filter(i => itemVisible(i, hasPermission, user?.is_super_admin));
        if (!visibleItems.length) return null;

        return (
          <div key={group.label} className={gi > 0 ? 'mt-6' : ''}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#A1A1A6] dark:text-[#71717a] px-2.5 mb-1.5">
              {group.label}
            </p>

            {/* Project selector — Studio only */}
            {group.id === 'studio' && projects.length > 0 && (
              <div className="relative mb-2 mx-3" ref={projectDropRef}>
                <button
                  onClick={() => setShowProject(v => !v)}
                  data-testid="project-selector"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] text-left transition-colors"
                >
                  <Gamepad2 size={13} className="text-[#4ECDC4] shrink-0" />
                  <span className="flex-1 text-[12px] font-medium text-[#1D1D1F] dark:text-[#e4e4e7] truncate">
                    {selectedProject?.name || 'Select project…'}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-[#6E6E73] dark:text-[#a1a1aa] shrink-0 transition-transform ${showProject ? 'rotate-180' : ''}`}
                  />
                </button>
                {showProject && (
                  <div
                    className="absolute z-50 left-0 right-0 mt-1 rounded-lg bg-white dark:bg-[#1c1c2e] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-lg overflow-hidden"
                    data-testid="project-dropdown"
                  >
                    {projects.map(p => (
                      <button
                        key={p.slug}
                        onClick={() => { selectProject(p); setShowProject(false); }}
                        data-testid={`project-option-${p.slug}`}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-left transition-colors ${
                          selectedProject?.slug === p.slug
                            ? 'bg-[#4ECDC4]/10 text-[#1D1D1F] dark:text-white font-medium'
                            : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] hover:text-[#1D1D1F] dark:hover:text-white'
                        }`}
                      >
                        <span className="flex-1 truncate">{p.name}</span>
                        {selectedProject?.slug === p.slug && <Check size={11} className="text-[#4ECDC4]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-2">
              {visibleItems.map(item => (
                <NavItem key={item.id} item={item} activeTab={activeTab} onSelect={onSelectTab} />
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
          className="p-1.5 text-[#A1A1A6] dark:text-[#71717a] hover:text-red-500 transition-colors shrink-0"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { projects, selectedProject, selectProject } = useProject();
  const isSuperAdmin = !!user?.is_super_admin;

  const [activeTab,    setActiveTab]    = useState('overview');
  const [showProject,  setShowProject]  = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [paletteOpen,  setPaletteOpen]  = useState(false);

  const [projectTab, setProjectTab] = useState('list');
  const [shopTab,    setShopTab]    = useState('shop');
  const [systemTab,  setSystemTab]  = useState('vps');

  const projectDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (projectDropRef.current && !projectDropRef.current.contains(e.target))
        setShowProject(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Global ⌘K / Ctrl+K — jump to any section without touching the sidebar.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : (user?.username || '');

  const initials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase()
    || user?.username?.charAt(0)?.toUpperCase() || '?';

  const currentGroup = findCurrentGroup(activeTab);
  const currentItem  = findCurrentItem(activeTab);
  const currentSubLabel = useMemo(() => {
    if (activeTab === 'projects') return PROJECT_SUBTABS.find(t => t.id === projectTab)?.label;
    if (activeTab === 'website-shop') return SHOP_SUBTABS.find(t => t.id === shopTab)?.label;
    if (activeTab === 'system') return SYSTEM_SUBTABS.find(t => t.id === systemTab)?.label;
    return null;
  }, [activeTab, projectTab, shopTab, systemTab]);

  const onSelectTab = (id) => { setActiveTab(id); setMobileOpen(false); };

  // Used by DashboardOverview's quick actions to jump straight into a workspace sub-tab.
  const goTo = (tab, subtab) => {
    setActiveTab(tab);
    if (tab === 'projects' && subtab) setProjectTab(subtab);
    if (tab === 'website-shop' && subtab) setShopTab(subtab);
    if (tab === 'system' && subtab) setSystemTab(subtab);
  };

  // Flat, permission-filtered list of everything ⌘K can jump straight to —
  // including workspace sub-sections, so "Logs" or "Coupons" resolve directly.
  const paletteDestinations = useMemo(() => {
    const dest = [];
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (!itemVisible(item, hasPermission, isSuperAdmin)) continue;
        if (item.id === 'projects') {
          for (const t of PROJECT_SUBTABS) {
            if (!subtabVisible(t, hasPermission, isSuperAdmin)) continue;
            dest.push({ label: t.label, group: 'Studio', icon: t.icon, onSelect: () => { setActiveTab('projects'); setProjectTab(t.id); } });
          }
        } else if (item.id === 'website-shop') {
          for (const t of SHOP_SUBTABS) {
            if (!subtabVisible(t, hasPermission, isSuperAdmin)) continue;
            dest.push({ label: t.label, group: 'Website', icon: t.icon, onSelect: () => { setActiveTab('website-shop'); setShopTab(t.id); } });
          }
        } else if (item.id === 'system') {
          for (const t of SYSTEM_SUBTABS) {
            if (!subtabVisible(t, hasPermission, isSuperAdmin)) continue;
            dest.push({ label: t.label, group: 'Team', icon: t.icon, onSelect: () => { setActiveTab('system'); setSystemTab(t.id); } });
          }
        } else {
          dest.push({ label: item.label, group: group.label, icon: item.icon, onSelect: () => setActiveTab(item.id) });
        }
      }
    }
    return dest;
  }, [hasPermission, isSuperAdmin]);

  const sidebarProps = {
    hasPermission, user, projects, selectedProject, selectProject,
    showProject, setShowProject, projectDropRef, activeTab, onSelectTab,
    displayName, initials, logout, onOpenPalette: () => setPaletteOpen(true),
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex h-screen overflow-hidden bg-[#F5F5F7] ${isDark ? 'dark dark:bg-[#0e0e15]' : ''}`}>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex shrink-0 w-[240px] h-full">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-appear relative z-10 w-72 h-full shadow-2xl">
            <SidebarContent {...sidebarProps} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} destinations={paletteDestinations} />

      {/* Main — header + content share one scroll container so the header can
          stay sticky and translucent, with content genuinely passing beneath it. */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto theme-transition">

        {/* Header — glass: translucent + blur, floats above scrolled content */}
        <header className="sticky top-0 z-20 h-14 shrink-0 bg-white/75 dark:bg-[#151520]/75 backdrop-blur-xl backdrop-saturate-150 border-b border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center px-5 gap-4">
          {/* Mobile burger */}
          <button
            className="lg:hidden p-2 -ml-1 text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          {/* Mobile brand */}
          <span className="lg:hidden text-[14.5px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">
            Vakar Games
          </span>

          {/* Breadcrumb (desktop) */}
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

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              title="Jump to… (⌘K)"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] px-3 py-2 transition-all"
            >
              <Search size={12} />
              Jump to…
              <kbd className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">⌘K</kbd>
            </button>
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-full text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] transition-all"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <Link
              to="/"
              title="View site"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] px-3 py-2 transition-all"
            >
              <Home size={12} />
              View site
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
                {initials}
              </div>
              <span className="hidden md:block text-[13px] font-semibold text-[#1D1D1F] dark:text-white">{displayName}</span>
            </div>
          </div>
        </header>

        {/* Content — keyed by the active section so switching tabs replays the appear animation */}
        <main>
          <div key={`${activeTab}:${activeTab === 'projects' ? projectTab : activeTab === 'website-shop' ? shopTab : activeTab === 'system' ? systemTab : ''}`} className="p-6 md:p-8 animate-appear">

            {activeTab === 'overview' && <DashboardOverview goTo={goTo} />}

            {activeTab === 'projects' && (
              <ProjectWorkspace
                tab={projectTab} setTab={setProjectTab}
                hasPermission={hasPermission} isSuperAdmin={isSuperAdmin}
                selectedProject={selectedProject}
              />
            )}

            {activeTab === 'website-shop' && (
              <ShopWorkspace tab={shopTab} setTab={setShopTab} hasPermission={hasPermission} isSuperAdmin={isSuperAdmin} />
            )}

            {activeTab === 'system' && (
              <SystemWorkspace tab={systemTab} setTab={setSystemTab} hasPermission={hasPermission} isSuperAdmin={isSuperAdmin} />
            )}

            {activeTab === 'users'    && hasPermission('manage_users')    && <UserManagement />}
            {activeTab === 'website-games'    && <GamesManagement />}
            {activeTab === 'website-blog'     && <BlogManagement />}
            {activeTab === 'website-settings' && <WebsiteSettings />}
            {activeTab === 'support'          && hasPermission('manage_tickets')  && <TicketManagement />}
            {activeTab === 'careers'          && hasPermission('manager_careers') && <CareersManagement />}
            {activeTab === 'account'          && <AccountSettings />}

          </div>
        </main>
      </div>
    </div>
  );
};

export const Dashboard = () => (
  <ProjectProvider>
    <DashboardContent />
  </ProjectProvider>
);
