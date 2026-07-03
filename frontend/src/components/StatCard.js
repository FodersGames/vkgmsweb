import React from 'react';

export const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-theme-sm p-5 relative overflow-hidden">
    {/* Colored top accent strip */}
    <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl" style={{ backgroundColor: accent }} />

    <div className="flex items-start justify-between mb-4 pt-1">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${accent}18` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{ backgroundColor: `${accent}12` }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
    </div>

    {loading ? (
      <div className="h-9 w-20 bg-gray-100 animate-pulse rounded mb-2" />
    ) : (
      <div className="text-[2rem] font-bold text-gray-900 mb-1 tabular-nums leading-none">
        {value ?? '—'}
      </div>
    )}

    <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</div>
  </div>
);
