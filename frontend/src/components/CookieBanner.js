import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

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

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'all');
    setVisible(false);
  };

  const necessary = () => {
    localStorage.setItem(CONSENT_KEY, 'necessary');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      // Capped so it never reaches under the support bubble (bottom-right,
      // ~88px footprint) on narrow phones — anchored bottom-left only,
      // never spanning the full width like a right-anchored banner would.
      className="animate-appear fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[60] w-[min(320px,calc(100vw-6.5rem))] rounded-2xl overflow-hidden liquid-glass-dark"
      role="dialog"
      aria-label="Cookie consent"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Cookie size={14} className="text-[#4ECDC4]" />
          <span className="text-sm font-bold text-white tracking-wide">Cookies</span>
        </div>
        <button
          onClick={necessary}
          className="text-[#6E6E73] hover:text-white transition-colors"
          aria-label="Close and accept necessary only"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-xs text-[#A1A1A6] leading-relaxed mb-3">
          We use cookies to improve your experience and analyze traffic.{' '}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[#4ECDC4] hover:underline"
            >
              Learn more
            </button>
          )}
        </p>

        {expanded && (
          <div className="mb-3 space-y-2 text-[11px] text-[#6E6E73] leading-relaxed">
            <div className="border-l-2 border-[#4ECDC4]/40 pl-3">
              <p className="font-semibold text-[#A1A1A6] mb-0.5">Necessary cookies</p>
              <p>Authentication session, security. Always active.</p>
            </div>
            <div className="border-l-2 border-[#3D3733] pl-3">
              <p className="font-semibold text-[#A1A1A6] mb-0.5">Analytics cookies</p>
              <p>Anonymous traffic analysis to improve the site.</p>
            </div>
            <Link to="/privacy" className="block text-[#4ECDC4] hover:underline pt-1">
              Privacy Policy →
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={accept}
            className="w-full py-2.5 text-xs font-bold rounded-lg bg-[#4ECDC4] hover:bg-[#3BB8B0] text-white transition-colors"
          >
            Accept all
          </button>
          <button
            onClick={necessary}
            className="w-full py-2 text-xs font-semibold rounded-lg text-[#6E6E73] hover:text-white border border-[#3D3733] hover:border-[#6E6E73] transition-colors"
          >
            Necessary only
          </button>
        </div>
      </div>
    </div>
  );
};

export const getCookieConsent = () => localStorage.getItem(CONSENT_KEY);
