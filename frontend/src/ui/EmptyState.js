import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
    {Icon && (
      <div className="w-12 h-12 flex items-center justify-center mb-4 bg-[#F9F7F4] border border-[#E8E3DB]">
        <Icon size={20} className="text-[#C9C3BB]" />
      </div>
    )}
    <p className="text-sm font-semibold text-[#1C1917] mb-1">{title}</p>
    {description && (
      <p className="text-xs text-[#A8A29E] max-w-xs leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
