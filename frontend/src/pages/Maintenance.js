import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MaintenancePage = () => (
  <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-body" style={{ background: 'linear-gradient(160deg, #F8F8F8 0%, #EFF6FC 60%, #F3F2F1 100%)' }}>
    {/* Grid wires */}
    <div className="fixed inset-0 pointer-events-none">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="maint-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(0,120,212,0.06)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#maint-grid)"/>
      </svg>
    </div>

    {/* Blue left accent */}
    <div className="fixed left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0078D4] via-[#40A9FF] to-transparent" />

    <div className="relative z-10 text-center px-6 max-w-lg">
      {/* 3D cube decoration */}
      <div className="mx-auto mb-10 iso-cube" style={{ width: 80, height: 72 }}>
        <svg width="80" height="72" viewBox="0 0 120 108" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,120,212,0.2))' }}>
          <polygon points="60,0 120,30 60,60 0,30" fill="#0078D4" opacity="0.85"/>
          <polygon points="0,30 60,60 60,104 0,74" fill="#0078D4" opacity="0.45"/>
          <polygon points="60,60 120,30 120,74 60,104" fill="#0078D4" opacity="0.25"/>
        </svg>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#EFF6FC] border border-[#C7E0F4] rounded-sm mb-6">
        <div className="w-1.5 h-1.5 rounded-full bg-[#D83B01] animate-pulse" />
        <span className="text-xs font-semibold text-[#D83B01] tracking-widest uppercase">Service Unavailable</span>
      </div>

      <h1 className="font-display font-black text-5xl md:text-6xl leading-none tracking-tight text-[#201F1E] mb-5">
        UNDER<br />MAINTENANCE
      </h1>

      <p className="text-base text-[#605E5C] leading-relaxed mb-3">
        We're performing scheduled updates to improve your experience.
      </p>
      <p className="text-base text-[#605E5C] leading-relaxed mb-10">
        Please check back soon — we'll be back online shortly.
      </p>

      {/* Status terminal */}
      <div className="text-left bg-[#1E1E1E] border border-[#3C3C3C] rounded-sm p-4 font-mono text-xs text-[#D4D4D4]">
        <p><span className="text-[#569CD6]">$</span> <span className="text-[#9CDCFE]">vakar</span> <span className="text-[#CE9178]">status --check</span></p>
        <p className="text-[#6A9955] mt-1">→ Running maintenance procedures...</p>
        <p className="text-[#CCA700]">→ ETA: Soon™</p>
        <p className="mt-1 animate-pulse"><span className="text-[#569CD6]">$</span> <span className="text-[#D4D4D4]">_</span></p>
      </div>
    </div>
  </div>
);

export const useMaintenanceCheck = () => {
  const [maintenance, setMaintenance] = useState(false);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const adminPaths = ['/login', '/dashboard'];
    if (adminPaths.some(p => location.pathname.startsWith(p))) {
      setChecked(true);
      setMaintenance(false);
      return;
    }
    axios.get(`${API_URL}/api/website/settings`)
      .then(r => { setMaintenance(r.data.maintenance_mode); setChecked(true); })
      .catch(() => setChecked(true));
  }, [location.pathname]);

  return { maintenance, checked };
};

export default MaintenancePage;
