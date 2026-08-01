import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Link } from 'react-router-dom';
import {
  Users, Activity, FileText, Database, LogOut,
  Gamepad2, ChevronDown, Check, Settings, PenTool,
  MessageSquare, Menu, X, ShoppingBag, ClipboardList, LayoutDashboard,
  ArrowRight, Home, Ticket, UserCircle, Tag, HardDrive, Server,
  ChevronRight, Briefcase, Terminal,
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
      { id: 'status',     label: 'Server Status',  icon: Activity,      permission: 'change_status',   requiresProject: true },
      { id: 'variables',  label: 'Variables',      icon: Database,      permission: 'view_variables',  requiresProject: true },
      { id: 'logs',       label: 'Logs',           icon: FileText,      permission: 'view_logs',       requiresProject: true },
      { id: 'chat',       label: 'Chat',           icon: MessageSquare, permission: 'manage_chat',     requiresProject: true },
      { id: 'missions',   label: 'Missions',       icon: ClipboardList, permission: 'claim_missions',  requiresProject: true },
      { id: 'files',      label: 'Files',          icon: HardDrive,     anyPermission: ['manage_files', 'claim_missions'], requiresProject: true },
      { id: 'players',    label: 'Players',        icon: Users,         permission: 'manage_play',                         requiresProject: true },
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
      { id: 'website-settings', label: 'Settings',  icon: Settings,    permission: 'manage_website'  },
      { id: 'careers',          label: 'Careers',   icon: Briefcase,   permission: 'manager_careers' },
    ],
  },
  {
    label: 'Team',
    items: [
      { id: 'users', label: 'Users',    icon: Users,  permission: 'manage_users'  },
      { id: 'vps',   label: 'VPS',      icon: Server, permission: 'view_vps'     },
      { id: 'cli',   label: 'CLI',      icon: Terminal, superAdminOnly: true     },
    ],
  },
];

const PROJECT_TABS = new Set(['status', 'variables', 'logs', 'chat', 'missions', 'files', 'players']);

// ── Helpers ───────────────────────────────────────────────────────────────────

const itemVisible = (item, hasPermission, isSuperAdmin) => {
  if (item.superAdminOnly) return !!isSuperAdmin;
  if (item.anyPermission) return item.anyPermission.some(p => hasPermission(p));
  if (!item.permission) return true;
  return hasPermission(item.permission);
};

const groupVisible = (group, hasPermission, isSuperAdmin) =>
  group.items.some(i => itemVisible(i, hasPermission, isSuperAdmin));

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

