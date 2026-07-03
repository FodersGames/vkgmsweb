import React from 'react';

const V = {
  default:  'bg-gray-100 text-zinc-600',
  success:  'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
  warning:  'bg-amber-500/10   text-amber-600  dark:text-amber-400',
  error:    'bg-red-500/10     text-error-500    dark:text-error-400',
  info:     'bg-brand-50   text-brand-400',
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
