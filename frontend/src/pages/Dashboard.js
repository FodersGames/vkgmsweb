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
    { id: 'send-items', label: 'Send Items',    icon: Package,  permission: 'send_items' },
    { id: 'status',     label: 'Server Status', icon: Activity, permission: 'change_status' },
    { id: 'variables',  label: 'Variables',     icon: Database, permission: 'view_variables' },
    { id: 'logs',       label: 'Logs',          icon: FileText, permission: 'view_logs' },
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

  const handleTabClick = (id) => {
    setActiveTab(id);
    setMobileSidebar(false);
  };

  const renderNavItem = (item) => {
    if (!hasPermission(item.permission)) return null;
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-xl font-body
          ${isActive
            ? 'bg-white/09 text-white font-medium border-l-2 border-white/60'
            : 'text-[#6E6E73] hover:bg-white/05 hover:text-[#A1A1A6] border-l-2 border-transparent'
          }`}
        data-testid={`sidebar-nav-${item.id}`}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          isActive ? 'bg-white/15' : 'bg-white/05'
        }`}>
          <Icon size={13} className={isActive ? 'text-white' : 'text-[#6E6E73]'} />
        </div>
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <ChevronRight size={12} className="text-white/30" />}
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + User */}
      <div className="px-4 py-5" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 flex-shrink-0" style={{ perspective:'80px' }}>
            <div style={{
              width:'100%',height:'100%',
              background:'linear-gradient(135deg,#FFFFFF 0%,#A0A0A8 100%)',
              borderRadius:'6px',
              transform:'rotateX(12deg) rotateY(-16deg)',
              boxShadow:'3px 5px 0px rgba(255,255,255,0.2)',
            }} />
          </div>
          <span className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</span>
        </div>
        {/* User badge */}
        <div className="flex items-center gap-2.5 px-3 py-2 glass rounded-xl">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 font-display"
            style={{ background:'rgba(255,255,255,0.15)' }}>
            {user?.username?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate font-body">{user?.username}</p>
            {user?.is_super_admin && <p className="text-[10px] text-[#6E6E73]">Super Admin</p>}
          </div>
        </div>
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-semibold text-[#3A3A3C] uppercase tracking-widest px-1 mb-2">Active Project</p>
          <div className="relative">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="w-full flex items-center gap-2 px-3 py-2 glass rounded-xl text-xs text-left glass-hover transition-all font-body"
              data-testid="project-selector"
            >
              <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:'rgba(255,255,255,0.1)' }}>
                <Gamepad2 size={11} className="text-white" />
              </div>
              <span className="flex-1 truncate text-white">{selectedProject?.name || 'Select project'}</span>
              <ChevronDown size={12} className={`text-[#6E6E73] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showProjectDropdown && (
              <div className="absolute z-50 left-0 right-0 mt-1 glass-strong rounded-xl overflow-hidden" style={{ boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }} data-testid="project-dropdown">
                {projects.map(p => (
                  <button
                    key={p.slug}
                    onClick={() => { selectProject(p); setShowProjectDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-all font-body
                      ${selectedProject?.slug === p.slug ? 'text-white bg-white/10' : 'text-[#A1A1A6] hover:bg-white/05 hover:text-white'}`}
                    style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}
                    data-testid={`project-option-${p.slug}`}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    {selectedProject?.slug === p.slug && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5" data-testid="sidebar-nav">
        <p className="text-[10px] font-semibold text-[#3A3A3C] uppercase tracking-widest px-3 pt-3 pb-2">General</p>
        {generalItems.map(renderNavItem)}

        {selectedProject && projectItems.some(i => hasPermission(i.permission)) && (
          <>
            <p className="text-[10px] font-semibold text-[#3A3A3C] uppercase tracking-widest px-3 pt-5 pb-2">Project Tools</p>
            {projectItems.map(renderNavItem)}
          </>
        )}

        {websiteItems.some(i => hasPermission(i.permission)) && (
          <>
            <p className="text-[10px] font-semibold text-[#3A3A3C] uppercase tracking-widest px-3 pt-5 pb-2">Website</p>
            {websiteItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#6E6E73] hover:bg-white/05 hover:text-[#FF453A] rounded-xl transition-all font-body border-l-2 border-transparent"
          data-testid="logout-button"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'rgba(255,255,255,0.05)' }}>
            <LogOut size={13} className="text-[#6E6E73]" />
          </div>
          Sign Out
        </button>
        <div className="mt-3 px-3">
          <span className="text-[10px] font-mono text-[#3A3A3C] flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#30D158]" style={{ animation:'orb-pulse 2s ease-in-out infinite' }} />
            v1.3.0 — Connected
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="flex h-screen font-body"
      style={{ background:'#080808' }}
      onClick={() => showProjectDropdown && setShowProjectDropdown(false)}
    >
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0"
        style={{ background:'#0c0c0c', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex flex-col" style={{ background:'#0c0c0c', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebar(false)} />
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="px-6 py-4 flex-shrink-0" style={{ background:'#0a0a0a', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden btn-icon" onClick={() => setMobileSidebar(true)}>
              <Menu size={16} className="text-white" />
            </button>

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background:'rgba(255,255,255,0.08)' }}>
                <CurrentIcon size={13} className="text-white" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-[#3A3A3C] hidden sm:block">Dashboard</span>
                <ChevronRight size={12} className="text-[#3A3A3C] hidden sm:block" />
                <span className="text-sm font-semibold text-white truncate font-display" style={{ letterSpacing:'-0.01em' }}>{currentLabel}</span>
                {needsProject && selectedProject && (
                  <>
                    <ChevronRight size={12} className="text-[#3A3A3C]" />
                    <span className="text-xs text-[#6E6E73] truncate">{selectedProject.name}</span>
                  </>
                )}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 glass rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#30D158]" style={{ animation:'orb-pulse 2s ease-in-out infinite' }} />
              <span className="text-[10px] font-mono text-[#6E6E73]">{currentLabel}</span>
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
              <div className="w-16 h-16 glass glass-strong rounded-2xl flex items-center justify-center mb-6">
                <Gamepad2 size={28} className="text-[#3A3A3C]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2 font-display" style={{ letterSpacing:'-0.01em' }}>No project selected</h3>
              <p className="text-sm text-[#6E6E73] mb-6 max-w-sm" style={{ fontWeight:300 }}>
                Select or create a project to manage its server status, variables, logs, and items.
              </p>
              <button onClick={() => setActiveTab('projects')} className="btn-primary" data-testid="go-to-projects-button">
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
