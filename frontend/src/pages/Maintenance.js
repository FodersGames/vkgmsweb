import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLocation, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { getWebsiteSettings } from '../utils/publicCache';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

// Fixed to the viewport (h-screen, not min-h-screen) with the top/footer
// bars pinned via shrink-0 and only the middle section allowed to flex —
// guarantees the whole page fits on screen with no page-level scroll. Wide
// (max-w-4xl) with the icon and text side by side instead of stacked, so
// it reads as a wide card, not a narrow column you have to scroll to read.
const MaintenancePage = ({ announcement }) => (
  <div className="relative h-screen flex flex-col bg-[#0D0D0D] text-white overflow-hidden [contain:paint]">
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 dot-grid opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-[#FF6600]/10 blur-[130px]" />
    </div>

    {/* Top bar */}
    <div className="px-6 py-4 shrink-0 border-b border-white/10 bg-[#121212]/80 backdrop-blur">
      <span className="text-[17px] font-black uppercase tracking-wider text-white">
        Vakar Games
      </span>
    </div>

    {/* Main content */}
    <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-6">
      <div className="w-full max-w-2xl bg-[#121212] border border-white/12 p-8 sm:p-12 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 text-center sm:text-left">
          <div className="w-14 h-14 shrink-0 rounded-full bg-[#FF6600]/10 border border-[#FF6600]/30 flex items-center justify-center text-[#FF6600]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-3">
              Under Maintenance
            </h1>

            <p className="text-white/60 leading-relaxed text-sm">
              {announcement || "We're currently performing improvements to enhance your experience. We'll be back very soon — thank you for your patience!"}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-xs font-mono text-[#FF6600] uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-[#FF6600] animate-pulse" />
                <span>Work in progress</span>
              </div>
              <a
                href="mailto:support@vakargames.com"
                className="text-xs text-white/50 hover:text-[#FF6600] underline transition-colors"
              >
                support@vakargames.com
              </a>
              <Link
                to="/login"
                className="btn-kefir text-xs py-2 px-4 inline-flex items-center gap-2"
              >
                <LogIn size={13} />
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="liquid-glass rounded-none px-6 py-3 text-center shrink-0">
      <p className="text-xs text-[#1D1D1F]/70 font-medium">© {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
    </div>
  </div>
);

// Non-dismissible on purpose — everyone gets swapped to the maintenance
// page the instant it's due regardless of what they were doing, so this is
// meant to be seen, not brushed past. Ticks its own countdown locally
// between polls so it reads as genuinely live.
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
    <div className="sticky top-0 z-[200] px-4 py-2.5 bg-[#F2994A] text-white text-center text-xs font-semibold flex items-center justify-center gap-2 flex-wrap">
      <span>
        🛠️ Scheduled maintenance in {mm}:{String(ss).padStart(2, '0')}
        {announcement ? ` — ${announcement}` : ''} — save your work now.
      </span>
    </div>
  );
};

export const useMaintenanceCheck = () => {
  const [state, setState] = useState({ maintenance: false, scheduledAt: null, announcement: '' });
  const [checked, setChecked] = useState(true);
  const location = useLocation();

  const bypassPaths = ['/login', '/dashboard', '/terms', '/privacy'];
  const bypassed = bypassPaths.some(p => location.pathname.startsWith(p));

  const check = useCallback(() => {
    if (bypassed) {
      setChecked(true);
      setState({ maintenance: false, scheduledAt: null, announcement: '' });
      return;
    }
    getWebsiteSettings()
      .then(data => {
        setState({
          maintenance: !!data.maintenance_mode,
          scheduledAt: data.maintenance_scheduled_at || null,
          announcement: data.maintenance_announcement || '',
        });
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [bypassed]);

  useEffect(() => { check(); }, [check]);

  // Independent of navigation — a visitor sitting still on one page (not
  // clicking anything) still needs to get swapped to the maintenance page
  // the instant it's due, not just next time they navigate. Polls faster
  // while a countdown is actually running so both the banner and the
  // eventual cutover stay accurate; otherwise a slow background check is
  // enough to notice a maintenance newly scheduled while browsing.
  useEffect(() => {
    if (bypassed) return undefined;
    const intervalMs = (state.scheduledAt && !state.maintenance) ? 5000 : 60000;
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [bypassed, state.scheduledAt, state.maintenance, check]);

  return { ...state, checked };
};

export default MaintenancePage;
