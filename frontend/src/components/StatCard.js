import React from 'react';

export const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] shadow-sm p-5">
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
      style={{ backgroundColor: `${accent}18` }}
    >
      <Icon size={16} style={{ color: accent }} />
    </div>

    {loading ? (
      <div className="h-8 w-14 rounded-md bg-zinc-200 dark:bg-zinc-700 animate-pulse mb-1.5" />
    ) : (
      <div className="text-2xl font-bold text-zinc-900 dark:text-[#e4e4e7] mb-1 tabular-nums">
        {value ?? '—'}
      </div>
    )}

    <div className="text-xs text-[#71717a] font-medium">{label}</div>
  </div>
);
