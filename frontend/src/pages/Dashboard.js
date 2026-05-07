import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Users, Package, Activity, FileText, Database, LogOut, Code, Gamepad2, ChevronDown, Check } from 'lucide-react';
import { UserManagement } from '../components/UserManagement';
import { SendItems } from '../components/SendItems';
import { ServerStatus } from '../components/ServerStatus';
import { LogsViewer } from '../components/LogsViewer';
import { VariablesManagement } from '../components/VariablesManagement';
import { ApiEndpoints } from '../components/ApiEndpoints';
import { ProjectManagement } from '../components/ProjectManagement';

const tabColors = {
  'send-items': { gradient: 'from-[#F2994A] to-[#EB5757]', text: '#F2994A' },
  'status': { gradient: 'from-[#27AE60] to-[#219653]', text: '#27AE60' },
  'variables': { gradient: 'from-[#2F80ED] to-[#2D9CDB]', text: '#2F80ED' },
  'logs': { gradient: 'from-[#9B51E0] to-[#BB6BD9]', text: '#9B51E0' },
  'users': { gradient: 'from-[#F2994A] to-[#F2C94C]', text: '#F2994A' },
  'api': { gradient: 'from-[#4F4F4F] to-[#828282]', text: '#4F4F4F' },
  'projects': { gradient: 'from-[#6C5CE7] to-[#A29BFE]', text: '#6C5CE7' }
};

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();
  const [activeTab, setActiveTab] = useState('send-items');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  useEffect(() => {
    if (!hasPermission('send_items')) {
      if (hasPermission('view_projects')) setActiveTab('projects');
      else if (hasPermission('manage_users')) setActiveTab('users');
      else if (hasPermission('view_logs')) setActiveTab('logs');
      else if (hasPermission('view_variables')) setActiveTab('variables');
    }
    // eslint-disable-next-line
  }, [user]);

  // Tabs that need a project selected
  const projectTabs = ['send-items', 'status', 'variables', 'logs'];
  const needsProject = projectTabs.includes(activeTab);

  const menuItems = [
    { id: 'projects', label: 'Projects', icon: Gamepad2, permission: 'view_projects', section: 'global' },
    { id: 'send-items', label: 'Send Items', icon: Package, permission: 'send_items', section: 'project' },
    { id: 'status', label: 'Server Status', icon: Activity, permission: 'change_status', section: 'project' },
    { id: 'variables', label: 'Variables', icon: Database, permission: 'view_variables', section: 'project' },
    { id: 'logs', label: 'Logs', icon: FileText, permission: 'view_logs', section: 'project' },
    { id: 'users', label: 'Users', icon: Users, permission: 'manage_users', section: 'global' },
    { id: 'api', label: 'API Docs', icon: Code, permission: 'view_api_docs', section: 'global' },
  ];

  const visibleMenuItems = menuItems.filter(item => !item.permission || hasPermission(item.permission));

  const globalItems = visibleMenuItems.filter(item => item.section === 'global');
  const projectItems = visibleMenuItems.filter(item => item.section === 'project');

  const renderTab = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const colors = tabColors[item.id];
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
          isActive
            ? 'bg-[#FBF9F7] font-medium shadow-sm'
            : 'text-[#8A8A9A] hover:bg-[#FBF9F7] hover:text-[#1A1A2E]'
        }`}
        style={isActive ? { color: colors.text } : {}}
        data-testid={`sidebar-nav-${item.id}`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isActive ? `bg-gradient-to-br ${colors.gradient} shadow-sm` : 'bg-[#F5F0EB]'
        }`}>
          <Icon size={15} className={isActive ? 'text-white' : 'text-[#8A8A9A]'} />
        </div>
        {item.label}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#FBF9F7]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#EDE5DB] flex flex-col shadow-sm">
        {/* Logo Header */}
        <div className="p-5 border-b border-[#EDE5DB]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F2994A] to-[#EB5757] flex items-center justify-center shadow-sm">
              <Package size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1A1A2E]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Admin Panel
              </h1>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F5F0EB] flex items-center justify-center text-xs font-semibold text-[#F2994A]">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A2E] truncate">{user?.username}</p>
              {user?.is_super_admin && (
                <p className="text-xs text-[#F2994A] font-medium">Super Admin</p>
              )}
            </div>
          </div>
        </div>

        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="px-3 pt-3">
            <div className="text-[10px] font-bold text-[#C4B5A5] uppercase tracking-wider px-3 mb-2">Active Project</div>
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#FBF9F7] border border-[#EDE5DB] rounded-lg text-sm text-left hover:border-[#6C5CE7]/40 transition-all"
                data-testid="project-selector"
              >
                <Gamepad2 size={14} className="text-[#6C5CE7] shrink-0" />
                <span className="flex-1 truncate font-medium text-[#1A1A2E]">
                  {selectedProject?.name || 'Select project'}
                </span>
                <ChevronDown size={14} className={`text-[#8A8A9A] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProjectDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#EDE5DB] rounded-lg shadow-lg overflow-hidden"
                  data-testid="project-dropdown">
                  {projects.map((project) => (
                    <button key={project.slug}
                      onClick={() => { selectProject(project); setShowProjectDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[#FBF9F7] transition-all ${
                        selectedProject?.slug === project.slug ? 'bg-[#6C5CE7]/5' : ''
                      }`}
                      data-testid={`project-option-${project.slug}`}
                    >
                      <Gamepad2 size={14} className="text-[#6C5CE7] shrink-0" />
                      <span className="flex-1 truncate text-[#1A1A2E]">{project.name}</span>
                      {selectedProject?.slug === project.slug && (
                        <Check size={14} className="text-[#6C5CE7] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
          {/* Global section */}
          <div className="text-[10px] font-bold text-[#C4B5A5] uppercase tracking-wider px-3 mb-1 mt-1">General</div>
          {globalItems.map(renderTab)}

          {/* Project section */}
          {selectedProject && projectItems.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-[#C4B5A5] uppercase tracking-wider px-3 mb-1 mt-4">
                Project Tools
              </div>
              {projectItems.map(renderTab)}
            </>
          )}
        </nav>

        {/* Logout & Version */}
        <div className="border-t border-[#EDE5DB] p-3">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#8A8A9A] hover:bg-[#FBF9F7] hover:text-[#EB5757] rounded-lg transition-all"
            data-testid="logout-button"
          >
            <div className="w-8 h-8 rounded-lg bg-[#F5F0EB] flex items-center justify-center">
              <LogOut size={15} className="text-[#8A8A9A]" />
            </div>
            Sign Out
          </button>
          <div className="mt-2 px-3 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FBF9F7] border border-[#EDE5DB] rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#27AE60]"></div>
              <span className="text-[10px] font-medium text-[#8A8A9A]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>v1.1.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto" onClick={() => showProjectDropdown && setShowProjectDropdown(false)}>
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-[#EDE5DB] px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tabColors[activeTab]?.gradient || 'from-[#F2994A] to-[#EB5757]'} flex items-center justify-center shadow-sm`}>
              {(() => {
                const ActiveIcon = visibleMenuItems.find(item => item.id === activeTab)?.icon || Package;
                return <ActiveIcon size={15} className="text-white" />;
              })()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1A1A2E]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {visibleMenuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h2>
              {needsProject && selectedProject && (
                <p className="text-xs text-[#8A8A9A]">{selectedProject.name}</p>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {activeTab === 'projects' && <ProjectManagement />}

          {needsProject && !selectedProject && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-xl bg-[#6C5CE7]/10 flex items-center justify-center mb-4">
                <Gamepad2 size={28} className="text-[#6C5CE7]" />
              </div>
              <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">No project selected</h3>
              <p className="text-sm text-[#8A8A9A] max-w-sm">
                Create a project first or select one from the sidebar to manage its data.
              </p>
              <button onClick={() => setActiveTab('projects')}
                className="mt-4 bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm"
                data-testid="go-to-projects-button">
                Go to Projects
              </button>
            </div>
          )}

          {activeTab === 'send-items' && selectedProject && hasPermission('send_items') && <SendItems />}
          {activeTab === 'status' && selectedProject && hasPermission('change_status') && <ServerStatus />}
          {activeTab === 'variables' && selectedProject && hasPermission('view_variables') && <VariablesManagement />}
          {activeTab === 'logs' && selectedProject && hasPermission('view_logs') && <LogsViewer />}
          {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
          {activeTab === 'api' && hasPermission('view_api_docs') && <ApiEndpoints />}
        </div>
      </main>
    </div>
  );
};

export const Dashboard = () => {
  return (
    <ProjectProvider>
      <DashboardContent />
    </ProjectProvider>
  );
};
