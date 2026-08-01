import React, { useState, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';

// Small inline "Saved" confirmation for settings forms — flashes next to the
// save action for a couple seconds instead of firing a toast for every minor edit.
export const useSavedFlash = (duration = 2000) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef(null);

  const flash = useCallback(() => {
    setVisible(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), duration);
  }, [duration]);

  return [visible, flash];
};

export const SavedFlash = ({ show, label = 'Saved', className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 text-xs font-medium text-[#4ECDC4] transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${className}`}
    aria-live="polite"
  >
    <Check size={12} />
    {label}
  </span>
);
