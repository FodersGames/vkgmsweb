import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
    {Icon && (
      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-[#1c1c2e] flex items-center justify-center mb-4">
        <Icon size={20} className="text-zinc-400 dark:text-[#52525b]" />
      </div>
    )}
    <p className="text-sm font-semibold text-zinc-700 dark:text-[#a1a1aa] mb-1">{title}</p>
    {description && (
      <p className="text-xs text-zinc-400 dark:text-[#71717a] max-w-xs leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
