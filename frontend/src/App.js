import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import Home from './pages/Home';
import GamesPage from './pages/Games';
import { BlogList, BlogPost } from './pages/Blog';
import MaintenancePage, { useMaintenanceCheck } from './pages/Maintenance';
import { Toaster } from './components/ui/sonner';
import './App.css';

const AppRoutes = () => {
  const { maintenance, checked } = useMaintenanceCheck();
  const location = useLocation();

  if (!checked) return null;

  const adminPaths = ['/login', '/dashboard'];
  const isAdmin = adminPaths.some(p => location.pathname.startsWith(p));

  if (maintenance && !isAdmin) {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/blog" element={<BlogList />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
