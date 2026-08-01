import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
    {Icon && (
      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-[#F5F5F7] border border-[#D2D2D7]">
        <Icon size={20} className="text-[#BFBFC4]" />
      </div>
    )}
    <p className="text-sm font-semibold text-[#1D1D1F] mb-1">{title}</p>
    {description && (
      <p className="text-xs text-[#A1A1A6] max-w-xs leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
