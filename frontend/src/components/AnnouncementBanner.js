import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Megaphone } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const BANNER_HEIGHT = '36px';
const DISMISS_KEY = 'vkg_announcement_dismissed';

// Sets a CSS var that both the fixed PublicNav (shifts its own `top`) and
// the page body (via a global rule in App.css) react to, so no individual
// page needs to know this banner exists.
const setReservedHeight = (px) => {
  document.documentElement.style.setProperty('--vkg-banner-h', px);
};

export const AnnouncementBanner = () => {
  const [text, setText] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/settings`)
      .then(r => {
        const active = !!r.data.announcement_active;
        const banner = (r.data.announcement_banner || '').trim();
        if (active && banner) {
          setText(banner);
          setDismissed(localStorage.getItem(DISMISS_KEY) === banner);
        }
      })
      .catch(() => {});
  }, []);

  const visible = !!text && !dismissed;

  useEffect(() => {
    setReservedHeight(visible ? BANNER_HEIGHT : '0px');
    return () => setReservedHeight('0px');
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, text);
    setDismissed(true);
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-[#1D1D1F] text-white px-10 text-center"
      style={{ height: BANNER_HEIGHT }}
    >
      <Megaphone size={12} className="shrink-0 text-[#4ECDC4]" />
      <p className="text-[11.5px] font-medium truncate">{text}</p>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
};
