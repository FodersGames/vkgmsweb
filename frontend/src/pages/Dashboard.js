import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Link } from 'react-router-dom';
import {
  Users, Package, Activity, FileText, Database, LogOut, Code,
  Gamepad2, ChevronDown, Check, Globe, Settings, PenTool,
  MessageSquare, Menu, X, ShoppingBag, ClipboardList, LayoutDashboard, ArrowRight, Home,
} from 'lucide-react';
import { UserManagement } from '../components/UserManagement';
import { SendItems } from '../components/SendItems';
import { ServerStatus } from '../components/ServerStatus';
import { LogsViewer } from '../components/LogsViewer';
import { VariablesManagement } from '../components/VariablesManagement';
import { ApiEndpoints } from '../components/ApiEndpoints';
import { DashboardOverview } from '../components/DashboardOverview';
import { ProjectManagement } from '../components/ProjectManagement';
import { GamesManagement } from '../components/GamesManagement';
import { BlogManagement } from '../components/BlogManagement';
import { ChatManagement } from '../components/ChatManagement';
import { WebsiteSettings } from '../components/WebsiteSettings';
import { ShopManagement } from '../components/ShopManagement';
import { MissionsManagement } from '../components/MissionsManagement';

const NAV_GROUPS = [
  {
    label: 'General',
    items: [
      { id: 'overview',  label: 'Overview',  icon: LayoutDashboard, permission: null },
      { id: 'projects',  label: 'Projects',  icon: Gamepad2,        permission: 'view_projects' },
      { id: 'users',     label: 'Users',     icon: Users,            permission: 'manage_users' },
      { id: 'api',       label: 'API Docs',  icon: Code,             permission: 'view_api_docs' },
    ],
  },
  {
    label: 'Project',
    requiresProject: true,
    items: [
      { id: 'send-items', label: 'Send Items',    icon: Package,       permission: 'send_items' },
      { id: 'status',     label: 'Server Status', icon: Activity,      permission: 'change_status' },
      { id: 'variables',  label: 'Variables',     icon: Database,      permission: 'view_variables' },
      { id: 'logs',       label: 'Logs',          icon: FileText,      permission: 'view_logs' },
      { id: 'chat',       label: 'Chat',          icon: MessageSquare, permission: 'manage_chat' },
      { id: 'missions',   label: 'Missions',      icon: ClipboardList, permission: 'claim_missions' },
    ],
  },
  {
    label: 'Website',
    items: [
      { id: 'website-games',    label: 'Games',    icon: Gamepad2,     permission: 'create_games' },
      { id: 'website-blog',     label: 'Blog',     icon: PenTool,      permission: 'create_blog' },
      { id: 'website-settings', label: 'Settings', icon: Settings,     permission: 'manage_website' },
      { id: 'website-shop',     label: 'Shop',     icon: ShoppingBag,  permission: 'manage_shop' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();
  const [activeTab, setActiveTab] = useState('overview');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const projectTabs = ['send-items', 'status', 'variables', 'logs', 'chat', 'missions'];
  const needsProject = projectTabs.includes(activeTab);

  const currentItem = ALL_ITEMS.find(i => i.id === activeTab) || ALL_ITEMS[0];

  const isVisible = (item) => {
    if (item.permission === null) return true;
    return hasPermission(item.permission);
  };

  const NavItem = ({ item }) => {
    if (!isVisible(item)) return null;
    const isActive = activeTab === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
          isActive
            ? 'bg-[#1C1917] text-white font-semibold'
            : 'text-[#78716C] hover:text-[#1C1917] hover:bg-[#F9F7F4]'
        }`}
        data-testid={`sidebar-nav-${item.id}`}
      >
        <Icon size={13} className={isActive ? 'text-white' : 'text-[#A8A29E]'} />
        {item.label}
      </button>
    );
  };

  const initials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase()
    || user?.username?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="flex h-screen bg-[#F9F7F4]">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-[#1C1917]/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-56 shrink-0 bg-white border-r border-[#E8E3DB] flex flex-col transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Brand */}
        <div className="px-4 py-5 border-b border-[#E8E3DB]">
          <div className="flex items-center justify-between">
            <span
              className="text-base font-black tracking-[0.14em] text-[#1C1917]"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              VAKAR GAMES
            </span>
            <button className="md:hidden p-1 text-[#78716C] hover:text-[#1C1917]" onClick={() => setSidebarOpen(false)}>
              <X size={15} />
            </button>
          </div>

          {/* User */}
          <div className="flex items-center gap-2.5 mt-4">
            <div className="w-7 h-7 bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#1C1917] truncate">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username}
              </p>
              <p className="text-[10px] text-[#A8A29E]">
                {user?.is_super_admin ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
        </div>

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase px-1 mb-1.5">
              Active Project
            </p>
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full flex items-center gap-2 px-3 py-2 border border-[#E8E3DB] hover:border-[#C9C3BB] text-xs text-left transition-colors bg-[#F9F7F4]"
                data-testid="project-selector"
              >
                <Gamepad2 size={11} className="text-[#4ECDC4] shrink-0" />
                <span className="flex-1 truncate text-[#1C1917] font-medium">
                  {selectedProject?.name || 'Select a project'}
                </span>
                <ChevronDown size={11} className={`text-[#A8A29E] transition-transform shrink-0 ${showProjectDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showProjectDropdown && (
                <div
                  className="absolute z-50 left-0 right-0 mt-0.5 bg-white border border-[#E8E3DB] shadow-md overflow-hidden"
                  data-testid="project-dropdown"
                >
                  {projects.map(p => (
                    <button
                      key={p.slug}
                      onClick={() => { selectProject(p); setShowProjectDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors ${
                        selectedProject?.slug === p.slug
                          ? 'bg-[#1C1917] text-white'
                          : 'text-[#78716C] hover:bg-[#F9F7F4] hover:text-[#1C1917]'
                      }`}
                      data-testid={`project-option-${p.slug}`}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      {selectedProject?.slug === p.slug && <Check size={11} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto" data-testid="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(isVisible);
            const showGroup = visibleItems.length > 0 &&
              (!group.requiresProject || (selectedProject && visibleItems.some(i => hasPermission(i.permission))));
            if (!showGroup) return null;
            return (
              <div key={group.label} className="mb-1">
                <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase px-4 py-2">
                  {group.label}
                </p>
                {visibleItems.map(item => <NavItem key={item.id} item={item} />)}
              </div>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-[#E8E3DB] p-3 space-y-0.5">
          <Link
            to="/"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#78716C] hover:text-[#1C1917] hover:bg-[#F9F7F4] transition-colors"
          >
            <Home size={13} className="text-[#A8A29E]" />
            Back to site
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#78716C] hover:text-red-500 hover:bg-red-50 transition-colors"
            data-testid="logout-button"
          >
            <LogOut size={13} className="text-[#A8A29E]" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 min-w-0 overflow-y-auto flex flex-col"
        onClick={() => showProjectDropdown && setShowProjectDropdown(false)}
      >
        {/* Header */}
        <header className="bg-white border-b border-[#E8E3DB] px-4 md:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3 h-12">
            <button
              className="md:hidden p-1.5 text-[#78716C] hover:text-[#1C1917] transition-colors"
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
            >
              <Menu size={17} />
            </button>
            {currentItem && (
              <>
                <currentItem.icon size={13} className="text-[#A8A29E]" />
                <span className="text-sm font-semibold text-[#1C1917]">{currentItem.label}</span>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="p-6 md:p-8 flex-1">

          {activeTab === 'overview' && <DashboardOverview setActiveTab={setActiveTab} />}
          {activeTab === 'projects' && <ProjectManagement />}
          {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
          {activeTab === 'api' && hasPermission('view_api_docs') && <ApiEndpoints />}

          {needsProject && !selectedProject && (
            <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 bg-[#F9F7F4] border border-[#E8E3DB] flex items-center justify-center mb-5">
                <Gamepad2 size={20} className="text-[#C9C3BB]" />
              </div>
              <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-2">No project selected</p>
              <h3 className="text-lg font-bold text-[#1C1917] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                SELECT A PROJECT
              </h3>
              <p className="text-sm text-[#78716C] mb-6 leading-relaxed">
                Choose a project from the sidebar to access its data, logs, and settings.
              </p>
              <button
                onClick={() => setActiveTab('projects')}
                className="inline-flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                data-testid="go-to-projects-button"
              >
                View Projects <ArrowRight size={13} />
              </button>
            </div>
          )}

          {activeTab === 'send-items' && selectedProject && hasPermission('send_items') && <SendItems />}
          {activeTab === 'status' && selectedProject && hasPermission('change_status') && <ServerStatus />}
          {activeTab === 'variables' && selectedProject && hasPermission('view_variables') && <VariablesManagement />}
          {activeTab === 'logs' && selectedProject && hasPermission('view_logs') && <LogsViewer />}
          {activeTab === 'chat' && selectedProject && hasPermission('manage_chat') && <ChatManagement />}
          {activeTab === 'missions' && selectedProject && (hasPermission('claim_missions') || hasPermission('create_missions')) && <MissionsManagement />}

          {activeTab === 'website-games' && <GamesManagement />}
          {activeTab === 'website-blog' && <BlogManagement />}
          {activeTab === 'website-settings' && <WebsiteSettings />}
          {activeTab === 'website-shop' && hasPermission('manage_shop') && <ShopManagement />}
        </div>
      </main>
    </div>
  );
};

export const Dashboard = () => (
  <ProjectProvider>
    <DashboardContent />
  </ProjectProvider>
);
