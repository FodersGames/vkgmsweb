import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Link } from 'react-router-dom';
import {
  Users, Package, Activity, FileText, Database, LogOut, Code,
  Gamepad2, ChevronDown, Check, Globe, Settings, PenTool,
  MessageSquare, Menu, X, ShoppingBag, ClipboardList, LayoutDashboard,
  ArrowRight, Home, Ticket, UserCircle, Tag, HardDrive, Server,
  Search, ChevronRight,
} from 'lucide-react';
import { UserManagement }     from '../components/UserManagement';
import { SendItems }           from '../components/SendItems';
import { ServerStatus }        from '../components/ServerStatus';
import { LogsViewer }          from '../components/LogsViewer';
import { VariablesManagement } from '../components/VariablesManagement';
import { ApiEndpoints }        from '../components/ApiEndpoints';
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
    label: 'Studio',
    id: 'studio',
    items: [
      { id: 'projects',   label: 'Projects',      icon: Gamepad2,      permission: 'view_projects'  },
      { id: 'send-items', label: 'Send Items',     icon: Package,       permission: 'send_items',      requiresProject: true },
      { id: 'status',     label: 'Server Status',  icon: Activity,      permission: 'change_status',   requiresProject: true },
      { id: 'variables',  label: 'Variables',      icon: Database,      permission: 'view_variables',  requiresProject: true },
      { id: 'logs',       label: 'Logs',           icon: FileText,      permission: 'view_logs',       requiresProject: true },
      { id: 'chat',       label: 'Chat',           icon: MessageSquare, permission: 'manage_chat',     requiresProject: true },
      { id: 'missions',   label: 'Missions',       icon: ClipboardList, permission: 'claim_missions',  requiresProject: true },
      { id: 'files',      label: 'Files',          icon: HardDrive,     anyPermission: ['manage_files', 'claim_missions'], requiresProject: true },
      { id: 'players',    label: 'Players',        icon: Users,         permission: 'manage_play',     requiresProject: true },
    ],
  },
  {
    label: 'Website',
    items: [
      { id: 'website-games',    label: 'Games',    icon: Gamepad2,    permission: 'create_games'   },
      { id: 'website-blog',     label: 'Blog',     icon: PenTool,     permission: 'create_blog'    },
      { id: 'website-shop',     label: 'Shop',     icon: ShoppingBag, permission: 'manage_shop'    },
      { id: 'coupons',          label: 'Coupons',  icon: Tag,         permission: 'manage_shop'    },
      { id: 'support',          label: 'Support',  icon: Ticket,      permission: 'manage_tickets' },
      { id: 'website-settings', label: 'Settings', icon: Settings,    permission: 'manage_website' },
    ],
  },
  {
    label: 'Team',
    items: [
      { id: 'users', label: 'Users',    icon: Users,  permission: 'manage_users'  },
      { id: 'api',   label: 'API Docs', icon: Code,   permission: 'view_api_docs' },
      { id: 'vps',   label: 'VPS',      icon: Server, permission: 'view_vps'     },
    ],
  },
];

const PROJECT_TABS = new Set(['send-items', 'status', 'variables', 'logs', 'chat', 'missions', 'files', 'players']);

// ── Helpers ───────────────────────────────────────────────────────────────────

const itemVisible = (item, hasPermission) => {
  if (item.anyPermission) return item.anyPermission.some(p => hasPermission(p));
  if (!item.permission) return true;
  return hasPermission(item.permission);
};

const groupVisible = (group, hasPermission) =>
  group.items.some(i => itemVisible(i, hasPermission));

const findCurrentGroup = (tabId) =>
  NAV_GROUPS.find(g => g.items.some(i => i.id === tabId));

const findCurrentItem = (tabId) => {
  for (const g of NAV_GROUPS) {
    const found = g.items.find(i => i.id === tabId);
    if (found) return found;
  }
  return null;
};

