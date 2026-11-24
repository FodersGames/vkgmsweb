import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from '@phosphor-icons/react';

const CONSENT_KEY = 'vg_cookie_consent';

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (!saved) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(CONSENT_KEY, 'essential');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="animate-appear fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[60] w-[min(320px,calc(100vw-6.5rem))] rounded-2xl overflow-hidden bg-white/95 backdrop-blur-xl border border-[#E5E5EA] shadow-xl text-[#1D1D1F]"
      role="dialog"
      aria-label="Privacy notice"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-2">
          <Cookie size={16} className="text-[#1D1D1F]" />
          <span className="text-sm font-semibold text-[#1D1D1F]">Privacy</span>
        </div>
        <button
          onClick={dismiss}
          className="text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          aria-label="Close privacy notice"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-xs text-[#6E6E73] leading-relaxed mb-3">
          We only use essential local storage to keep you signed in and remember your preferences. No analytics or advertising cookies.{' '}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[#1D1D1F] font-medium hover:underline"
            >
              Learn more
            </button>
          )}
        </p>

        {expanded && (
          <div className="mb-3 space-y-2 text-[11px] text-[#6E6E73] leading-relaxed">
            <div className="border-l-2 border-[#1D1D1F] pl-2.5">
              <p className="font-semibold text-[#1D1D1F] mb-0.5">Essential storage</p>
              <p>Sign-in session, theme, cookie choice, and banner preferences. Always active.</p>
            </div>
            <div className="border-l-2 border-[#D2D2D7] pl-2.5">
              <p className="font-semibold text-[#1D1D1F] mb-0.5">No tracking</p>
              <p>We do not use analytics, advertising cookies, or tracking pixels on this website.</p>
            </div>
            <Link to="/privacy" className="block text-[#1D1D1F] font-medium hover:underline pt-1">
              Privacy Policy &rarr;
            </Link>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={dismiss}
          className="btn-apple w-full text-xs !py-2 font-medium"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
