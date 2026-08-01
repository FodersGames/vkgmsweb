import React, { useState } from 'react';
import { Rows3, Rows2 } from 'lucide-react';

const KEY = 'vg_admin_density';

// Shared "Comfortable / Compact" row-density preference for dense admin tables
// (Users, Tickets, Logs). Persisted per-browser, same pattern as the theme toggle.
export const useDensity = () => {
  const [density, setDensityState] = useState(() => {
    try { return localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfortable'; }
    catch { return 'comfortable'; }
  });

  const setDensity = (d) => {
    setDensityState(d);
    try { localStorage.setItem(KEY, d); } catch {}
  };

  return [density, setDensity];
};

export const DensityToggle = ({ density, onChange, className = '' }) => (
  <div className={`inline-flex items-center border border-[#D2D2D7] dark:border-[#2a2a3c] rounded-lg overflow-hidden shrink-0 ${className}`}>
    <button
      type="button"
      title="Comfortable"
      onClick={() => onChange('comfortable')}
      className={`h-8 w-8 flex items-center justify-center transition-colors ${
        density === 'comfortable'
          ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]'
          : 'text-[#A1A1A6] dark:text-[#71717a] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.045] dark:hover:bg-white/[0.06]'
      }`}
    >
      <Rows2 size={14} />
    </button>
    <button
      type="button"
      title="Compact"
      onClick={() => onChange('compact')}
      className={`h-8 w-8 flex items-center justify-center border-l border-[#D2D2D7] dark:border-[#2a2a3c] transition-colors ${
        density === 'compact'
          ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]'
          : 'text-[#A1A1A6] dark:text-[#71717a] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.045] dark:hover:bg-white/[0.06]'
      }`}
    >
      <Rows3 size={14} />
    </button>
  </div>
);
