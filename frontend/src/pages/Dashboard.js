import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Package, Activity, FileText, Database, LogOut, Code } from 'lucide-react';
import { UserManagement } from '../components/UserManagement';
import { SendItems } from '../components/SendItems';
import { ServerStatus } from '../components/ServerStatus';
import { LogsViewer } from '../components/LogsViewer';
import { VariablesManagement } from '../components/VariablesManagement';
import { ApiEndpoints } from '../components/ApiEndpoints';

const tabColors = {
  'send-items': { gradient: 'from-[#F2994A] to-[#EB5757]', text: '#F2994A' },
  'status': { gradient: 'from-[#27AE60] to-[#219653]', text: '#27AE60' },
  'variables': { gradient: 'from-[#2F80ED] to-[#2D9CDB]', text: '#2F80ED' },
  'logs': { gradient: 'from-[#9B51E0] to-[#BB6BD9]', text: '#9B51E0' },
  'users': { gradient: 'from-[#F2994A] to-[#F2C94C]', text: '#F2994A' },
  'api': { gradient: 'from-[#4F4F4F] to-[#828282]', text: '#4F4F4F' }
};

export const Dashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('send-items');

  useEffect(() => {
    if (!hasPermission('send_items') && hasPermission('manage_users')) {
      setActiveTab('users');
    } else if (!hasPermission('send_items') && hasPermission('view_logs')) {
      setActiveTab('logs');
    } else if (!hasPermission('send_items') && hasPermission('manage_variables')) {
      setActiveTab('variables');
    }
    // eslint-disable-next-line
  }, [user]);

  const menuItems = [
    { id: 'send-items', label: 'Send Items', icon: Package, permission: 'send_items' },
    { id: 'status', label: 'Server Status', icon: Activity, permission: 'change_status' },
    { id: 'variables', label: 'Variables', icon: Database, permission: 'manage_variables' },
    { id: 'logs', label: 'Logs', icon: FileText, permission: 'view_logs' },
    { id: 'users', label: 'Users', icon: Users, permission: 'manage_users' },
  ];

  if (user?.is_super_admin) {
    menuItems.push({ id: 'api', label: 'API Endpoints', icon: Code, permission: null });
  }

  const visibleMenuItems = menuItems.filter(item => !item.permission || hasPermission(item.permission));

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

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-1" data-testid="sidebar-nav">
          {visibleMenuItems.map((item) => {
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
          })}
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
              <span className="text-[10px] font-medium text-[#8A8A9A]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>v1.0.4</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-[#EDE5DB] px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tabColors[activeTab]?.gradient || 'from-[#F2994A] to-[#EB5757]'} flex items-center justify-center shadow-sm`}>
              {(() => {
                const ActiveIcon = visibleMenuItems.find(item => item.id === activeTab)?.icon || Package;
                return <ActiveIcon size={15} className="text-white" />;
              })()}
            </div>
            <h2 className="text-xl font-bold text-[#1A1A2E]" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {visibleMenuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
            </h2>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {activeTab === 'send-items' && hasPermission('send_items') && <SendItems />}
          {activeTab === 'status' && hasPermission('change_status') && <ServerStatus />}
          {activeTab === 'variables' && hasPermission('manage_variables') && <VariablesManagement />}
          {activeTab === 'logs' && hasPermission('view_logs') && <LogsViewer />}
          {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
          {activeTab === 'api' && user?.is_super_admin && <ApiEndpoints />}
        </div>
      </main>
    </div>
  );
};
