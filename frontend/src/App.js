import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import Home from './pages/Home';
import GamesPage from './pages/Games';
import { BlogList, BlogPost } from './pages/Blog';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Shop from './pages/Shop';
import ShopSuccess from './pages/ShopSuccess';
import MaintenancePage, { useMaintenanceCheck } from './pages/Maintenance';
import { Toaster } from './components/ui/sonner';
import './App.css';

const AppRoutes = () => {
  const { maintenance, checked } = useMaintenanceCheck();
  const location = useLocation();

  if (!checked) return null;

  const adminPaths = ['/login', '/dashboard', '/privacy', '/terms', '/shop'];
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
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/shop/:gameSlug" element={<Shop />} />
      <Route path="/shop/:gameSlug/success" element={<ShopSuccess />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
