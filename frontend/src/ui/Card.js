import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div
    className={`bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div
    className={`px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c] flex items-center justify-between gap-3 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardBody = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardSection = ({ className = '', children, ...props }) => (
  <div
    className={`px-6 py-3 border-b border-zinc-100 dark:border-[#1c1c2e] last:border-0 ${className}`}
    {...props}
  >
    {children}
  </div>
);
