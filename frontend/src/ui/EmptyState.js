import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action, accent = '#4ECDC4', className = '' }) => (
  <div className={`animate-appear flex flex-col items-center justify-center py-16 text-center ${className}`}>
    {Icon && (
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 dark:bg-[#151520] dark:border-[#2a2a3c]"
        style={{ backgroundColor: `${accent}0d`, border: `1px solid ${accent}33` }}
      >
        <Icon size={22} style={{ color: accent }} strokeWidth={1.75} />
      </div>
    )}
    <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1.5">{title}</p>
    {description && (
      <p className="text-[13px] text-[#A1A1A6] dark:text-[#71717a] max-w-xs leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
