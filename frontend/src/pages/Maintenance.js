import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import cloudSunrise from '../assets/photos/cloud-sunrise.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MaintenancePage = () => (
  <div className="relative min-h-screen flex flex-col bg-[#F5F5F7] overflow-hidden [contain:paint]">
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <img src={cloudSunrise} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-[#F5F5F7]/78" />
    </div>

    {/* Top bar */}
    <div className="bg-white/80 backdrop-blur-sm border-b border-[#D2D2D7] px-6 py-4">
      <span className="font-display text-[18px] font-medium tracking-tight text-[#1D1D1F]">
        Vakar Games
      </span>
    </div>

    {/* Main content */}
    <div className="flex-1 flex items-center justify-center px-6 py-20">
      <div className="text-center max-w-lg">
        {/* Icon */}
        <div className="rounded-lg w-14 h-14 mx-auto mb-8 bg-white border border-[#D2D2D7] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1
          className="font-display text-5xl sm:text-7xl font-medium tracking-[-0.01em] text-[#1D1D1F] mb-4 leading-none"
        >
          Under<br />maintenance
        </h1>

        <p className="text-[#6E6E73] mb-2 leading-relaxed">
          We're currently performing improvements to enhance your experience.
        </p>
        <p className="text-[#6E6E73] leading-relaxed">
          We'll be back very soon — thank you for your patience!
        </p>

        <div className="mt-10 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-white border border-[#D2D2D7]">
          <div className="w-2 h-2 rounded-full bg-[#4ECDC4] animate-pulse" />
          <span className="text-xs font-semibold text-[#A1A1A6] tracking-[0.12em] uppercase">Work in progress</span>
        </div>

        <div className="mt-6">
          <a
            href="mailto:support@vakargames.com"
            className="text-xs text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors"
          >
            support@vakargames.com
          </a>
        </div>

        <div className="mt-10 pt-8 border-t border-[#D2D2D7]">
          <Link
            to="/login"
            className="rounded-full inline-flex items-center gap-2 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] bg-white px-4 py-2.5 transition-all"
          >
            <LogIn size={12} />
            Sign in
          </Link>
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="border-t border-[#D2D2D7] px-6 py-4 text-center">
      <p className="text-xs text-[#BFBFC4]">© {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
    </div>
  </div>
);

export const useMaintenanceCheck = () => {
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const bypassPaths = ['/login', '/dashboard', '/terms', '/privacy'];
    if (bypassPaths.some(p => location.pathname.startsWith(p))) {
      setChecked(true);
      setMaintenance(false);
      return;
    }
    axios.get(`${API_URL}/api/website/settings`)
      .then(r => {
        setMaintenance(r.data.maintenance_mode);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [location.pathname]);

  return { maintenance, checked };
};

export default MaintenancePage;
