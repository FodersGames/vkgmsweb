import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Users, Package, Activity, FileText, Database, LogOut, Code, Gamepad2, ChevronDown, Check, Globe, Settings, PenTool, Menu, X, Sun, Moon, LayoutDashboard, Sparkles } from 'lucide-react';
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

const tabConfig = {
  'projects': { gradient: 'from-[#6C5CE7] to-[#A29BFE]', text: '#A29BFE', glow: 'shadow-[#6C5CE7]/20' },
  'send-items': { gradient: 'from-[#F2994A] to-[#EB5757]', text: '#F2994A', glow: 'shadow-[#F2994A]/20' },
  'status': { gradient: 'from-[#4ECDC4] to-[#2CB5AC]', text: '#4ECDC4', glow: 'shadow-[#4ECDC4]/20' },
  'variables': { gradient: 'from-[#2F80ED] to-[#2D9CDB]', text: '#2F80ED', glow: 'shadow-[#2F80ED]/20' },
  'logs': { gradient: 'from-[#9B51E0] to-[#BB6BD9]', text: '#BB6BD9', glow: 'shadow-[#9B51E0]/20' },
  'users': { gradient: 'from-[#F2994A] to-[#F2C94C]', text: '#F2C94C', glow: 'shadow-[#F2C94C]/20' },
  'api': { gradient: 'from-[#71717a] to-[#52525b]', text: '#a1a1aa', glow: 'shadow-black/20' },
  'website-games': { gradient: 'from-[#4ECDC4] to-[#2CB5AC]', text: '#4ECDC4', glow: 'shadow-[#4ECDC4]/20' },
  'website-blog': { gradient: 'from-[#F2994A] to-[#EB5757]', text: '#F2994A', glow: 'shadow-[#F2994A]/20' },
  'website-settings': { gradient: 'from-[#71717a] to-[#52525b]', text: '#a1a1aa', glow: 'shadow-black/20' },
};

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();
  const [activeTab, setActiveTab] = useState('projects');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('vakar-admin-theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('vakar-admin-theme', theme);
  }, [theme]);

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
    { id: 'website-settings', label: 'Settings', icon: Settings, permission: 'manage_website' },
  ];

  const allItems = [...generalItems, ...projectItems, ...websiteItems];
  const activeItem = allItems.find(i => i.id === activeTab) || generalItems[0];
  const currentLabel = activeItem?.label || 'Dashboard';
  const CurrentIcon = activeItem?.icon || Package;
  const activeConfig = tabConfig[activeTab] || tabConfig.projects;

  const switchTab = (id) => {
    setActiveTab(id);
    setSidebarOpen(false);
  };

  const renderSection = (title, items) => {
    const visible = items.filter(item => hasPermission(item.permission));
    if (!visible.length) return null;

    return (
      <div className="space-y-1.5">
        <div className="px-3 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#6b7280]">{title}</div>
        {visible.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const colors = tabConfig[item.id] || tabConfig.projects;
          return (
            <button key={item.id} onClick={() => switchTab(item.id)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                isActive
                  ? `bg-white/[0.07] text-white shadow-lg ${colors.glow}`
                  : 'text-[#8A8A9A] hover:bg-white/[0.05] hover:text-white'
              }`}
              style={isActive ? { color: colors.text } : {}}
              data-testid={`sidebar-nav-${item.id}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isActive ? `bg-gradient-to-br ${colors.gradient} shadow-lg` : 'bg-white/[0.05] group-hover:bg-white/[0.08]'}`}>
                <Icon size={16} className={isActive ? 'text-white' : 'text-[#8A8A9A] group-hover:text-white'} />
              </div>
              <span className="flex-1 text-left font-semibold">{item.label}</span>
              {isActive && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.text }} />}
            </button>
          );
        })}
      </div>
    );
  };

  const Sidebar = () => (
    <aside className="admin-sidebar h-full w-[280px] bg-[#111118]/95 border-r border-[#2a2a3c] flex flex-col backdrop-blur-2xl">
      <div className="p-5 border-b border-[#2a2a3c]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4ECDC4] via-[#2CB5AC] to-[#6C5CE7] flex items-center justify-center shadow-lg shadow-[#4ECDC4]/20">
              <Globe size={18} className="text-white" />
            </div>
            <div>
              <span className="block text-base font-black tracking-[0.14em] text-[#e4e4e7] leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#4ECDC4]">Admin Panel</span>
            </div>
          </div>
          <button className="lg:hidden p-2 rounded-xl bg-white/[0.05] text-[#e4e4e7]" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#4ECDC4]/20 flex items-center justify-center text-xs font-black text-[#4ECDC4] ring-1 ring-[#4ECDC4]/30">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#e4e4e7] truncate">{user?.username}</p>
              <p className="text-[11px] text-[#8A8A9A] truncate">{user?.is_super_admin ? 'Super Admin' : 'Team Member'}</p>
            </div>
          </div>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="px-4 pt-4">
          <div className="text-[10px] font-black text-[#6b7280] uppercase tracking-[0.22em] px-1 mb-2">Active Project</div>
          <div className="relative">
            <button onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="w-full flex items-center gap-3 px-3 py-3 bg-[#1c1c2e] border border-[#2a2a3c] rounded-2xl text-left hover:border-[#4ECDC4]/40 hover:bg-[#202034] transition-all"
              data-testid="project-selector">
              <Gamepad2 size={16} className="text-[#4ECDC4] shrink-0" />
              <span className="flex-1 truncate text-sm font-semibold text-[#e4e4e7]">{selectedProject?.name || 'Select project'}</span>
              <ChevronDown size={15} className={`text-[#8A8A9A] transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showProjectDropdown && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-[#171724] border border-[#2a2a3c] rounded-2xl shadow-2xl overflow-hidden" data-testid="project-dropdown">
                {projects.map(p => (
                  <button key={p.slug} onClick={() => { selectProject(p); setShowProjectDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-3 text-sm text-left hover:bg-[#222238] transition-all ${selectedProject?.slug === p.slug ? 'bg-[#4ECDC4]/10' : ''}`}
                    data-testid={`project-option-${p.slug}`}>
                    <span className="flex-1 truncate text-[#e4e4e7]">{p.name}</span>
                    {selectedProject?.slug === p.slug && <Check size={14} className="text-[#4ECDC4]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 py-3 px-3 overflow-y-auto" data-testid="sidebar-nav">
        {renderSection('General', generalItems)}
        {selectedProject && renderSection('Project Tools', projectItems)}
        {renderSection('Website', websiteItems)}
      </nav>

      <div className="border-t border-[#2a2a3c] p-4 space-y-3">
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-[#e4e4e7] bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-all" data-testid="theme-toggle">
          <span className="flex items-center gap-3 font-semibold">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center">{theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}</div>
            {theme === 'dark' ? 'Dark mode' : 'Light mode'}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#8A8A9A]">Switch</span>
        </button>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#8A8A9A] hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all" data-testid="logout-button">
          <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center"><LogOut size={14} /></div>
          <span className="font-semibold">Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`admin-shell ${theme === 'light' ? 'admin-light' : 'admin-dark'} min-h-screen bg-[#0d0d14] text-[#e4e4e7]`}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-[#4ECDC4]/10 blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-[#6C5CE7]/10 blur-3xl" />
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="relative z-10 flex min-h-screen">
        <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:sticky lg:top-0 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar />
        </div>

        <main className="flex-1 min-w-0" onClick={() => showProjectDropdown && setShowProjectDropdown(false)}>
          <header className="sticky top-0 z-30 bg-[#111118]/80 backdrop-blur-2xl border-b border-[#2a2a3c] px-4 sm:px-6 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button className="lg:hidden p-2.5 rounded-xl bg-white/[0.05] text-[#e4e4e7] border border-white/[0.08]" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                  <Menu size={19} />
                </button>
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${activeConfig.gradient} flex items-center justify-center shadow-lg ${activeConfig.glow}`}>
                  <CurrentIcon size={19} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-[#e4e4e7] truncate">{currentLabel}</h2>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#4ECDC4]/10 text-[#4ECDC4] text-[10px] font-bold uppercase tracking-wider"><Sparkles size={10} /> Pro</span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#8A8A9A] truncate">{needsProject && selectedProject ? selectedProject.name : 'Manage games, API tools and website content from one clean workspace.'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3">
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[#8A8A9A]">Projects</p>
                  <p className="text-sm font-black text-[#e4e4e7]">{projects.length}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[#8A8A9A]">Theme</p>
                  <p className="text-sm font-black text-[#e4e4e7] capitalize">{theme}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-[#8A8A9A]">Status</p>
                  <p className="text-sm font-black text-[#4ECDC4]">Online</p>
                </div>
              </div>
            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-8">
            {activeTab === 'projects' && <ProjectManagement />}
            {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
            {activeTab === 'api' && hasPermission('view_api_docs') && <ApiEndpoints />}

            {needsProject && !selectedProject && (
              <div className="admin-empty-state flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-white/[0.08] bg-white/[0.04]">
                <div className="w-16 h-16 rounded-3xl bg-[#4ECDC4]/10 flex items-center justify-center mb-5"><LayoutDashboard size={28} className="text-[#4ECDC4]" /></div>
                <h3 className="text-xl font-black text-[#e4e4e7] mb-2">No project selected</h3>
                <p className="text-sm text-[#8A8A9A] max-w-sm">Select or create a project to manage its data, variables, server state and item sending tools.</p>
                <button onClick={() => switchTab('projects')} className="mt-5 bg-[#4ECDC4] text-[#0a0a0f] rounded-2xl px-5 py-2.5 text-sm font-black hover:bg-[#45b8b0] transition-all" data-testid="go-to-projects-button">Go to Projects</button>
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
    </div>
  );
};

export const Dashboard = () => <ProjectProvider><DashboardContent /></ProjectProvider>;