const NavItem = ({ item, activeTab, selectedProject, onSelect }) => {
  const Icon     = item.icon;
  const isActive = activeTab === item.id;
  const disabled = item.requiresProject && !selectedProject;

  return (
    <button
      onClick={() => { if (!disabled) onSelect(item.id); }}
      disabled={disabled}
      data-testid={`sidebar-nav-${item.id}`}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-150 ${
        isActive
          ? 'bg-[#4ECDC4]/10 text-[#4ECDC4] font-medium'
          : disabled
          ? 'text-[#BFBFC4] cursor-not-allowed'
          : 'text-[#6E6E73] hover:bg-black/[0.045] hover:text-[#1D1D1F]'
      }`}
    >
      <Icon
        size={15}
        className={`shrink-0 transition-colors ${
          isActive ? 'text-[#4ECDC4]' : disabled ? 'text-[#BFBFC4]' : 'text-[#A1A1A6]'
        }`}
      />
      <span className="text-[13px] leading-none">{item.label}</span>
    </button>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────
// Also hoisted for the same reason as NavItem above.

const SidebarContent = ({
  onClose, hasPermission, user, projects, selectedProject, selectProject,
  showProject, setShowProject, projectDropRef, activeTab, onSelectTab,
  displayName, initials, logout,
}) => (
  <div className="flex flex-col h-full bg-[#F5F5F7] border-r border-[#D2D2D7]">

    {/* Logo */}
    <div className="flex items-center gap-3 px-5 h-14 shrink-0 border-b border-[#D2D2D7]">
      <p className="flex-1 min-w-0 text-[14.5px] font-bold tracking-tight text-[#1D1D1F] truncate">
        Vakar Games
      </p>
      {onClose && (
        <button onClick={onClose} className="text-[#6E6E73] hover:text-[#1D1D1F] transition-colors ml-1">
          <X size={18} />
        </button>
      )}
    </div>

    {/* Nav groups */}
    <nav className="flex-1 overflow-y-auto py-5" data-testid="sidebar-nav">
      {NAV_GROUPS.map((group, gi) => {
        const visibleItems = group.items.filter(i => itemVisible(i, hasPermission, user?.is_super_admin));
        if (!visibleItems.length) return null;

        return (
          <div key={group.label} className={gi > 0 ? 'mt-6' : ''}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#A1A1A6] px-2.5 mb-1.5">
              {group.label}
            </p>

            {/* Project selector — Studio only */}
            {group.id === 'studio' && projects.length > 0 && (
              <div className="relative mb-2 mx-3" ref={projectDropRef}>
                <button
                  onClick={() => setShowProject(v => !v)}
                  data-testid="project-selector"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#D2D2D7] hover:border-[#BFBFC4] text-left transition-colors"
                >
                  <Gamepad2 size={13} className="text-[#4ECDC4] shrink-0" />
                  <span className="flex-1 text-[12px] font-medium text-[#1D1D1F] truncate">
                    {selectedProject?.name || 'Select project…'}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-[#6E6E73] shrink-0 transition-transform ${showProject ? 'rotate-180' : ''}`}
                  />
                </button>
                {showProject && (
                  <div
                    className="absolute z-50 left-0 right-0 mt-1 rounded-lg bg-white border border-[#D2D2D7] shadow-lg overflow-hidden"
                    data-testid="project-dropdown"
                  >
                    {projects.map(p => (
                      <button
                        key={p.slug}
                        onClick={() => { selectProject(p); setShowProject(false); }}
                        data-testid={`project-option-${p.slug}`}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-left transition-colors ${
                          selectedProject?.slug === p.slug
                            ? 'bg-[#4ECDC4]/10 text-[#1D1D1F] font-medium'
                            : 'text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
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
                <NavItem key={item.id} item={item} activeTab={activeTab} selectedProject={selectedProject} onSelect={onSelectTab} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>

    {/* User card */}
    <div className="shrink-0 border-t border-[#D2D2D7] p-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="w-8 h-8 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#1D1D1F] truncate leading-tight">{displayName}</p>
          <p className="text-[11px] text-[#A1A1A6] leading-tight">
            {user?.is_super_admin ? 'Super Admin' : 'Admin'}
          </p>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          data-testid="logout-button"
          className="p-1.5 text-[#A1A1A6] hover:text-red-500 transition-colors shrink-0"
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

  const onSelectTab = (id) => { setActiveTab(id); setMobileOpen(false); };

  const sidebarProps = {
    hasPermission, user, projects, selectedProject, selectProject,
    showProject, setShowProject, projectDropRef, activeTab, onSelectTab,
    displayName, initials, logout,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#F5F5F7] overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex shrink-0 w-[240px] h-full">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 h-full shadow-2xl">
            <SidebarContent {...sidebarProps} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-14 shrink-0 bg-white border-b border-[#D2D2D7] flex items-center px-5 gap-4 z-20">
          {/* Mobile burger */}
          <button
            className="lg:hidden p-2 -ml-1 text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          {/* Mobile brand */}
          <span className="lg:hidden text-[14.5px] font-bold tracking-tight text-[#1D1D1F]">
            Vakar Games
          </span>

          {/* Breadcrumb (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm text-[#A1A1A6]">
              {currentGroup?.label || 'Dashboard'}
            </span>
            {currentItem && currentGroup && (
              <>
                <ChevronRight size={13} className="text-[#BFBFC4]" />
                <span className="text-sm font-semibold text-[#1D1D1F]">{currentItem.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] px-3 py-2 transition-all"
            >
              <Home size={12} />
              View site
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
                {initials}
              </div>
              <span className="hidden md:block text-[13px] font-semibold text-[#1D1D1F]">{displayName}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8">

            {activeTab === 'overview' && <DashboardOverview setActiveTab={setActiveTab} />}
            {activeTab === 'projects' && <ProjectManagement />}
            {activeTab === 'users'    && hasPermission('manage_users')  && <UserManagement />}
            {activeTab === 'vps'      && hasPermission('view_vps')      && <VpsStats />}
            {activeTab === 'cli'      && user?.is_super_admin           && <CliConsole />}

            {needsProject && !selectedProject && (
              <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
                <div className="w-14 h-14 rounded-xl bg-white border border-[#D2D2D7] flex items-center justify-center mb-5">
                  <Gamepad2 size={22} className="text-[#BFBFC4]" />
                </div>
                <p className="text-[11px] font-semibold text-[#A1A1A6] mb-2">
                  No project selected
                </p>
                <h3 className="text-lg font-bold text-[#1D1D1F] mb-2">Select a Project</h3>
                <p className="text-sm text-[#6E6E73] mb-6 leading-relaxed">
                  Choose a project from the sidebar to access its data.
                </p>
                <button
                  onClick={() => setActiveTab('projects')}
                  data-testid="go-to-projects-button"
                  className="inline-flex items-center gap-2 rounded-full bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                >
                  View Projects <ArrowRight size={14} />
                </button>
              </div>
            )}

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
