import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLocation, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { getWebsiteSettings } from '../utils/publicCache';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const MaintenancePage = ({ announcement }) => (
  <div className="relative h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F] overflow-hidden">
    {/* Top bar */}
    <div className="px-6 py-4 shrink-0 border-b border-[#E5E5EA] bg-white/80 backdrop-blur flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Vakar Games" className="h-5 w-auto" />
        <span className="text-sm font-semibold tracking-tight text-[#1D1D1F]">
          Vakar Games
        </span>
      </div>
      <Link
        to="/login"
        className="btn-apple text-xs !py-1.5 !px-3"
      >
        <LogIn size={13} className="mr-1.5" />
        Staff Sign In
      </Link>
    </div>

    {/* Main content */}
    <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-[#E5E5EA] p-8 sm:p-12 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
              Under Maintenance
            </h1>

            <p className="text-[#6E6E73] leading-relaxed text-sm">
              {announcement || "We're currently performing system improvements. We'll be back very soon. Thank you for your patience!"}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F7] rounded-lg border border-[#E5E5EA] text-xs text-[#1D1D1F] font-medium">
                <div className="w-2 h-2 rounded-full bg-[#FF6600] animate-pulse" />
                <span>Work in progress</span>
              </div>
              <a
                href="mailto:support@vakargames.com"
                className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors"
              >
                support@vakargames.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="px-6 py-3 text-center shrink-0 border-t border-[#E5E5EA] bg-white">
      <p className="text-xs text-[#86868B]">© {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
    </div>
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
      const isMaint = !!data?.maintenance_active;
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
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [check, pathname]);

  return status;
};

export default MaintenancePage;
