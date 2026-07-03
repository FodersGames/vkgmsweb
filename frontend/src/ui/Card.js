import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`bg-white border border-[#E8E3DB] ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-4 border-b border-[#E8E3DB] flex items-center justify-between gap-3 ${className}`} {...props}>
    {children}
  </div>
);

export const CardBody = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardSection = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-3 border-b border-[#F0EDE8] last:border-0 ${className}`} {...props}>
    {children}
  </div>
);
