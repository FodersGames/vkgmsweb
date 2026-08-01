import React from 'react';

export const PageHeader = ({ icon: Icon, iconColor = '#4ECDC4', title, description, children, className = '' }) => (
  <div className={`flex items-center justify-between gap-3 ${className}`}>
    <div className="flex items-center gap-3 min-w-0">
      {Icon && (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${iconColor}18` }}
        >
          <Icon size={16} style={{ color: iconColor }} />
        </div>
      )}
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7] leading-tight">{title}</h3>
        {description && (
          <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5 truncate">{description}</p>
        )}
      </div>
    </div>
    {children && (
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    )}
  </div>
);

export const SectionLabel = ({ children, className = '' }) => (
  <p className={`text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest ${className}`}>
    {children}
  </p>
);
