import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-theme-sm ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-4 border-b border-gray-100 ${className}`} {...props}>
    {children}
  </div>
);

export const CardBody = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardSection = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-3 border-b border-gray-100 last:border-0 ${className}`} {...props}>
    {children}
  </div>
);
