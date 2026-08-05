import React from 'react';
import { IconContext } from '@phosphor-icons/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import Home from './pages/Home';
import ApplicationsPage from './pages/Applications';
import { BlogList, BlogPost } from './pages/Blog';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Shop from './pages/Shop';
import ShopSuccess from './pages/ShopSuccess';
import GameShop from './pages/GameShop';
import Profile from './pages/Profile';
import Contact from './pages/Contact';
import Careers from './pages/Careers';
import StudioAppView from './pages/StudioAppView';
import VakarPlus from './pages/VakarPlus';
import MyApps from './pages/MyApps';
import ChoosePseudo from './pages/ChoosePseudo';
import MaintenancePage, { useMaintenanceCheck } from './pages/Maintenance';
import { Toaster } from './components/ui/sonner';
import { CookieBanner } from './components/CookieBanner';
import './App.css';

const NotFound = () => (
  <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6 text-center">
    <div>
      <p className="text-8xl font-black text-[#1D1D1F] mb-2">404</p>
      <h1 className="text-xl font-bold text-[#1D1D1F] mb-2">Page not found</h1>
      <p className="text-sm text-[#6E6E73] mb-8">This page doesn't exist or has been moved.</p>
      <a href="/" className="rounded-full inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white text-sm font-semibold transition-colors">
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
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/games" element={<Navigate to="/applications" replace />} />
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
        <Route path="/play" element={<Navigate to="/my-apps" replace />} />
        <Route path="/apps/:appId" element={<StudioAppView />} />
        <Route path="/vakar-plus" element={<VakarPlus />} />
        <Route path="/my-apps" element={<MyApps />} />
        <Route path="/choose-pseudo" element={<ChoosePseudo />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/dashboard" element={<ProtectedRoute requiresAdmin><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <ErrorBoundary>
      {/* Phosphor's default weight for the whole app — public pages use it for
          every icon; the admin dashboard keeps lucide-react untouched. */}
      <IconContext.Provider value={{ weight: 'regular' }}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
              <CookieBanner />
            </BrowserRouter>
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </IconContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
