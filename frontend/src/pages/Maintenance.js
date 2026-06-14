import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MaintenancePage = () => (
  <div className="min-h-screen flex items-center justify-center font-body" style={{ background: '#080808' }}>
    <div className="dot-grid absolute inset-0 opacity-60 pointer-events-none" />
    {/* Ambient sphere */}
    <div style={{
      position:'fixed', top:'15%', right:'10%',
      width:300, height:300, borderRadius:'50%',
      background:'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
      filter:'blur(40px)',
      animation:'orb-pulse 5s ease-in-out infinite',
      pointerEvents:'none',
    }} />

    <div className="relative z-10 text-center px-6 max-w-lg scale-in">
      {/* 3D Sphere */}
      <div className="mx-auto mb-10 float-anim" style={{ width:80, height:80 }}>
        <div style={{
          width:'100%', height:'100%', borderRadius:'50%',
          background:'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 30%, rgba(0,0,0,0.9) 100%)',
          boxShadow:'inset -10px -10px 20px rgba(0,0,0,0.6), inset 5px 5px 15px rgba(255,255,255,0.06), 0 10px 40px rgba(0,0,0,0.8)',
          border:'1px solid rgba(255,255,255,0.08)',
        }} />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full border border-white/10 mb-8">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A]" style={{ animation:'orb-pulse 1.5s ease-in-out infinite' }} />
        <span className="text-xs font-medium text-[#A1A1A6] tracking-wide uppercase">Service Unavailable</span>
      </div>

      <h1 className="font-display font-bold gradient-text-bright mb-5"
        style={{ fontSize:'clamp(2.5rem,6vw,4.5rem)', letterSpacing:'-0.03em', lineHeight:0.92 }}>
        UNDER<br />MAINTENANCE
      </h1>

      <p className="text-[#6E6E73] text-base leading-relaxed mb-3 max-w-sm mx-auto" style={{ fontWeight:300 }}>
        We're performing scheduled updates to improve your experience.
      </p>
      <p className="text-[#6E6E73] text-base leading-relaxed mb-10 max-w-sm mx-auto" style={{ fontWeight:300 }}>
        Please check back soon — we'll be back online shortly.
      </p>

      {/* Terminal */}
      <div className="vg-terminal text-left rounded-2xl">
        <p><span className="text-[#A1A1A6]">$</span> <span className="text-white/70">vakar</span> <span className="text-[#6E6E73]">status --check</span></p>
        <p className="text-[#30D158] mt-1">→ Running maintenance procedures...</p>
        <p className="text-[#FF9F0A]">→ ETA: Soon™</p>
        <p className="mt-1 animate-pulse"><span className="text-[#A1A1A6]">$</span> <span className="text-white">_</span></p>
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
    const isAdmin = adminPaths.some(p => location.pathname.startsWith(p));
    if (isAdmin) { setMaintenance(false); setChecked(true); return; }

    axios.get(`${API_URL}/api/website/maintenance`)
      .then(r => { setMaintenance(r.data.maintenance === true); setChecked(true); })
      .catch(() => setChecked(true));
  }, [location.pathname]);

  return { maintenance, checked };
};

export default MaintenancePage;
