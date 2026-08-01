import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const Label = ({ children }) =>
  children ? (
    <label className="block text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">
      {children}
    </label>
  ) : null;

const FieldError = ({ children }) =>
  children ? <p className="mt-1 text-xs text-red-400">{children}</p> : null;

// Apple-style custom listbox — drop-in replacement for a native <select>.
// Accepts the same shape: <Select value={v} onChange={e => ...}><option value="x">Label</option>...</Select>
const SIZES = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-9 px-3 text-sm',
};

export const Select = React.forwardRef(function Select(
  { label, error, children, value, onChange, disabled, placeholder, size = 'md', className = '', wrapperClassName = '', ...props },
  ref
) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const options = React.Children.toArray(children)
    .filter((child) => child?.type === 'option')
    .map((child) => ({ value: child.props.value, label: child.props.children }));

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (opt) => {
    setOpen(false);
    onChange?.({ target: { value: opt.value } });
  };

  return (
    <div className={wrapperClassName} ref={rootRef}>
      <Label>{label}</Label>
      <div className="relative">
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white dark:bg-[#151520] text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 ${SIZES[size] ?? SIZES.md} ${
            error ? 'border-red-500/50' : open ? 'border-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c]'
          } ${className}`}
          {...props}
        >
          <span className={`truncate ${selected ? 'text-[#1D1D1F] dark:text-[#e4e4e7]' : 'text-[#A1A1A6] dark:text-[#71717a]'}`}>
            {selected ? selected.label : (placeholder || 'Select…')}
          </span>
          <ChevronDown size={14} className={`shrink-0 text-[#A1A1A6] dark:text-[#71717a] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl bg-white dark:bg-[#1c1c2e] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-lg overflow-hidden py-1 max-h-64 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pick(opt)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isSelected ? 'text-[#4ECDC4] font-medium bg-[#4ECDC4]/[0.06]' : 'text-[#1D1D1F] dark:text-[#e4e4e7] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={13} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
});
