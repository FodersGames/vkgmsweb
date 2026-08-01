import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <div className={`bg-white border border-[#D2D2D7] rounded-lg overflow-hidden ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-4 border-b border-[#D2D2D7] flex items-center justify-between gap-3 ${className}`} {...props}>
    {children}
  </div>
);

export const CardBody = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardSection = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-3 border-b border-[#EDEDEF] last:border-0 ${className}`} {...props}>
    {children}
  </div>
);
