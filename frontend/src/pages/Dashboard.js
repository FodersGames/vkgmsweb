import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Package, ActivityIcon, FileText, Database, LogOut } from 'lucide-react';
import { UserManagement } from '../components/UserManagement';
import { SendItems } from '../components/SendItems';
import { ServerStatus } from '../components/ServerStatus';
import { LogsViewer } from '../components/LogsViewer';
import { VariablesManagement } from '../components/VariablesManagement';
import { ApiEndpoints } from '../components/ApiEndpoints';
import { toast } from 'sonner';

export const Dashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('send-items');

  useEffect(() => {
    // Set default tab based on permissions
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
    { id: 'status', label: 'Server Status', icon: ActivityIcon, permission: 'change_status' },
    { id: 'variables', label: 'Variables', icon: Database, permission: 'manage_variables' },
    { id: 'logs', label: 'Logs', icon: FileText, permission: 'view_logs' },
    { id: 'users', label: 'Users', icon: Users, permission: 'manage_users' },
  ];

  // Add API Endpoints only for Super Admin
  if (user?.is_super_admin) {
    menuItems.push({ id: 'api', label: 'API Endpoints', icon: FileText, permission: null });
  }

  const visibleMenuItems = menuItems.filter(item => !item.permission || hasPermission(item.permission));

  return (
    <div className="flex h-screen bg-[#FAFAFA]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#EDEBE9] flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-[#EDEBE9]">
          <h1 className="text-xl font-semibold text-[#201F1E]" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Admin Dashboard
          </h1>
          <p className="text-xs text-[#605E5C] mt-1">{user?.username}</p>
          {user?.is_super_admin && (
            <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-[#0078D4] text-white rounded-sm">
              Super Admin
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2" data-testid="sidebar-nav">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#F3F2F1] text-[#0078D4] font-medium border-l-2 border-[#0078D4]'
                    : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#201F1E]'
                }`}
                data-testid={`sidebar-nav-${item.id}`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[#EDEBE9]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#A4262C] rounded-sm transition-colors"
            data-testid="logout-button"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-[#EDEBE9] px-6 py-4">
          <h2 className="text-2xl font-semibold text-[#201F1E]" style={{ fontFamily: 'Chivo, sans-serif' }}>
            {visibleMenuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
          </h2>
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
};iv>
  );
};