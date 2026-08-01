import React from 'react';

export const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
    <div
      className="rounded-lg w-9 h-9 flex items-center justify-center mb-4"
      style={{ backgroundColor: `${accent}18` }}
    >
      <Icon size={16} style={{ color: accent }} />
    </div>

    {loading ? (
      <div className="h-8 w-14 bg-[#D2D2D7] animate-pulse mb-1.5" />
    ) : (
      <div className="text-2xl font-bold text-[#1D1D1F] mb-1 tabular-nums">
        {value ?? '—'}
      </div>
    )}

    <div className="text-xs text-[#A1A1A6] font-semibold uppercase tracking-wider">{label}</div>
  </div>
);
