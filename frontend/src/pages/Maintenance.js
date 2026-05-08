import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MaintenancePage = () => (
  <div className="bg-[#0a0a0f] text-white min-h-screen flex items-center justify-center" style={{ fontFamily: "'Inter', sans-serif" }}>
    <div className="text-center px-6">
      <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-[#F2994A]/10 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#F2994A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
        UNDER MAINTENANCE
      </h1>
      <p className="text-lg text-white/50 max-w-md mx-auto mb-2">
        We're currently performing some updates to improve your experience.
      </p>
      <p className="text-lg text-white/50 max-w-md mx-auto">
        Please check back soon!
      </p>
      <div className="mt-10 inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
        <div className="w-2 h-2 rounded-full bg-[#F2994A] animate-pulse"></div>
        <span className="text-xs text-white/40 font-medium tracking-wider uppercase">Work in progress</span>
      </div>
    </div>
  </div>
);

export const useMaintenanceCheck = () => {
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Only check for public pages, not admin pages
    const adminPaths = ['/login', '/dashboard'];
    if (adminPaths.some(p => location.pathname.startsWith(p))) {
      setChecked(true);
      setMaintenance(false);
      return;
    }
    axios.get(`${API_URL}/api/website/settings`).then(r => {
      setMaintenance(r.data.maintenance_mode);
      setChecked(true);
    }).catch(() => setChecked(true));
  }, [location.pathname]);

  return { maintenance, checked };
};

export default MaintenancePage;
