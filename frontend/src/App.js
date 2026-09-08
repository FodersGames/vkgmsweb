import React from 'react';
import { IconContext } from '@phosphor-icons/react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import MaintenancePage, { useMaintenanceCheck, MaintenanceCountdownBanner } from './pages/Maintenance';
import { Toaster } from './components/ui/sonner';
import { CookieBanner } from './components/CookieBanner';
import './App.css';

const NotFound = () => (
  <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-6 text-center text-white">
    <div>
      <p className="text-8xl font-black text-white/20 mb-2">404</p>
      <h1 className="text-xl font-bold uppercase tracking-wide text-white mb-2">Page not found</h1>
      <p className="text-sm text-white/40 mb-8">This page doesn't exist or has been moved.</p>
      <a href="/" className="btn-kefir">
        Back to homepage
      </a>
    </div>
  </div>
);

const AppRoutes = () => {
  const { maintenance, scheduledAt, announcement } = useMaintenanceCheck();

  if (maintenance) {
    return <MaintenancePage announcement={announcement} />;
  }

  return (
    <>
      <MaintenanceCountdownBanner scheduledAt={scheduledAt} announcement={announcement} />
      <Routes>
        {/* Main studio showcase routes */}
        <Route path="/" element={<Home />} />
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
