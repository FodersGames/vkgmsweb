import React from 'react';

const V = {
  default:  'bg-zinc-100 dark:bg-[#2a2a3c] text-zinc-600 dark:text-[#a1a1aa]',
  success:  'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
  warning:  'bg-amber-500/10   text-amber-600  dark:text-amber-400',
  error:    'bg-red-500/10     text-red-500    dark:text-red-400',
  info:     'bg-[#4ECDC4]/10   text-[#4ECDC4]',
  purple:   'bg-[#6C5CE7]/10   text-[#6C5CE7]',
  orange:   'bg-[#F2994A]/10   text-[#F2994A]',
  blue:     'bg-[#2F80ED]/10   text-[#2F80ED]',
};

export const Badge = ({ variant = 'default', dot = false, children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${V[variant] ?? V.default} ${className}`}
  >
    {dot && (
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
    )}
    {children}
  </span>
);
