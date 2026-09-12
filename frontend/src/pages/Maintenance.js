import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLocation, Link } from 'react-router-dom';
import { getWebsiteSettings } from '../utils/publicCache';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const MaintenancePage = ({ announcement }) => (
  <div className="min-h-screen bg-white text-[#1D1D1F] flex flex-col justify-between p-6 sm:p-10 antialiased selection:bg-[#FF6600]/20 selection:text-[#FF6600]">
    {/* Minimal Header */}
    <header className="w-full max-w-[1040px] mx-auto flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2.5 group">
        <img src="/logo.png" alt="Vakar Games" className="h-5 w-auto object-contain transition-transform group-hover:scale-105" />
        <span className="font-semibold text-sm tracking-tight text-[#1D1D1F]">
          Vakar Games
        </span>
      </Link>

      <Link
        to="/login"
        className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
      >
        Staff Portal
      </Link>
    </header>

    {/* Center Message */}
    <main className="w-full max-w-xl mx-auto py-16 text-center">
      <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#1D1D1F] mb-4">
        Scheduled Maintenance.
      </h1>

      <p className="text-[#6E6E73] text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-8 font-normal">
        {announcement ||
          "We are currently performing routine system improvements. The platform will be back online shortly."}
      </p>

      {/* Action shortcuts */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
        <Link
          to="/status"
          className="inline-flex items-center gap-1.5 text-[#1D1D1F] hover:text-[#FF6600] transition-colors"
        >
          <span>Check System Status</span>
          <span>→</span>
        </Link>
        <span className="text-[#D2D2D7]">·</span>
        <a
          href="mailto:support@vakargames.com"
          className="text-[#86868B] hover:text-[#1D1D1F] transition-colors"
        >
          support@vakargames.com
        </a>
      </div>
    </main>

    {/* Clean Apple Footer with accessible Legal links */}
    <footer className="w-full max-w-[1040px] mx-auto pt-6 border-t border-[#F5F5F7] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#86868B]">
      <p>© {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
      <div className="flex items-center gap-5">
        <Link to="/privacy" className="hover:text-[#1D1D1F] transition-colors">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:text-[#1D1D1F] transition-colors">
          Terms of Service
        </Link>
        <Link to="/status" className="hover:text-[#1D1D1F] transition-colors">
          System Status
        </Link>
      </div>
    </footer>
  </div>
);

export const MaintenanceCountdownBanner = ({ scheduledAt, announcement }) => {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!scheduledAt) return undefined;
    const id = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  if (!scheduledAt) return null;
  const remainingMs = new Date(scheduledAt).getTime() - Date.now();
  if (remainingMs <= 0) return null;
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;

  return (
    <div className="sticky top-0 z-[200] px-4 py-2 bg-[#FF6600] text-white text-center text-xs font-medium flex items-center justify-center gap-2 flex-wrap shadow-sm">
      <span>
        Scheduled maintenance in {mm}:{String(ss).padStart(2, '0')}
      </span>
      {announcement && <span className="opacity-80">· {announcement}</span>}
    </div>
  );
};

export const useMaintenanceCheck = () => {
  const { pathname } = useLocation();
  const [status, setStatus] = useState({
    maintenance: false,
    scheduledAt: null,
    announcement: '',
  });

  const check = useCallback(async () => {
    try {
      const data = await getWebsiteSettings();
      const isMaint = !!(data?.maintenance_mode || data?.maintenance_active);
      const scheduled = data?.maintenance_scheduled_at ? new Date(data.maintenance_scheduled_at) : null;
      setStatus({
        maintenance: isMaint,
        scheduledAt: scheduled && scheduled > new Date() ? scheduled.toISOString() : null,
        announcement: data?.maintenance_announcement || '',
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [check, pathname]);

  return status;
};

export default MaintenancePage;
