import React from 'react';

export const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
    {Icon && (
      <div className="w-12 h-12 flex items-center justify-center mb-4 bg-gray-50 border border-gray-200">
        <Icon size={20} className="text-gray-300" />
      </div>
    )}
    <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
    {description && (
      <p className="text-xs text-gray-400 max-w-xs leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
