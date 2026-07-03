import React from 'react';
import { Loader2 } from 'lucide-react';

const V = {
  primary:     'bg-gray-900 hover:bg-gray-800 text-white',
  accent:      'bg-brand-400 hover:bg-brand-500 text-white',
  purple:      'bg-purple-600 hover:bg-purple-700 text-white',
  secondary:   'border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 bg-white',
  ghost:       'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
  destructive: 'bg-error-500 hover:bg-error-600 text-white',
  danger:      'border border-error-300 text-error-500 hover:bg-error-50 hover:border-error-400',
};

const S = {
  sm: 'h-8  px-3 text-xs  gap-1.5 rounded-lg',
  md: 'h-9  px-4 text-sm  gap-2   rounded-lg',
  lg: 'h-10 px-5 text-sm  gap-2   rounded-lg',
};

export const Button = ({
  as: Tag = 'button',
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
  const isBtn = Tag === 'button';
  return (
    <Tag
      {...(isBtn ? { disabled: disabled || loading } : {})}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 ${isBtn ? 'disabled:opacity-50 disabled:cursor-not-allowed' : (loading || disabled ? 'opacity-50 pointer-events-none' : '')} ${V[variant] ?? V.primary} ${S[size] ?? S.md} ${className}`}
      {...props}
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin shrink-0" />
        : Icon && <Icon size={iconSize} className="shrink-0" />}
      {children}
    </Tag>
  );
};
