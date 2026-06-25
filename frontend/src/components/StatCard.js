import React from 'react';

export const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <div className="bg-white border border-[#E8E3DB] p-5">
    <div
      className="w-9 h-9 flex items-center justify-center mb-4"
      style={{ backgroundColor: `${accent}18` }}
    >
      <Icon size={16} style={{ color: accent }} />
    </div>

    {loading ? (
      <div className="h-8 w-14 bg-[#E8E3DB] animate-pulse mb-1.5" />
    ) : (
      <div className="text-2xl font-bold text-[#1C1917] mb-1 tabular-nums" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
        {value ?? '—'}
      </div>
    )}

    <div className="text-xs text-[#A8A29E] font-semibold uppercase tracking-wider">{label}</div>
  </div>
);
