import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, permission }) => {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-neutral-950 font-mono text-sm">LOADING...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md p-8 border border-neutral-950 bg-white">
          <h2 className="text-2xl font-bold mb-4 text-neutral-950">ACCESS DENIED</h2>
          <p className="text-neutral-700">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};