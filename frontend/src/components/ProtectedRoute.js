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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] p-6 text-center text-white">
        <div className="max-w-md w-full bg-[#16161F] border border-white/10 rounded-2xl p-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400 text-lg font-bold">
            !
          </div>
          <h2 className="text-xl font-bold mb-2">Accès Administrateur Requis</h2>
          <p className="text-xs text-white/50 mb-6 leading-relaxed">
            Votre compte actuel ({user?.email}) ne dispose pas des droits administrateur nécessaires pour accéder à l'admin panel.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="#/profile" className="btn-kefir text-xs py-2 px-4">
              Mon Profil
            </a>
            <a href="#/login" className="text-xs text-white/60 hover:text-white py-2 px-4 border border-white/15 rounded">
              Changer de compte
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="rounded-xl max-w-md p-8 border border-[#D2D2D7] bg-white text-center">
          <h2 className="text-2xl font-bold mb-2 text-[#1D1D1F]">Access Denied</h2>
          <p className="text-[#6E6E73] text-sm">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};