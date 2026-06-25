import React from 'react';
import { Loader2 } from 'lucide-react';

const V = {
  primary:     'bg-[#1C1917] hover:bg-[#2D2926] text-white',
  accent:      'bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f]',
  purple:      'bg-[#6C5CE7] hover:bg-[#5b4dd6] text-white',
  secondary:   'border border-[#E8E3DB] text-[#78716C] hover:border-[#C9C3BB] hover:text-[#1C1917] bg-white',
  ghost:       'text-[#78716C] hover:bg-[#F9F7F4] hover:text-[#1C1917]',
  destructive: 'bg-red-500 hover:bg-red-600 text-white',
  danger:      'border border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400',
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
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${V[variant] ?? V.primary} ${S[size] ?? S.md} ${className}`}
      {...props}
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin shrink-0" />
        : Icon && <Icon size={iconSize} className="shrink-0" />}
      {children}
    </button>
  );
};
