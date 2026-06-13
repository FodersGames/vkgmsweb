import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import {
  Users, Package, Activity, FileText, Database, LogOut,
  Code, Gamepad2, ChevronDown, Check, Globe, Settings,
  PenTool, Menu, X, ChevronRight
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
import { WebsiteSettings } from '../components/WebsiteSettings';

/* ── Tab accent colors (Azure-mapped) ── */
const tabColors = {
  'projects':         { dot: '#0078D4', bg: '#EFF6FC', text: '#0078D4', border: '#C7E0F4' },
  'send-items':       { dot: '#D83B01', bg: '#FDE7E9', text: '#D83B01', border: '#F4BDB9' },
  'status':           { dot: '#107C10', bg: '#DFF6DD', text: '#107C10', border: '#A8D8A8' },
  'variables':        { dot: '#0078D4', bg: '#EFF6FC', text: '#0078D4', border: '#C7E0F4' },
  'logs':             { dot: '#7719AA', bg: '#F0E6FA', text: '#7719AA', border: '#D4A8EE' },
  'users':            { dot: '#D83B01', bg: '#FDE7E9', text: '#D83B01', border: '#F4BDB9' },
  'api':              { dot: '#605E5C', bg: '#F3F2F1', text: '#605E5C', border: '#E1DFDD' },
  'website-games':    { dot: '#107C10', bg: '#DFF6DD', text: '#107C10', border: '#A8D8A8' },
  'website-blog':     { dot: '#D83B01', bg: '#FDE7E9', text: '#D83B01', border: '#F4BDB9' },
  'website-settings': { dot: '#605E5C', bg: '#F3F2F1', text: '#605E5C', border: '#E1DFDD' },
};

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();
  const [activeTab, setActiveTab] = useState('projects');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  useEffect(() => {
    if (hasPermission('view_projects')) setActiveTab('projects');
    else if (hasPermission('send_items')) setActiveTab('send-items');
    else if (hasPermission('manage_users')) setActiveTab('users');
    // eslint-disable-next-line
  }, [user]);

  const projectTabs = ['send-items', 'status', 'variables', 'logs'];
  const needsProject = projectTabs.includes(activeTab);

  const generalItems = [
    { id: 'projects',  label: 'Projects',  icon: Gamepad2, permission: 'view_projects' },
    { id: 'users',     label: 'Users',     icon: Users,    permission: 'manage_users' },
    { id: 'api',       label: 'API Docs',  icon: Code,     permission: 'view_api_docs' },
  ];
  const projectItems = [
    { id: 'send-items', label: 'Send Items',     icon: Package,  permission: 'send_items' },
    { id: 'status',     label: 'Server Status',  icon: Activity, permission: 'change_status' },
    { id: 'variables',  label: 'Variables',      icon: Database, permission: 'view_variables' },
    { id: 'logs',       label: 'Logs',           icon: FileText, permission: 'view_logs' },
  ];
  const websiteItems = [
    { id: 'website-games',    label: 'Games',    icon: Gamepad2, permission: 'create_games' },
    { id: 'website-blog',     label: 'Blog',     icon: PenTool,  permission: 'create_blog' },
    { id: 'website-settings', label: 'Settings', icon: Settings, permission: 'manage_website' },
  ];

  const allItems = [...generalItems, ...projectItems, ...websiteItems];
  const currentItem = allItems.find(i => i.id === activeTab);
  const CurrentIcon = currentItem?.icon || Package;
  const currentLabel = currentItem?.label || 'Dashboard';
  const colors = tabColors[activeTab] || tabColors['projects'];

  const handleTabClick = (id) => {
    setActiveTab(id);
    setMobileSidebar(false);
  };

  const renderNavItem = (item) => {
    if (!hasPermission(item.permission)) return null;
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const c = tabColors[item.id] || tabColors['projects'];
    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-[0.8125rem] transition-all rounded-sm font-body
          ${isActive
            ? 'bg-[#EFF6FC] text-[#0078D4] font-medium border-l-2 border-[#0078D4]'
            : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#201F1E] border-l-2 border-transparent'
          }`}
        data-testid={`sidebar-nav-${item.id}`}
      >
        <div className={`w-6 h-6 rounded-sm flex items-center justify-center flex-shrink-0 ${
          isActive ? 'bg-[#0078D4]' : 'bg-[#F3F2F1]'
        }`}>
          <Icon size={13} className={isActive ? 'text-white' : 'text-[#A19F9D]'} />
        </div>
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <ChevronRight size={12} className="text-[#0078D4] opacity-60" />}
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[#E1DFDD]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex-shrink-0" style={{ perspective: '60px' }}>
            <div style={{
              width:'100%', height:'100%',
              background:'linear-gradient(135deg,#0078D4 0%,#40A9FF 100%)',
              borderRadius:'2px',
              transform:'rotateX(10deg) rotateY(-12deg)',
              boxShadow:'2px 3px 0px #005A9E, 0 1px 6px rgba(0,120,212,0.2)',
            }}/>
          </div>
          <span className="text-sm font-bold text-[#201F1E] tracking-tight font-display">VAKAR GAMES</span>
        </div>
        {/* User badge */}
        <div className="mt-3 flex items-center gap-2.5 px-3 py-2 bg-[#F8F8F8] border border-[#E1DFDD] rounded-sm">
          <div className="w-6 h-6 rounded-sm bg-[#0078D4] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 font-display">
            {user?.username?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#201F1E] truncate font-body">{user?.username}</p>
            {user?.is_super_admin && <p className="text-[10px] text-[#0078D4]">Super Admin</p>}
          </div>
        </div>
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-semibold text-[#A19F9D] uppercase tracking-widest px-1 mb-1.5">Active Project</p>
          <div className="relative">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-[#E1DFDD] rounded-sm text-xs text-left hover:border-[#0078D4] hover:bg-[#EFF6FC] transition-all font-body"
              data-testid="project-selector"
            >
              <div className="w-4 h-4 bg-[#0078D4] rounded-sm flex items-center justify-center flex-shrink-0">
                <Gamepad2 size={10} className="text-white" />
              </div>
              <span className="flex-1 truncate text-[#201F1E]">{selectedProject?.name || 'Select project'}</span>
              <ChevronDown size={12} className={`text-[#A19F9D] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showProjectDropdown && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#E1DFDD] rounded-sm shadow-lg overflow-hidden" data-testid="project-dropdown">
                {projects.map(p => (
                  <button
                    key={p.slug}
                    onClick={() => { selectProject(p); setShowProjectDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-[#F3F2F1] transition-all font-body border-b border-[#E1DFDD] last:border-0
                      ${selectedProject?.slug === p.slug ? 'bg-[#EFF6FC] text-[#0078D4]' : 'text-[#201F1E]'}`}
                    data-testid={`project-option-${p.slug}`}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    {selectedProject?.slug === p.slug && <Check size={12} className="text-[#0078D4]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5" data-testid="sidebar-nav">
        <p className="text-[10px] font-semibold text-[#A19F9D] uppercase tracking-widest px-3 pt-3 pb-1.5">General</p>
        {generalItems.map(renderNavItem)}

        {selectedProject && projectItems.some(i => hasPermission(i.permission)) && (
          <>
            <p className="text-[10px] font-semibold text-[#A19F9D] uppercase tracking-widest px-3 pt-5 pb-1.5">Project Tools</p>
            {projectItems.map(renderNavItem)}
          </>
        )}

        {websiteItems.some(i => hasPermission(i.permission)) && (
          <>
            <p className="text-[10px] font-semibold text-[#A19F9D] uppercase tracking-widest px-3 pt-5 pb-1.5">Website</p>
            {websiteItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#E1DFDD] p-4">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-[0.8125rem] text-[#605E5C] hover:bg-[#FDE7E9] hover:text-[#A4262C] rounded-sm transition-all font-body border-l-2 border-transparent hover:border-[#A4262C]"
          data-testid="logout-button"
        >
          <div className="w-6 h-6 rounded-sm bg-[#F3F2F1] flex items-center justify-center">
            <LogOut size={13} className="text-[#A19F9D]" />
          </div>
          Sign Out
        </button>
        <div className="mt-3 px-3">
          <span className="text-[10px] font-mono text-[#A19F9D] flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#107C10]" />
            v1.3.0 — Connected
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8F8F8] font-body" onClick={() => showProjectDropdown && setShowProjectDropdown(false)}>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-[#E1DFDD] flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-60 bg-white border-r border-[#E1DFDD] flex flex-col">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileSidebar(false)} />
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-[#E1DFDD] px-6 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-1.5 text-[#605E5C] hover:bg-[#F3F2F1] rounded-sm"
              onClick={() => setMobileSidebar(true)}
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb-style header */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center flex-shrink-0"
                style={{ background: colors.dot }}
              >
                <CurrentIcon size={13} className="text-white" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-[#A19F9D] hidden sm:block">Dashboard</span>
                <ChevronRight size={12} className="text-[#C8C6C4] hidden sm:block" />
                <span className="text-sm font-semibold text-[#201F1E] truncate font-display">{currentLabel}</span>
                {needsProject && selectedProject && (
                  <>
                    <ChevronRight size={12} className="text-[#C8C6C4]" />
                    <span className="text-xs text-[#605E5C] truncate">{selectedProject.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Status pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-[#E1DFDD] rounded-sm bg-[#F8F8F8]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.dot }} />
              <span className="text-[10px] font-mono text-[#A19F9D]">{currentLabel}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'projects' && <ProjectManagement />}
          {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
          {activeTab === 'api' && hasPermission('view_api_docs') && <ApiEndpoints />}

          {needsProject && !selectedProject && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 bg-[#EFF6FC] border border-[#C7E0F4] rounded-sm flex items-center justify-center mb-5">
                <Gamepad2 size={24} className="text-[#0078D4]" />
              </div>
              <h3 className="text-base font-semibold text-[#201F1E] mb-2 font-display">No project selected</h3>
              <p className="text-sm text-[#605E5C] mb-5 max-w-sm">Select or create a project to manage its server status, variables, logs, and items.</p>
              <button
                onClick={() => setActiveTab('projects')}
                className="az-btn-primary"
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

          {activeTab === 'website-games' && <GamesManagement />}
          {activeTab === 'website-blog' && <BlogManagement />}
          {activeTab === 'website-settings' && <WebsiteSettings />}
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
