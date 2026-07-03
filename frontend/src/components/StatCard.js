import React from 'react';

export const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-theme-sm p-5">
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
      style={{ backgroundColor: `${accent}18` }}
    >
      <Icon size={18} style={{ color: accent }} />
    </div>

    {loading ? (
      <div className="h-8 w-16 bg-gray-100 animate-pulse rounded mb-1.5" />
    ) : (
      <div className="text-3xl font-bold text-gray-900 mb-1 tabular-nums">
        {value ?? '—'}
      </div>
    )}

    <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</div>
  </div>
);
