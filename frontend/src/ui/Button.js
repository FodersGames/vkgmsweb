import React from 'react';
import { Loader2 } from 'lucide-react';

const V = {
  primary:     'bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white dark:bg-[#e4e4e7] dark:text-[#0e0e15] dark:hover:bg-white',
  accent:      'bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f]',
  purple:      'bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white',
  secondary:   'border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] hover:text-[#1D1D1F] dark:hover:text-white bg-white dark:bg-[#151520]',
  ghost:       'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] hover:text-[#1D1D1F] dark:hover:text-white',
  destructive: 'bg-red-500 hover:bg-red-600 text-white',
  danger:      'border border-red-300 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-400',
};

const S = {
  sm: 'h-8  px-3 text-xs  gap-1.5',
  md: 'h-9  px-4 text-sm  gap-2',
  lg: 'h-10 px-5 text-sm  gap-2',
};

export const Button = ({
  as,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  pill = false,
  children,
  className = '',
  disabled,
  type,
  ...props
}) => {
  const iconSize = size === 'sm' ? 12 : 14;
  const Tag = as || 'button';
  // Default to type="button" so a Button never accidentally submits a form
  // it happens to sit inside unless a caller explicitly opts in with type="submit".
  const tagProps = as ? {} : { type: type || 'button', disabled: disabled || loading };
  return (
    <Tag
      {...tagProps}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#151520] ${pill ? 'rounded-full' : 'rounded-lg'} ${V[variant] ?? V.primary} ${S[size] ?? S.md} ${className}`}
      {...props}
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin shrink-0" />
        : Icon && <Icon size={iconSize} className="shrink-0" />}
      {children}
    </Tag>
  );
};
