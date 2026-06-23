import React from 'react';
import { Loader2 } from 'lucide-react';

const V = {
  primary:     'bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f]',
  purple:      'bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white',
  secondary:   'border border-zinc-200 dark:border-[#2a2a3c] text-zinc-700 dark:text-[#a1a1aa] hover:bg-zinc-50 dark:hover:bg-[#1c1c2e] hover:text-zinc-800 dark:hover:text-[#e4e4e7]',
  ghost:       'text-zinc-500 dark:text-[#71717a] hover:bg-zinc-100 dark:hover:bg-[#1c1c2e] hover:text-zinc-700 dark:hover:text-[#e4e4e7]',
  destructive: 'bg-red-500 hover:bg-red-600 text-white',
  danger:      'border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50',
};

const S = {
  sm: 'h-8  px-3 text-xs  gap-1.5',
  md: 'h-9  px-4 text-sm  gap-2',
  lg: 'h-10 px-5 text-sm  gap-2',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const iconSize = size === 'sm' ? 12 : 14;
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${V[variant] ?? V.primary} ${S[size] ?? S.md} ${className}`}
      {...props}
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin shrink-0" />
        : Icon && <Icon size={iconSize} className="shrink-0" />}
      {children}
    </button>
  );
};
