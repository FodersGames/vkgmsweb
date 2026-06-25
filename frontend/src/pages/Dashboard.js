import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { useTheme } from '../context/ThemeContext';
import {
  Users, Package, Activity, FileText, Database, LogOut, Code,
  Gamepad2, ChevronDown, Check, Globe, Settings, PenTool,
  MessageSquare, Sun, Moon, Menu, X, ShoppingBag, ClipboardList,
  LayoutDashboard,
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

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const projectTabs = ['send-items', 'status', 'variables', 'logs', 'chat', 'missions'];
  const needsProject = projectTabs.includes(activeTab);

  const generalItems = [
    { id: 'overview',  label: 'Overview',  icon: LayoutDashboard, permission: null },
    { id: 'projects',  label: 'Projects',  icon: Gamepad2,        permission: 'view_projects' },
    { id: 'users',     label: 'Users',     icon: Users,            permission: 'manage_users' },
    { id: 'api',       label: 'API Docs',  icon: Code,             permission: 'view_api_docs' },
  ];

  const projectItems = [
    { id: 'send-items', label: 'Send Items',    icon: Package,       permission: 'send_items' },
    { id: 'status',     label: 'Server Status', icon: Activity,      permission: 'change_status' },
    { id: 'variables',  label: 'Variables',     icon: Database,      permission: 'view_variables' },
    { id: 'logs',       label: 'Logs',          icon: FileText,      permission: 'view_logs' },
    { id: 'chat',       label: 'Chat',          icon: MessageSquare, permission: 'manage_chat' },
    { id: 'missions',   label: 'Missions',      icon: ClipboardList, permission: 'claim_missions' },
  ];

  const websiteItems = [
    { id: 'website-games',    label: 'Games',    icon: Gamepad2,     permission: 'create_games' },
    { id: 'website-blog',     label: 'Blog',     icon: PenTool,      permission: 'create_blog' },
    { id: 'website-settings', label: 'Settings', icon: Settings,     permission: 'manage_website' },
    { id: 'website-shop',     label: 'Shop',     icon: ShoppingBag,  permission: 'manage_shop' },
  ];

  const allItems = [...generalItems, ...projectItems, ...websiteItems];

  const renderTab = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    if (item.permission !== null && !hasPermission(item.permission)) return null;
    return (
      <button
        key={item.id}
        onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
        className={`relative w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
          isActive
            ? 'bg-[#4ECDC4]/10 text-[#4ECDC4] font-semibold'
            : 'text-[#78716C] hover:bg-[#292524] hover:text-[#A8A29E]'
        }`}
        data-testid={`sidebar-nav-${item.id}`}
      >
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-[#4ECDC4]" />
        )}
        <Icon size={15} className={isActive ? 'text-[#4ECDC4]' : 'text-[#57534E]'} />
        {item.label}
      </button>
    );
  };

  const currentLabel = allItems.find(i => i.id === activeTab)?.label || 'Dashboard';
  const CurrentIcon = allItems.find(i => i.id === activeTab)?.icon || Package;

  return (
    <div className="flex h-screen bg-[#F9F7F4] dark:bg-[#0d0d14]">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always dark */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-56 shrink-0 bg-[#1C1917] border-r border-[#292524] flex flex-col transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Brand + user */}
        <div className="px-4 py-4 border-b border-[#292524]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#4ECDC4]/15 flex items-center justify-center shrink-0">
                <Globe size={13} className="text-[#4ECDC4]" />
              </div>
              <span
                className="text-sm font-black tracking-[0.12em] text-white"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                VAKAR GAMES
              </span>
            </div>
            <button
              className="md:hidden p-1 rounded text-[#57534E] hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
              {((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username}
              </p>
              {user?.is_super_admin
                ? <p className="text-[10px] text-[#4ECDC4]">Super Admin</p>
                : <p className="text-[10px] text-[#57534E]">Admin</p>
              }
            </div>
          </div>
        </div>

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <div className="text-[10px] font-semibold text-[#57534E] uppercase tracking-widest px-1 mb-1.5">
              Active Project
            </div>
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-[#292524] border border-[#3D3934] rounded-lg text-xs text-left hover:border-[#4ECDC4]/30 transition-all"
                data-testid="project-selector"
              >
                <Gamepad2 size={12} className="text-[#4ECDC4] shrink-0" />
                <span className="flex-1 truncate text-white font-medium">
                  {selectedProject?.name || 'Select a project'}
                </span>
                <ChevronDown size={12} className={`text-[#57534E] transition-transform shrink-0 ${showProjectDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showProjectDropdown && (
                <div
                  className="absolute z-50 left-0 right-0 mt-1 bg-[#292524] border border-[#3D3934] rounded-lg shadow-xl overflow-hidden"
                  data-testid="project-dropdown"
                >
                  {projects.map(p => (
                    <button
                      key={p.slug}
                      onClick={() => { selectProject(p); setShowProjectDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-all ${
                        selectedProject?.slug === p.slug
                          ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]'
                          : 'text-[#A8A29E] hover:bg-[#3D3934] hover:text-white'
                      }`}
                      data-testid={`project-option-${p.slug}`}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      {selectedProject?.slug === p.slug && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto" data-testid="sidebar-nav">
          <div className="text-[10px] font-semibold text-[#57534E] uppercase tracking-widest px-3 pb-1.5">
            General
          </div>
          {generalItems.map(renderTab)}

          {selectedProject && projectItems.some(i => hasPermission(i.permission)) && (
            <>
              <div className="text-[10px] font-semibold text-[#57534E] uppercase tracking-widest px-3 pt-4 pb-1.5">
                Project
              </div>
              {projectItems.map(renderTab)}
            </>
          )}

          {websiteItems.some(i => hasPermission(i.permission)) && (
            <>
              <div className="text-[10px] font-semibold text-[#57534E] uppercase tracking-widest px-3 pt-4 pb-1.5">
                Website
              </div>
              {websiteItems.map(renderTab)}
            </>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-[#292524] p-2 space-y-0.5">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#78716C] hover:bg-red-950/40 hover:text-red-400 rounded-lg transition-all"
            data-testid="logout-button"
          >
            <LogOut size={14} />
            Sign Out
          </button>
          <div className="px-3 pt-1 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" />
            <span className="text-[10px] font-mono text-[#44403C]">v1.3.0</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main
        className="flex-1 min-w-0 overflow-y-auto flex flex-col"
        onClick={() => { showProjectDropdown && setShowProjectDropdown(false); }}
      >
        {/* Top header */}
        <header className="bg-white dark:bg-[#111118] border-b border-[#E8E3DB] dark:border-[#2a2a3c] px-4 md:px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden p-1.5 rounded-lg text-[#78716C] hover:bg-[#F9F7F4] dark:hover:bg-[#1c1c2e] hover:text-[#1C1917] dark:hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
              >
                <Menu size={18} />
              </button>
              <div className="w-7 h-7 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                <CurrentIcon size={13} className="text-[#4ECDC4]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#1C1917] dark:text-[#e4e4e7] leading-tight truncate">
                  {currentLabel}
                </h2>
                {needsProject && selectedProject && (
                  <p className="text-[11px] text-[#78716C] dark:text-[#71717a] truncate">
                    {selectedProject.name}
                  </p>
                )}
              </div>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E3DB] dark:border-[#2a2a3c] text-[#78716C] dark:text-[#71717a] hover:border-[#4ECDC4]/50 hover:text-[#4ECDC4] transition-all text-xs font-medium shrink-0"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 md:p-6 flex-1">
          {activeTab === 'overview' && <DashboardOverview setActiveTab={setActiveTab} />}
          {activeTab === 'projects' && <ProjectManagement />}
          {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
          {activeTab === 'api' && hasPermission('view_api_docs') && <ApiEndpoints />}

          {needsProject && !selectedProject && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#4ECDC4]/10 border border-[#4ECDC4]/15 flex items-center justify-center mb-4">
                <Gamepad2 size={22} className="text-[#4ECDC4]/60" />
              </div>
              <h3 className="text-base font-semibold text-[#1C1917] dark:text-[#e4e4e7] mb-2">
                No project selected
              </h3>
              <p className="text-sm text-[#78716C] dark:text-[#71717a] mb-5">
                Select or create a project to manage its data.
              </p>
              <button
                onClick={() => setActiveTab('projects')}
                className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
                data-testid="go-to-projects-button"
              >
                Go to Projects
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
