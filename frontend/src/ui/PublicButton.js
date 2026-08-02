import React from 'react';

// Shared button for the public site. Square corners + wide-tracked small
// caps read as drafting-table/editorial rather than the rounded-xl "SaaS
// landing page" default — matched to the Fraunces/mono type system used
// throughout the public site. Real depth + a press-scale micro-interaction
// keep it feeling like a considered product control, not a flat pill.
const SIZES = {
  sm: 'h-9 px-4 text-[11px] gap-1.5 tracking-[0.08em]',
  md: 'h-10 px-5 text-[12px] gap-2 tracking-[0.09em]',
  lg: 'h-12 px-6 text-[13px] gap-2 tracking-[0.1em]',
};

const VARIANTS = {
  primary:
    'glass-sheen bg-[#1D1D1F] text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_10px_24px_-10px_rgba(0,0,0,0.45)] hover:bg-black hover:shadow-[0_1px_2px_rgba(0,0,0,0.12),0_14px_30px_-10px_rgba(0,0,0,0.5)]',
  accent:
    'bg-[#4ECDC4] text-[#0A2E2B] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_10px_24px_-12px_rgba(78,205,196,0.7)] hover:bg-[#45c2b9]',
  secondary: 'liquid-glass liquid-glass-interactive text-[#1D1D1F]',
  outline: 'border border-[#D2D2D7] text-[#1D1D1F] hover:border-[#BFBFC4] hover:bg-black/[0.025]',
  ghost: 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.035]',
};

export const PublicButton = ({
  as,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'trailing',
  className = '',
  children,
  disabled,
  type,
  ...props
}) => {
  const Tag = as || 'button';
  const iconSize = size === 'sm' ? 13 : 14;
  const tagProps = as ? {} : { type: type || 'button', disabled };
  return (
    <Tag
      {...tagProps}
      className={`inline-flex items-center justify-center uppercase font-semibold transition-all duration-200 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ${SIZES[size] ?? SIZES.md} ${VARIANTS[variant] ?? VARIANTS.primary} ${className}`}
      {...props}
    >
      {Icon && iconPosition === 'leading' && <Icon size={iconSize} />}
      {children}
      {Icon && iconPosition === 'trailing' && <Icon size={iconSize} className="transition-transform group-hover:translate-x-0.5" />}
    </Tag>
  );
};