// ── Main component ────────────────────────────────────────────────────────────

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();

  const [activeTab,    setActiveTab]    = useState('overview');
  const [showProject,  setShowProject]  = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  const projectDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (projectDropRef.current && !projectDropRef.current.contains(e.target))
        setShowProject(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const needsProject = PROJECT_TABS.has(activeTab);

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : (user?.username || '');

  const initials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase()
    || user?.username?.charAt(0)?.toUpperCase() || '?';

  const currentGroup = findCurrentGroup(activeTab);
  const currentItem  = findCurrentItem(activeTab);

  // ── Nav item ──────────────────────────────────────────────────────────────

  const NavItem = ({ item }) => {
    const Icon    = item.icon;
    const isActive  = activeTab === item.id;
    const disabled  = item.requiresProject && !selectedProject;

    return (
      <button
        key={item.id}
        onClick={() => { if (!disabled) { setActiveTab(item.id); setMobileOpen(false); } }}
        disabled={disabled}
        data-testid={`sidebar-nav-${item.id}`}
        className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
          isActive
            ? 'bg-brand-50 text-gray-900 font-semibold'
            : disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        }`}
      >
        {isActive && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-brand-400" />
        )}
        <Icon
          size={16}
          className={`shrink-0 transition-colors ${
            isActive ? 'text-brand-400' : disabled ? 'text-gray-200' : 'text-gray-400'
          }`}
        />
        <span className="text-[13px] leading-none flex-1">{item.label}</span>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
        )}
      </button>
    );
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const SidebarContent = ({ onClose }) => (
    <div className="flex flex-col h-full bg-white">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Gamepad2 size={18} className="text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-gray-900 leading-tight">Vakar Games</p>
          <p className="text-[11px] text-gray-400 leading-tight">Admin Panel</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors ml-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3" data-testid="sidebar-nav">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter(i => itemVisible(i, hasPermission));
          if (!visibleItems.length) return null;

          return (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400 px-3 mb-1.5">
                {group.label}
              </p>

              {/* Project selector — Studio only */}
              {group.id === 'studio' && projects.length > 0 && (
                <div className="relative mb-2" ref={projectDropRef}>
                  <button
                    onClick={() => setShowProject(v => !v)}
                    data-testid="project-selector"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-left transition-colors"
                  >
                    <Gamepad2 size={13} className="text-brand-400 shrink-0" />
                    <span className="flex-1 text-[12px] font-medium text-gray-700 truncate">
                      {selectedProject?.name || 'Select project…'}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`text-gray-400 shrink-0 transition-transform ${showProject ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showProject && (
                    <div
                      className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-theme-md overflow-hidden"
                      data-testid="project-dropdown"
                    >
                      {projects.map(p => (
                        <button
                          key={p.slug}
                          onClick={() => { selectProject(p); setShowProject(false); }}
                          data-testid={`project-option-${p.slug}`}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-left transition-colors ${
                            selectedProject?.slug === p.slug
                              ? 'bg-brand-50 text-gray-800 font-semibold'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          }`}
                        >
                          <span className="flex-1 truncate">{p.name}</span>
                          {selectedProject?.slug === p.slug && <Check size={11} className="text-brand-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {visibleItems.map(item => <NavItem key={item.id} item={item} />)}
            </div>
          );
        })}
      </nav>

      {/* User card */}
      <div className="shrink-0 border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-bold text-brand-400 shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-gray-400 leading-tight">
              {user?.is_super_admin ? 'Super Admin' : 'Admin'}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            data-testid="logout-button"
            className="text-gray-400 hover:text-error-500 transition-colors shrink-0"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex shrink-0 w-64 h-full border-r border-gray-100 shadow-theme-sm">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            style={{ backdropFilter: 'blur(2px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 h-full shadow-theme-xl">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-100 shadow-theme-sm flex items-center px-5 gap-4 z-20">
          {/* Mobile burger */}
          <button
            className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          {/* Mobile brand */}
          <span className="lg:hidden text-[14px] font-bold text-gray-900">Vakar Games</span>

          {/* Breadcrumb (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm text-gray-400 font-medium">
              {currentGroup?.label || 'Dashboard'}
            </span>
            {currentItem && currentGroup && (
              <>
                <ChevronRight size={14} className="text-gray-300" />
                <span className="text-sm font-semibold text-gray-800">{currentItem.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Search (decorative) */}
          <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 w-48 select-none">
            <Search size={13} className="text-gray-400 shrink-0" />
            <span className="text-[12px] text-gray-400">Search…</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <Link
              to="/"
              title="Back to site"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
            >
              <Home size={17} />
            </Link>
            <div className="w-px h-5 bg-gray-100 mx-1" />
            <div className="flex items-center gap-2.5 pr-1">
              <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-bold text-brand-400 shrink-0">
                {initials}
              </div>
              <span className="hidden md:block text-[13px] font-semibold text-gray-800">{displayName}</span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              data-testid="logout-button"
              className="p-2 rounded-xl text-gray-400 hover:text-error-500 hover:bg-error-50 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8">

            {activeTab === 'overview' && <DashboardOverview setActiveTab={setActiveTab} />}
            {activeTab === 'projects' && <ProjectManagement />}
            {activeTab === 'users'    && hasPermission('manage_users')  && <UserManagement />}
            {activeTab === 'api'      && hasPermission('view_api_docs') && <ApiEndpoints />}
            {activeTab === 'vps'      && hasPermission('view_vps')      && <VpsStats />}

            {needsProject && !selectedProject && (
              <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-theme-sm flex items-center justify-center mb-5">
                  <Gamepad2 size={22} className="text-gray-300" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  No project selected
                </p>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Select a Project</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  Choose a project from the sidebar to access its data.
                </p>
                <button
                  onClick={() => setActiveTab('projects')}
                  data-testid="go-to-projects-button"
                  className="inline-flex items-center gap-2 bg-brand-400 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-theme-sm"
                >
                  View Projects <ArrowRight size={14} />
                </button>
              </div>
            )}

            {activeTab === 'send-items' && selectedProject && hasPermission('send_items')                                             && <SendItems />}
            {activeTab === 'status'     && selectedProject && hasPermission('change_status')                                          && <ServerStatus />}
            {activeTab === 'variables'  && selectedProject && hasPermission('view_variables')                                         && <VariablesManagement />}
            {activeTab === 'logs'       && selectedProject && hasPermission('view_logs')                                              && <LogsViewer />}
            {activeTab === 'chat'       && selectedProject && hasPermission('manage_chat')                                            && <ChatManagement />}
            {activeTab === 'missions'   && selectedProject && (hasPermission('claim_missions') || hasPermission('create_missions'))   && <MissionsManagement />}
            {activeTab === 'files'      && selectedProject && (hasPermission('manage_files')   || hasPermission('claim_missions'))    && <FilesManagement />}
            {activeTab === 'players'    && selectedProject && hasPermission('manage_play')                                              && <PlayersManagement />}

            {activeTab === 'website-games'    &&                                <GamesManagement />}
            {activeTab === 'website-blog'     &&                                <BlogManagement />}
            {activeTab === 'website-settings' &&                                <WebsiteSettings />}
            {activeTab === 'website-shop'     && hasPermission('manage_shop')   && <ShopManagement />}
            {activeTab === 'coupons'          && hasPermission('manage_shop')   && <CouponManagement />}
            {activeTab === 'support'          && hasPermission('manage_tickets') && <TicketManagement />}
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
