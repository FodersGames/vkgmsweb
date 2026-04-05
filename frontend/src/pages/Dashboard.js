import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Copy, Users, Package, ActivityIcon, FileText, Power } from '@phosphor-icons/react';
import { UserManagement } from '../components/UserManagement';
import { SendItems } from '../components/SendItems';
import { ServerStatus } from '../components/ServerStatus';
import { LogsViewer } from '../components/LogsViewer';
import { ApiEndpoints } from '../components/ApiEndpoints';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const Dashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('send-items');

  useEffect(() => {
    // Set default tab based on permissions
    if (!hasPermission('send_items') && hasPermission('manage_users')) {
      setActiveTab('users');
    } else if (!hasPermission('send_items') && hasPermission('view_logs')) {
      setActiveTab('logs');
    }
  }, [user]);

  const tabs = [
    { id: 'send-items', label: 'Send Items', icon: Package, permission: 'send_items' },
    { id: 'status', label: 'Server Status', icon: ActivityIcon, permission: 'change_status' },
    { id: 'logs', label: 'Logs', icon: FileText, permission: 'view_logs' },
    { id: 'users', label: 'User Management', icon: Users, permission: 'manage_users' },
    { id: 'api', label: 'API Endpoints', icon: Copy, permission: null },
  ];

  const visibleTabs = tabs.filter(tab => !tab.permission || hasPermission(tab.permission));

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://static.prod-images.emergentagent.com/jobs/f4da9165-836d-4ccd-bb4d-66097fd9ce9d/images/7959d5bfda4904e20ed02658ab39cf2916576428116ff2ceb76690c434011089.png" 
              alt="Logo" 
              className="h-10 w-10"
            />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-neutral-950"
                  style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
                ADMIN DASHBOARD
              </h1>
              <p className="text-xs text-neutral-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                {user?.username} {user?.is_super_admin && '(Super Admin)'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-300 hover:bg-neutral-100 transition-all duration-200"
            data-testid="logout-button"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            <Power size={16} />
            LOGOUT
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-neutral-300">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1" data-testid="dashboard-nav">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-neutral-950 text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                  data-testid={`tab-${tab.id}`}
                  style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                >
                  <Icon size={18} weight="bold" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'send-items' && hasPermission('send_items') && <SendItems />}
        {activeTab === 'status' && hasPermission('change_status') && <ServerStatus />}
        {activeTab === 'logs' && hasPermission('view_logs') && <LogsViewer />}
        {activeTab === 'users' && hasPermission('manage_users') && <UserManagement />}
        {activeTab === 'api' && <ApiEndpoints />}
      </main>
    </div>
  );
};