import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import Home from './pages/Home';
import GamesPage from './pages/Games';
import { BlogList, BlogPost } from './pages/Blog';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Shop from './pages/Shop';
import ShopSuccess from './pages/ShopSuccess';
import GameShop from './pages/GameShop';
import Profile from './pages/Profile';
import MaintenancePage, { useMaintenanceCheck } from './pages/Maintenance';
import { Toaster } from './components/ui/sonner';
import { CookieBanner } from './components/CookieBanner';
import './App.css';

const NotFound = () => (
  <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 text-center">
    <div>
      <p className="text-8xl font-black text-[#4ECDC4] mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>404</p>
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-[#71717a] mb-8">This page doesn't exist or has been moved.</p>
      <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[#4ECDC4] text-[#0a0a0f] rounded-xl font-semibold hover:bg-[#45b8b0] transition-all">
        Back to homepage
      </a>
    </div>
  </div>
);

const AppRoutes = () => {
  const { maintenance, checked } = useMaintenanceCheck();
  const location = useLocation();

  if (!checked) return null;

  const adminPaths = ['/login', '/dashboard', '/privacy', '/terms', '/shop', '/profile'];
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
      <Route path="/shop" element={<Shop />} />
      <Route path="/shop/success" element={<ShopSuccess />} />
      <Route path="/shop/:gameSlug" element={<GameShop />} />
      <Route path="/shop/:gameSlug/success" element={<ShopSuccess legacy />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/dashboard" element={<ProtectedRoute requiresAdmin><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <CookieBanner />
          </BrowserRouter>
          <Toaster position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
