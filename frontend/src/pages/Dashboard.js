import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { useTheme } from '../context/ThemeContext';
import {
  Users, Package, Activity, FileText, Database, LogOut, Code,
  Gamepad2, ChevronDown, Check, Globe, Settings, PenTool,
  MessageSquare, Sun, Moon, Menu, X, ShoppingBag, ClipboardList,
} from 'lucide-react';
import { UserManagement } from '../components/UserManagement';
import { SendItems } from '../components/SendItems';
import { ServerStatus } from '../components/ServerStatus';
import { LogsViewer } from '../components/LogsViewer';
import { VariablesManagement } from '../components/VariablesManagement';
import { ApiEndpoints } from '../components/ApiEndpoints';
import { ProjectManagement } from '../components/ProjectManagement';
import { GamesManagement } from '../components/GamesManagement';
import { BlogManagement } from '../components/BlogManagement';
import { ChatManagement } from '../components/ChatManagement';
import { WebsiteSettings } from '../components/WebsiteSettings';
import { ShopManagement } from '../components/ShopManagement';
import { MissionsManagement } from '../components/MissionsManagement';

const tabConfig = {
  'projects':        { gradient: 'from-[#6C5CE7] to-[#A29BFE]', text: '#A29BFE' },
  'send-items':      { gradient: 'from-[#F2994A] to-[#EB5757]',  text: '#F2994A' },
  'status':          { gradient: 'from-[#4ECDC4] to-[#2CB5AC]',  text: '#4ECDC4' },
  'variables':       { gradient: 'from-[#2F80ED] to-[#2D9CDB]',  text: '#2F80ED' },
  'logs':            { gradient: 'from-[#9B51E0] to-[#BB6BD9]',  text: '#9B51E0' },
  'chat':            { gradient: 'from-[#9B51E0] to-[#BB6BD9]',  text: '#9B51E0' },
  'missions':        { gradient: 'from-[#6C5CE7] to-[#A29BFE]',  text: '#6C5CE7' },
  'users':           { gradient: 'from-[#F2994A] to-[#F2C94C]',  text: '#F2C94C' },
  'api':             { gradient: 'from-[#71717a] to-[#52525b]',   text: '#71717a' },
  'website-games':   { gradient: 'from-[#4ECDC4] to-[#2CB5AC]',  text: '#4ECDC4' },
  'website-blog':    { gradient: 'from-[#F2994A] to-[#EB5757]',  text: '#F2994A' },
  'website-settings':{ gradient: 'from-[#71717a] to-[#52525b]',  text: '#71717a' },
  'website-shop':    { gradient: 'from-[#6C5CE7] to-[#A29BFE]',  text: '#6C5CE7' },
};

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('projects');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (hasPermission('view_projects')) setActiveTab('projects');
    else if (hasPermission('send_items')) setActiveTab('send-items');
    else if (hasPermission('manage_users')) setActiveTab('users');
    // eslint-disable-next-line
  }, [user]);

  const projectTabs = ['send-items', 'status', 'variables', 'logs', 'chat', 'missions'];
  const needsProject = projectTabs.includes(activeTab);

  const generalItems = [
    { id: 'projects',  label: 'Projects',  icon: Gamepad2,      permission: 'view_projects' },
    { id: 'users',     label: 'Users',     icon: Users,          permission: 'manage_users' },
    { id: 'api',       label: 'API Docs',  icon: Code,           permission: 'view_api_docs' },
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
    const colors = tabConfig[item.id] || tabConfig['projects'];
    if (!hasPermission(item.permission)) return null;
    return (
      <button
        key={item.id}
        onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
        className={`relative w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
          isActive
            ? 'bg-zinc-100 dark:bg-[#1c1c2e] font-semibold'
            : 'text-zinc-500 dark:text-[#71717a] hover:bg-zinc-50 dark:hover:bg-[#1c1c2e]/60 hover:text-zinc-800 dark:hover:text-[#e4e4e7]'
        }`}
        style={isActive ? { color: colors.text } : {}}
        data-testid={`sidebar-nav-${item.id}`}
      >
        {isActive && (
          <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-gradient-to-b ${colors.gradient}`} />
        )}
        <Icon size={15} className={isActive ? '' : 'text-zinc-400 dark:text-[#52525b]'} />
        {item.label}
      </button>
    );
  };

  const currentLabel = allItems.find(i => i.id === activeTab)?.label || 'Dashboard';
  const CurrentIcon = allItems.find(i => i.id === activeTab)?.icon || Package;

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-[#0d0d14]">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-56 shrink-0 bg-white dark:bg-[#111118] border-r border-zinc-200 dark:border-[#2a2a3c] flex flex-col transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Brand + user */}
        <div className="px-4 py-4 border-b border-zinc-200 dark:border-[#2a2a3c]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4ECDC4] to-[#2CB5AC] flex items-center justify-center shrink-0">
                <Globe size={14} className="text-white" />
              </div>
              <span
                className="text-sm font-black tracking-[0.12em] text-zinc-900 dark:text-[#e4e4e7]"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                VAKAR GAMES
              </span>
            </div>
            <button
              className="md:hidden p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#4ECDC4]/20 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4] shrink-0">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-800 dark:text-[#e4e4e7] truncate">{user?.username}</p>
              {user?.is_super_admin
                ? <p className="text-[10px] text-[#4ECDC4]">Super Admin</p>
                : <p className="text-[10px] text-zinc-400 dark:text-[#71717a]">Admin</p>
              }
            </div>
          </div>
        </div>

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <div className="text-[10px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest px-1 mb-1.5">Active Project</div>
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg text-xs text-left hover:border-[#4ECDC4]/40 transition-all"
                data-testid="project-selector"
              >
                <Gamepad2 size={12} className="text-[#4ECDC4] shrink-0" />
                <span className="flex-1 truncate text-zinc-700 dark:text-[#e4e4e7] font-medium">
                  {selectedProject?.name || 'Select a project'}
                </span>
                <ChevronDown size={12} className={`text-zinc-400 dark:text-[#71717a] transition-transform shrink-0 ${showProjectDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showProjectDropdown && (
                <div
                  className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg shadow-xl overflow-hidden"
                  data-testid="project-dropdown"
                >
                  {projects.map(p => (
                    <button
                      key={p.slug}
                      onClick={() => { selectProject(p); setShowProjectDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-all ${
                        selectedProject?.slug === p.slug
                          ? 'bg-[#4ECDC4]/5 text-[#4ECDC4]'
                          : 'text-zinc-700 dark:text-[#e4e4e7] hover:bg-zinc-50 dark:hover:bg-[#2a2a3c]'
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
          <div className="text-[10px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest px-3 pb-1.5">General</div>
          {generalItems.map(renderTab)}

          {selectedProject && projectItems.some(i => hasPermission(i.permission)) && (
            <>
              <div className="text-[10px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest px-3 pt-4 pb-1.5">Project Tools</div>
              {projectItems.map(renderTab)}
            </>
          )}

          {websiteItems.some(i => hasPermission(i.permission)) && (
            <>
              <div className="text-[10px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest px-3 pt-4 pb-1.5">Website</div>
              {websiteItems.map(renderTab)}
            </>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-zinc-200 dark:border-[#2a2a3c] p-2 space-y-0.5">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-500 dark:text-[#71717a] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-all"
            data-testid="logout-button"
          >
            <LogOut size={14} />
            Sign Out
          </button>
          <div className="px-3 pt-1 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" />
            <span className="text-[10px] font-mono text-zinc-400 dark:text-[#71717a]">v1.3.0</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main
        className="flex-1 min-w-0 overflow-y-auto flex flex-col"
        onClick={() => { showProjectDropdown && setShowProjectDropdown(false); }}
      >
        {/* Top header */}
        <header className="bg-white/90 dark:bg-[#111118]/90 backdrop-blur-md border-b border-zinc-200 dark:border-[#2a2a3c] px-4 md:px-6 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#1c1c2e] hover:text-zinc-900 dark:hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
              >
                <Menu size={18} />
              </button>
              <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${tabConfig[activeTab]?.gradient || 'from-[#4ECDC4] to-[#2CB5AC]'} flex items-center justify-center shrink-0`}>
                <CurrentIcon size={13} className="text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-[#e4e4e7] leading-tight truncate">{currentLabel}</h2>
                {needsProject && selectedProject && (
                  <p className="text-[11px] text-zinc-400 dark:text-[#71717a] truncate">{selectedProject.name}</p>
                )}
              </div>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-[#2a2a3c] text-zinc-500 dark:text-[#71717a] hover:border-[#4ECDC4]/50 hover:text-[#4ECDC4] transition-all text-xs font-medium shrink-0"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 md:p-6 flex-1">
          {activeTab === 'projects' && <ProjectManagement />}
          {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
          {activeTab === 'api' && hasPermission('view_api_docs') && <ApiEndpoints />}

          {needsProject && !selectedProject && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#4ECDC4]/10 flex items-center justify-center mb-4">
                <Gamepad2 size={24} className="text-[#4ECDC4]/50" />
              </div>
              <h3 className="text-base font-semibold text-zinc-800 dark:text-[#e4e4e7] mb-2">No project selected</h3>
              <p className="text-sm text-zinc-400 dark:text-[#71717a] mb-5">Select or create a project to manage its data.</p>
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
