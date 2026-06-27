import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Link } from 'react-router-dom';
import {
  Users, Package, Activity, FileText, Database, LogOut, Code,
  Gamepad2, ChevronDown, Check, Globe, Settings, PenTool,
  MessageSquare, Menu, X, ShoppingBag, ClipboardList, LayoutDashboard,
  ArrowRight, Home, Ticket, UserCircle, Tag, ChevronRight, HardDrive, Server,
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
import { FilesManagement } from '../components/FilesManagement';
import { VpsStats } from '../components/VpsStats';
import TicketManagement from '../components/TicketManagement';
import { AccountSettings } from '../components/AccountSettings';
import { CouponManagement } from '../components/CouponManagement';

// ── Navigation structure ──────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    directTab: 'overview',
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: Gamepad2,
    items: [
      { id: 'projects',   label: 'Projects',      icon: Gamepad2,      permission: 'view_projects'   },
      { id: 'send-items', label: 'Send Items',     icon: Package,       permission: 'send_items',      requiresProject: true },
      { id: 'status',     label: 'Server Status',  icon: Activity,      permission: 'change_status',   requiresProject: true },
      { id: 'variables',  label: 'Variables',      icon: Database,      permission: 'view_variables',  requiresProject: true },
      { id: 'logs',       label: 'Logs',           icon: FileText,      permission: 'view_logs',       requiresProject: true },
      { id: 'chat',       label: 'Chat',           icon: MessageSquare, permission: 'manage_chat',     requiresProject: true },
      { id: 'missions',   label: 'Missions',       icon: ClipboardList, permission: 'claim_missions',  requiresProject: true },
      { id: 'files',      label: 'Files',          icon: HardDrive,     permission: 'view_projects',   requiresProject: true },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    items: [
      { id: 'website-games',    label: 'Games',    icon: Gamepad2,    permission: 'create_games'    },
      { id: 'website-blog',     label: 'Blog',     icon: PenTool,     permission: 'create_blog'     },
      { id: 'website-shop',     label: 'Shop',     icon: ShoppingBag, permission: 'manage_shop'     },
      { id: 'coupons',          label: 'Coupons',  icon: Tag,         permission: 'manage_shop'     },
      { id: 'support',          label: 'Support',  icon: Ticket,      permission: 'manage_tickets'  },
      { id: 'website-settings', label: 'Settings', icon: Settings,    permission: 'manage_website'  },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    items: [
      { id: 'users',   label: 'Users',    icon: Users,  permission: 'manage_users'  },
      { id: 'api',     label: 'API Docs', icon: Code,   permission: 'view_api_docs' },
      { id: 'vps',     label: 'VPS',      icon: Server, permission: 'manage_users'  },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: UserCircle,
    directTab: 'account',
  },
];

// Resolve which section contains a given tab ID
const getSectionForTab = (tabId) => {
  for (const s of SECTIONS) {
    if (s.directTab === tabId) return s.id;
    if (s.items?.some(i => i.id === tabId)) return s.id;
  }
  return 'overview';
};

// ── Main component ────────────────────────────────────────────────────────────

const DashboardContent = () => {
  const { user, logout, hasPermission } = useAuth();
  const { projects, selectedProject, selectProject } = useProject();

  const [activeTab,    setActiveTab]    = useState('overview');
  const [activeSection, setActiveSection] = useState('overview');
  const [showProject,  setShowProject]  = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  const projectDropRef = useRef(null);

  // Sync section when tab changes
  useEffect(() => {
    setActiveSection(getSectionForTab(activeTab));
  }, [activeTab]);

  // Close project dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (projectDropRef.current && !projectDropRef.current.contains(e.target)) {
        setShowProject(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isVisible = (item) =>
    item.permission === null || item.permission === undefined
      ? true
      : hasPermission(item.permission);

  const canSeeSection = (section) => {
    if (section.directTab) return true;
    return section.items?.some(isVisible) ?? false;
  };

  // When clicking a section icon
  const handleSectionClick = (section) => {
    if (section.directTab) {
      setActiveTab(section.directTab);
      setActiveSection(section.id);
      setMobileOpen(false);
      return;
    }
    // Go to first visible item of that section
    const first = section.items?.find(isVisible);
    if (first) {
      setActiveTab(first.id);
      setActiveSection(section.id);
    }
    setMobileOpen(false);
  };

  const currentSection = SECTIONS.find(s => s.id === activeSection);
  const currentItem    = currentSection?.items?.find(i => i.id === activeTab)
    || (currentSection?.directTab ? currentSection : null);

  const projectTabs = ['send-items', 'status', 'variables', 'logs', 'chat', 'missions', 'files'];
  const needsProject = projectTabs.includes(activeTab);

  const initials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase()
    || user?.username?.charAt(0)?.toUpperCase() || '?';

  // ── Icon sidebar ────────────────────────────────────────────────────────────

  const IconSidebar = () => (
    <div className="w-16 shrink-0 bg-[#111110] flex flex-col items-center py-4 gap-1 z-30">
      {/* Logo mark */}
      <div className="mb-4">
        <div
          className="text-[#4ECDC4] text-xs font-black tracking-widest leading-none"
          style={{ fontFamily: "'Bebas Neue', sans-serif", writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.2em' }}
        >
          VG
        </div>
      </div>

      {/* Section icons */}
      <div className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {SECTIONS.filter(canSeeSection).map(section => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section)}
              title={section.label}
              className={`group relative w-full flex flex-col items-center gap-1 py-3 px-1 transition-all ${
                isActive
                  ? 'text-[#4ECDC4]'
                  : 'text-[#52525B] hover:text-[#A8A29E]'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#4ECDC4]" />
              )}
              <Icon size={18} />
              <span className="text-[9px] font-semibold tracking-wide leading-none">
                {section.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-3 pb-1">
        <Link to="/" title="Back to site" className="text-[#52525B] hover:text-[#A8A29E] transition-colors">
          <Home size={16} />
        </Link>
        <button
          onClick={logout}
          title="Sign out"
          className="text-[#52525B] hover:text-red-400 transition-colors"
          data-testid="logout-button"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  // ── Section panel (sub-navigation) ─────────────────────────────────────────

  const SectionPanel = () => {
    if (!currentSection || currentSection.directTab) return null;

    return (
      <div className="w-48 shrink-0 bg-white border-r border-[#E8E3DB] flex flex-col overflow-y-auto">
        {/* Section title */}
        <div className="px-4 pt-5 pb-3 border-b border-[#E8E3DB]">
          <p
            className="text-xs font-black tracking-[0.14em] text-[#1C1917]"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {currentSection.label.toUpperCase()}
          </p>
        </div>

        {/* Project selector — only shown in Studio */}
        {currentSection.id === 'studio' && projects.length > 0 && (
          <div className="px-3 py-3 border-b border-[#E8E3DB]">
            <p className="text-[9px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-1.5 px-1">
              Project
            </p>
            <div className="relative" ref={projectDropRef}>
              <button
                onClick={() => setShowProject(v => !v)}
                className="w-full flex items-center gap-1.5 px-2.5 py-2 border border-[#E8E3DB] hover:border-[#C9C3BB] text-[11px] text-left transition-colors bg-[#F9F7F4]"
                data-testid="project-selector"
              >
                <Gamepad2 size={10} className="text-[#4ECDC4] shrink-0" />
                <span className="flex-1 truncate text-[#1C1917] font-medium">
                  {selectedProject?.name || 'Select…'}
                </span>
                <ChevronDown size={10} className={`text-[#A8A29E] transition-transform shrink-0 ${showProject ? 'rotate-180' : ''}`} />
              </button>
              {showProject && (
                <div className="absolute z-50 left-0 right-0 mt-0.5 bg-white border border-[#E8E3DB] shadow-lg overflow-hidden" data-testid="project-dropdown">
                  {projects.map(p => (
                    <button
                      key={p.slug}
                      onClick={() => { selectProject(p); setShowProject(false); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-left transition-colors ${
                        selectedProject?.slug === p.slug
                          ? 'bg-[#1C1917] text-white'
                          : 'text-[#78716C] hover:bg-[#F9F7F4] hover:text-[#1C1917]'
                      }`}
                      data-testid={`project-option-${p.slug}`}
                    >
                      <span className="flex-1 truncate">{p.name}</span>
                      {selectedProject?.slug === p.slug && <Check size={10} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-items */}
        <nav className="flex-1 py-2" data-testid="sidebar-nav">
          {currentSection.items?.map(item => {
            if (!isVisible(item)) return null;
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            const disabled = item.requiresProject && !selectedProject;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!disabled) { setActiveTab(item.id); setMobileOpen(false); }
                }}
                disabled={disabled}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors border-l-2 ${
                  isActive
                    ? 'border-[#4ECDC4] bg-[#4ECDC4]/5 text-[#1C1917] font-semibold'
                    : disabled
                      ? 'border-transparent text-[#C9C3BB] cursor-not-allowed'
                      : 'border-transparent text-[#78716C] hover:text-[#1C1917] hover:bg-[#F9F7F4]'
                }`}
                data-testid={`sidebar-nav-${item.id}`}
              >
                <Icon size={13} className={isActive ? 'text-[#4ECDC4]' : disabled ? 'text-[#D6D3D1]' : 'text-[#A8A29E]'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info at bottom of section panel */}
        <div className="border-t border-[#E8E3DB] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#4ECDC4]/15 flex items-center justify-center text-[10px] font-bold text-[#4ECDC4] shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#1C1917] truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.username}
              </p>
              <p className="text-[9px] text-[#A8A29E]">
                {user?.is_super_admin ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Mobile overlay nav ──────────────────────────────────────────────────────

  const MobileNav = () => (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex h-full shadow-2xl">
            {/* Icon strip */}
            <div className="w-14 bg-[#111110] flex flex-col items-center py-4 gap-1">
              <div className="mb-3 text-[#4ECDC4] text-[10px] font-black" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VG</div>
              {SECTIONS.filter(canSeeSection).map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`w-full flex flex-col items-center gap-1 py-3 px-1 transition-colors ${isActive ? 'text-[#4ECDC4]' : 'text-[#52525B]'}`}
                  >
                    <Icon size={16} />
                    <span className="text-[8px] font-semibold">{section.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-items panel */}
            {currentSection && !currentSection.directTab && (
              <div className="w-44 bg-white flex flex-col">
                <div className="px-4 py-4 border-b border-[#E8E3DB] flex items-center justify-between">
                  <p className="text-xs font-black text-[#1C1917]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                    {currentSection.label.toUpperCase()}
                  </p>
                  <button onClick={() => setMobileOpen(false)} className="text-[#A8A29E]"><X size={14} /></button>
                </div>
                {currentSection.id === 'studio' && projects.length > 0 && (
                  <div className="px-3 py-2 border-b border-[#E8E3DB]">
                    <select
                      value={selectedProject?.slug || ''}
                      onChange={e => { const p = projects.find(x => x.slug === e.target.value); if (p) selectProject(p); }}
                      className="w-full text-[10px] border border-[#E8E3DB] px-2 py-1.5 bg-[#F9F7F4] text-[#1C1917]"
                    >
                      <option value="">Select project…</option>
                      {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                <nav className="flex-1 py-2 overflow-y-auto">
                  {currentSection.items?.map(item => {
                    if (!isVisible(item)) return null;
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    const disabled = item.requiresProject && !selectedProject;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { if (!disabled) { setActiveTab(item.id); setMobileOpen(false); } }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left border-l-2 transition-colors ${
                          isActive ? 'border-[#4ECDC4] bg-[#4ECDC4]/5 text-[#1C1917] font-semibold'
                            : disabled ? 'border-transparent text-[#C9C3BB]'
                            : 'border-transparent text-[#78716C] hover:bg-[#F9F7F4]'
                        }`}
                      >
                        <Icon size={12} className={isActive ? 'text-[#4ECDC4]' : 'text-[#A8A29E]'} />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#F9F7F4] overflow-hidden">
      {/* Mobile nav overlay */}
      <MobileNav />

      {/* Desktop: icon sidebar */}
      <div className="hidden md:flex shrink-0">
        <IconSidebar />
      </div>

      {/* Right side: header + section panel + content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-12 shrink-0 bg-white border-b border-[#E8E3DB] flex items-center px-4 gap-3 z-20">
          {/* Mobile burger */}
          <button
            className="md:hidden p-1.5 text-[#78716C] hover:text-[#1C1917] transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={17} />
          </button>

          {/* Mobile brand */}
          <span className="md:hidden text-sm font-black tracking-[0.14em] text-[#1C1917]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            VAKAR GAMES
          </span>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-[#A8A29E]">
            <span className="font-semibold text-[#78716C]">{currentSection?.label}</span>
            {currentItem && currentSection && !currentSection.directTab && (
              <>
                <ChevronRight size={11} />
                <span className="text-[#1C1917] font-semibold">{currentItem.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Top right actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden md:flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors px-2 py-1.5 hover:bg-[#F9F7F4]"
            >
              <Home size={13} /> Site
            </Link>
            <div className="w-px h-4 bg-[#E8E3DB] hidden md:block" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4]">
                {initials}
              </div>
              <span className="hidden md:block text-xs font-semibold text-[#1C1917]">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.username}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-[#78716C] hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Sign out"
              data-testid="logout-button"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Below header: section panel + content */}
        <div className="flex flex-1 min-h-0">

          {/* Section panel */}
          <div className="hidden md:block shrink-0">
            <SectionPanel />
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 md:p-8">

              {activeTab === 'overview'       && <DashboardOverview setActiveTab={setActiveTab} />}
              {activeTab === 'projects'       && <ProjectManagement />}
              {activeTab === 'users'          && hasPermission('manage_users')    && <UserManagement />}
              {activeTab === 'api'            && hasPermission('view_api_docs')   && <ApiEndpoints />}
              {activeTab === 'vps'            && hasPermission('manage_users')    && <VpsStats />}

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
                    Choose a project from the Studio panel to access its data.
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

              {activeTab === 'send-items' && selectedProject && hasPermission('send_items')                                          && <SendItems />}
              {activeTab === 'status'     && selectedProject && hasPermission('change_status')                                       && <ServerStatus />}
              {activeTab === 'variables'  && selectedProject && hasPermission('view_variables')                                      && <VariablesManagement />}
              {activeTab === 'logs'       && selectedProject && hasPermission('view_logs')                                           && <LogsViewer />}
              {activeTab === 'chat'       && selectedProject && hasPermission('manage_chat')                                         && <ChatManagement />}
              {activeTab === 'missions'   && selectedProject && (hasPermission('claim_missions') || hasPermission('create_missions')) && <MissionsManagement />}
              {activeTab === 'files'      && selectedProject && hasPermission('view_projects')  && <FilesManagement />}

              {activeTab === 'website-games'    &&                               <GamesManagement />}
              {activeTab === 'website-blog'     &&                               <BlogManagement />}
              {activeTab === 'website-settings' &&                               <WebsiteSettings />}
              {activeTab === 'website-shop'     && hasPermission('manage_shop')  && <ShopManagement />}
              {activeTab === 'coupons'          && hasPermission('manage_shop')  && <CouponManagement />}
              {activeTab === 'support'          && hasPermission('manage_tickets') && <TicketManagement />}
              {activeTab === 'account'          && <AccountSettings />}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export const Dashboard = () => (
  <ProjectProvider>
    <DashboardContent />
  </ProjectProvider>
);
