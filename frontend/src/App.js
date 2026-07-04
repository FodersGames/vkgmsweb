import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Contact from './pages/Contact';
import VakarPlay from './pages/VakarPlay';
import MaintenancePage, { useMaintenanceCheck } from './pages/Maintenance';
import { Toaster } from './components/ui/sonner';
import { CookieBanner } from './components/CookieBanner';
import './App.css';

const NotFound = () => (
  <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-6 text-center">
    <div>
      <p className="text-8xl font-black text-[#1C1917] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>404</p>
      <h1 className="text-xl font-bold text-[#1C1917] mb-2">Page not found</h1>
      <p className="text-sm text-[#78716C] mb-8">This page doesn't exist or has been moved.</p>
      <a href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C1917] hover:bg-[#2D2926] text-white text-sm font-semibold transition-colors">
        Back to homepage
      </a>
    </div>
  </div>
);

const AppRoutes = () => {
  const { maintenance, checked } = useMaintenanceCheck();

  if (!checked) return null;

  if (maintenance) {
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
      <Route path="/contact" element={<Contact />} />
      <Route path="/play" element={<VakarPlay />} />
      <Route path="/careers" element={<Navigate to="/" replace />} />
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
