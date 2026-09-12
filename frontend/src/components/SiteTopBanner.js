import React, { useState, useEffect, useRef } from 'react';
import { X, Megaphone, Wrench } from 'lucide-react';
import { getWebsiteSettings } from '../utils/publicCache';

const DISMISS_KEY = 'vkg_announcement_dismissed';

export const SiteTopBanner = () => {
  const containerRef = useRef(null);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [maintenanceAnnouncement, setMaintenanceAnnouncement] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [, forceTick] = useState(0);

  // Poll settings for schedule & announcements
  useEffect(() => {
    let mounted = true;
    const fetchSettings = () => {
      getWebsiteSettings()
        .then((data) => {
          if (!mounted) return;
          const sched = data?.maintenance_scheduled_at ? new Date(data.maintenance_scheduled_at) : null;
          setScheduledAt(sched && sched > new Date() ? sched.toISOString() : null);
          setMaintenanceAnnouncement(data?.maintenance_announcement || '');

          const banner = (data?.announcement_banner || '').trim();
          const active = !!data?.announcement_active;
          if (active && banner) {
            setAnnouncementText(banner);
            setAnnouncementDismissed(localStorage.getItem(DISMISS_KEY) === banner);
          } else {
            setAnnouncementText('');
          }
        })
        .catch(() => {});
    };

    fetchSettings();
    const interval = setInterval(fetchSettings, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Tick for maintenance countdown
  useEffect(() => {
    if (!scheduledAt) return undefined;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  // Compute maintenance remaining time
  let maintenanceVisible = false;
  let mm = 0;
  let ss = 0;
  if (scheduledAt) {
    const remainingMs = new Date(scheduledAt).getTime() - Date.now();
    if (remainingMs > 0) {
      maintenanceVisible = true;
      const totalSec = Math.ceil(remainingMs / 1000);
      mm = Math.floor(totalSec / 60);
      ss = totalSec % 60;
    }
  }

  const announcementVisible = !!announcementText && !announcementDismissed;
  const anyVisible = maintenanceVisible || announcementVisible;

  // Measure banner height and update CSS var so entire page and nav shift down
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !anyVisible) {
      document.documentElement.style.setProperty('--vkg-banner-h', '0px');
      return;
    }

    const updateHeight = () => {
      const h = el.offsetHeight || 0;
      document.documentElement.style.setProperty('--vkg-banner-h', `${h}px`);
    };

    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty('--vkg-banner-h', '0px');
    };
  }, [anyVisible, maintenanceVisible, announcementVisible, mm, ss]);

  if (!anyVisible) return null;

  const dismissAnnouncement = () => {
    localStorage.setItem(DISMISS_KEY, announcementText);
    setAnnouncementDismissed(true);
  };

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 right-0 z-[100] flex flex-col shadow-sm"
      style={{ isolation: 'isolate' }}
    >
      {/* 1. Scheduled Maintenance Banner (highest priority) */}
      {maintenanceVisible && (
        <div className="w-full bg-[#FF6600] text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 flex-wrap tracking-tight">
          <div className="flex items-center gap-1.5 bg-black/15 px-2 py-0.5 rounded-full">
            <Wrench size={12} className="animate-pulse" />
            <span>Maintenance</span>
          </div>
          <span>
            Scheduled maintenance starts in {mm}:{String(ss).padStart(2, '0')}
          </span>
          {maintenanceAnnouncement && (
            <span className="text-white/90 font-normal">· {maintenanceAnnouncement}</span>
          )}
        </div>
      )}

      {/* 2. Public Announcement Banner */}
      {announcementVisible && (
        <div className="w-full relative bg-[#1D1D1F] text-white px-8 py-2 text-xs flex items-center justify-center gap-2 border-t border-white/10">
          <Megaphone size={12} className="shrink-0 text-[#FF6600]" />
          <p className="text-[12px] font-medium text-center truncate max-w-[800px]">{announcementText}</p>
          <button
            onClick={dismissAnnouncement}
            aria-label="Dismiss announcement"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

