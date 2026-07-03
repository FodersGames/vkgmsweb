import React from 'react';

const BASE_INPUT =
  'w-full bg-gray-50 border text-gray-900 rounded-lg text-sm px-3 focus:outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-[#52525b]';

const borderClass = (error) =>
  error
    ? 'border-red-500/50 focus:border-red-500'
    : 'border-gray-200 focus:border-brand-400';

const Label = ({ children }) =>
  children ? (
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  ) : null;

const FieldError = ({ children }) =>
  children ? <p className="mt-1 text-xs text-error-400">{children}</p> : null;

export const Input = React.forwardRef(function Input(
  { label, error, className = '', wrapperClassName = '', ...props },
  ref
) {
  return (
    <div className={wrapperClassName}>
      <Label>{label}</Label>
      <input
        ref={ref}
        className={`${BASE_INPUT} h-9 ${borderClass(error)} ${className}`}
        {...props}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
});

export const Textarea = React.forwardRef(function Textarea(
  { label, error, rows = 4, className = '', wrapperClassName = '', ...props },
  ref
) {
  return (
    <div className={wrapperClassName}>
      <Label>{label}</Label>
      <textarea
        ref={ref}
        rows={rows}
        className={`${BASE_INPUT} py-2.5 resize-none ${borderClass(error)} ${className}`}
        {...props}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
});

export const Select = React.forwardRef(function Select(
  { label, error, children, className = '', wrapperClassName = '', ...props },
  ref
) {
  return (
    <div className={wrapperClassName}>
      <Label>{label}</Label>
      <select
        ref={ref}
        className={`${BASE_INPUT} h-9 ${borderClass(error)} ${className}`}
        {...props}
      >
        {children}
      </select>
      <FieldError>{error}</FieldError>
    </div>
  );
});
