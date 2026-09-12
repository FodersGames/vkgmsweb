import React from 'react';
import { IconContext } from '@phosphor-icons/react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Profile from './pages/Profile';
import Contact from './pages/Contact';
import Careers from './pages/Careers';
import StatusPage from './pages/StatusPage';
import MaintenancePage, { useMaintenanceCheck } from './pages/Maintenance';
import { SiteTopBanner } from './components/SiteTopBanner';
import { Toaster } from './components/ui/sonner';
import { CookieBanner } from './components/CookieBanner';
import './App.css';

const NotFound = () => (
  <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center text-[#1D1D1F]">
    <div>
      <p className="text-8xl font-black text-[#1D1D1F]/15 mb-2">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F] mb-2">Page not found</h1>
      <p className="text-sm text-[#6E6E73] mb-8">This page doesn't exist or has been moved.</p>
      <a href="/" className="btn-apple">
        Back to homepage
      </a>
    </div>
  </div>
);

const AppRoutes = () => {
  const { maintenance, announcement } = useMaintenanceCheck();
  const location = useLocation();

  const isAdminSubdomain = typeof window !== 'undefined' && (
    window.location.hostname === 'admin.vakargames.com' ||
    window.location.hostname.startsWith('admin.')
  );

  const isStatusPage = location.pathname === '/status' || location.pathname.startsWith('/status');

  if (maintenance && !isAdminSubdomain && !isStatusPage) {
    return <MaintenancePage announcement={announcement} />;
  }

  return (
    <>
      <SiteTopBanner />
      <Routes>
        {/* Main studio showcase routes */}
        <Route path="/" element={isAdminSubdomain ? <Navigate to="/dashboard" replace /> : <Home />} />
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        {/* User & Admin */}
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/dashboard" element={<ProtectedRoute requiresAdmin><Dashboard /></ProtectedRoute>} />

        {/* Legacy redirects */}
        <Route path="/applications" element={<Navigate to="/games" replace />} />
        <Route path="/apps/:appId" element={<Navigate to="/games" replace />} />
        <Route path="/play" element={<Navigate to="/games" replace />} />
        <Route path="/shop" element={<Navigate to="/games" replace />} />
        <Route path="/shop/*" element={<Navigate to="/games" replace />} />
        <Route path="/vakar-plus" element={<Navigate to="/" replace />} />
        <Route path="/my-apps" element={<Navigate to="/" replace />} />
        <Route path="/choose-pseudo" element={<Navigate to="/" replace />} />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <IconContext.Provider value={{ weight: 'regular' }}>
        <ThemeProvider>
          <AuthProvider>
            <HashRouter>
              <AppRoutes />
              <CookieBanner />
            </HashRouter>
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </IconContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
