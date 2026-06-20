import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Users, Package, Activity, FileText, Database, LogOut, Code, Gamepad2, ChevronDown, Check, Globe, Settings, PenTool, MessageSquare } from 'lucide-react';
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

const tabConfig = {
  'projects': { gradient: 'from-[#6C5CE7] to-[#A29BFE]', text: '#A29BFE' },
  'send-items': { gradient: 'from-[#F2994A] to-[#EB5757]', text: '#F2994A' },
  'status': { gradient: 'from-[#4ECDC4] to-[#2CB5AC]', text: '#4ECDC4' },
  'variables': { gradient: 'from-[#2F80ED] to-[#2D9CDB]', text: '#2F80ED' },
  'logs': { gradient: 'from-[#9B51E0] to-[#BB6BD9]', text: '#9B51E0' },
  'users': { gradient: 'from-[#F2994A] to-[#F2C94C]', text: '#F2C94C' },
  'api': { gradient: 'from-[#71717a] to-[#52525b]', text: '#71717a' },
  'website-games': { gradient: 'from-[#4ECDC4] to-[#2CB5AC]', text: '#4ECDC4' },
  'website-blog': { gradient: 'from-[#F2994A] to-[#EB5757]', text: '#F2994A' },
  'website-chat': { gradient: 'from-[#9B51E0] to-[#BB6BD9]', text: '#9B51E0' },
  'website-settings': { gradient: 'from-[#71717a] to-[#52525b]', text: '#71717a' },
};

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();
  const [activeTab, setActiveTab] = useState('projects');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  useEffect(() => {
    if (hasPermission('view_projects')) setActiveTab('projects');
    else if (hasPermission('send_items')) setActiveTab('send-items');
    else if (hasPermission('manage_users')) setActiveTab('users');
    // eslint-disable-next-line
  }, [user]);

  const projectTabs = ['send-items', 'status', 'variables', 'logs'];
  const needsProject = projectTabs.includes(activeTab);

  const generalItems = [
    { id: 'projects', label: 'Projects', icon: Gamepad2, permission: 'view_projects' },
    { id: 'users', label: 'Users', icon: Users, permission: 'manage_users' },
    { id: 'api', label: 'API Docs', icon: Code, permission: 'view_api_docs' },
  ];

  const projectItems = [
    { id: 'send-items', label: 'Send Items', icon: Package, permission: 'send_items' },
    { id: 'status', label: 'Server Status', icon: Activity, permission: 'change_status' },
    { id: 'variables', label: 'Variables', icon: Database, permission: 'view_variables' },
    { id: 'logs', label: 'Logs', icon: FileText, permission: 'view_logs' },
  ];

  const websiteItems = [
    { id: 'website-games', label: 'Games', icon: Gamepad2, permission: 'create_games' },
    { id: 'website-blog', label: 'Blog', icon: PenTool, permission: 'create_blog' },
    { id: 'website-chat', label: 'Chat', icon: MessageSquare, permission: 'manage_chat' },
    { id: 'website-settings', label: 'Settings', icon: Settings, permission: 'manage_website' },
  ];

  const renderTab = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const colors = tabConfig[item.id] || tabConfig['projects'];
    if (!hasPermission(item.permission)) return null;
    return (
      <button key={item.id} onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all ${
          isActive ? 'bg-[#1c1c2e] font-medium' : 'text-[#71717a] hover:bg-[#1c1c2e]/50 hover:text-[#e4e4e7]'
        }`}
        style={isActive ? { color: colors.text } : {}}
        data-testid={`sidebar-nav-${item.id}`}>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${isActive ? `bg-gradient-to-br ${colors.gradient}` : 'bg-[#1c1c2e]'}`}>
          <Icon size={13} className={isActive ? 'text-white' : 'text-[#71717a]'} />
        </div>
        {item.label}
      </button>
    );
  };

  const currentLabel = [...generalItems, ...projectItems, ...websiteItems].find(i => i.id === activeTab)?.label || 'Dashboard';
  const CurrentIcon = [...generalItems, ...projectItems, ...websiteItems].find(i => i.id === activeTab)?.icon || Package;

  return (
    <div className="flex h-screen bg-[#0d0d14]">
      {/* Sidebar */}
      <aside className="w-60 bg-[#111118] border-r border-[#2a2a3c] flex flex-col">
        <div className="p-4 border-b border-[#2a2a3c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4ECDC4] to-[#2CB5AC] flex items-center justify-center">
              <Globe size={14} className="text-white" />
            </div>
            <span className="text-sm font-black tracking-[0.1em] text-[#e4e4e7]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#4ECDC4]/20 flex items-center justify-center text-[10px] font-bold text-[#4ECDC4]">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#e4e4e7] truncate">{user?.username}</p>
              {user?.is_super_admin && <p className="text-[10px] text-[#4ECDC4]">Super Admin</p>}
            </div>
          </div>
        </div>

        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="px-3 pt-3">
            <div className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider px-3 mb-1.5">Active Project</div>
            <div className="relative">
              <button onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-[#1c1c2e] border border-[#2a2a3c] rounded-lg text-xs text-left hover:border-[#4ECDC4]/30 transition-all"
                data-testid="project-selector">
                <Gamepad2 size={12} className="text-[#4ECDC4] shrink-0" />
                <span className="flex-1 truncate text-[#e4e4e7]">{selectedProject?.name || 'Select'}</span>
                <ChevronDown size={12} className={`text-[#71717a] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showProjectDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1c1c2e] border border-[#2a2a3c] rounded-lg shadow-2xl overflow-hidden" data-testid="project-dropdown">
                  {projects.map(p => (
                    <button key={p.slug} onClick={() => { selectProject(p); setShowProjectDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#2a2a3c] transition-all ${selectedProject?.slug === p.slug ? 'bg-[#4ECDC4]/5' : ''}`}
                      data-testid={`project-option-${p.slug}`}>
                      <span className="flex-1 truncate text-[#e4e4e7]">{p.name}</span>
                      {selectedProject?.slug === p.slug && <Check size={12} className="text-[#4ECDC4]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto" data-testid="sidebar-nav">
          <div className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider px-3 mb-1 mt-2">General</div>
          {generalItems.map(renderTab)}

          {selectedProject && projectItems.some(i => hasPermission(i.permission)) && (
            <>
              <div className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider px-3 mb-1 mt-4">Project Tools</div>
              {projectItems.map(renderTab)}
            </>
          )}

          {websiteItems.some(i => hasPermission(i.permission)) && (
            <>
              <div className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider px-3 mb-1 mt-4">Website</div>
              {websiteItems.map(renderTab)}
            </>
          )}
        </nav>

        <div className="border-t border-[#2a2a3c] p-3">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#71717a] hover:bg-[#1c1c2e] hover:text-red-400 rounded-lg transition-all" data-testid="logout-button">
            <div className="w-7 h-7 rounded-md bg-[#1c1c2e] flex items-center justify-center"><LogOut size={13} /></div>
            Sign Out
          </button>
          <div className="mt-2 px-3 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1c1c2e] border border-[#2a2a3c] rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]"></div>
              <span className="text-[10px] font-mono text-[#71717a]">v1.3.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto" onClick={() => showProjectDropdown && setShowProjectDropdown(false)}>
        <header className="bg-[#111118]/80 backdrop-blur-md border-b border-[#2a2a3c] px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${tabConfig[activeTab]?.gradient || 'from-[#4ECDC4] to-[#2CB5AC]'} flex items-center justify-center`}>
              <CurrentIcon size={13} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#e4e4e7]">{currentLabel}</h2>
              {needsProject && selectedProject && <p className="text-[11px] text-[#71717a]">{selectedProject.name}</p>}
            </div>
          </div>
        </header>

        <div className="p-6">
          {activeTab === 'projects' && <ProjectManagement />}
          {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
          {activeTab === 'api' && hasPermission('view_api_docs') && <ApiEndpoints />}

          {needsProject && !selectedProject && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Gamepad2 size={32} className="text-[#4ECDC4]/30 mb-4" />
              <h3 className="text-lg font-semibold text-[#e4e4e7] mb-2">No project selected</h3>
              <p className="text-sm text-[#71717a]">Select or create a project to manage its data.</p>
              <button onClick={() => setActiveTab('projects')} className="mt-4 bg-[#4ECDC4] text-[#0a0a0f] rounded-lg px-5 py-2 text-sm font-semibold" data-testid="go-to-projects-button">Go to Projects</button>
            </div>
          )}

          {activeTab === 'send-items' && selectedProject && hasPermission('send_items') && <SendItems />}
          {activeTab === 'status' && selectedProject && hasPermission('change_status') && <ServerStatus />}
          {activeTab === 'variables' && selectedProject && hasPermission('view_variables') && <VariablesManagement />}
          {activeTab === 'logs' && selectedProject && hasPermission('view_logs') && <LogsViewer />}

          {activeTab === 'website-games' && <GamesManagement />}
          {activeTab === 'website-blog' && <BlogManagement />}
          {activeTab === 'website-chat' && hasPermission('manage_chat') && <ChatManagement />}
          {activeTab === 'website-settings' && <WebsiteSettings />}
        </div>
      </main>
    </div>
  );
};

export const Dashboard = () => <ProjectProvider><DashboardContent /></ProjectProvider>;
