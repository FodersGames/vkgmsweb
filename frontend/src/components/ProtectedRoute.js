import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, permission, requiresAdmin }) => {
  const { user, loading, hasPermission, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="text-[#6E6E73] text-sm">Loading…</div>
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="max-w-md p-8 border border-[#D2D2D7] bg-white text-center">
          <h2 className="text-2xl font-bold mb-2 text-[#1D1D1F]">Access Denied</h2>
          <p className="text-[#6E6E73] text-sm">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};