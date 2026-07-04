import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, permission, requiresAdmin }) => {
  const { user, loading, hasPermission, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F7F4]">
        <div className="text-[#78716C] text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiresAdmin && !isAdmin()) {
    return <Navigate to="/profile" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F7F4]">
        <div className="max-w-md p-8 border border-[#E8E3DB] bg-white text-center">
          <h2 className="text-2xl font-bold mb-2 text-[#1C1917]">Access Denied</h2>
          <p className="text-[#78716C] text-sm">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};