import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Bell, Ticket, Trophy, Tag, Megaphone, ShieldAlert, Info } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60000;

const ICON_FOR_TYPE = {
  ticket_reply: Ticket,
  loyalty_adjustment: Trophy,
  coupon: Tag,
  broadcast: Megaphone,
  cli_security: ShieldAlert,
  cli_message: Info,
};

// Admin-side notification bell — backed by the real db.notifications
// collection (GET /notifications, PATCH /notifications/read-all), not a
// stand-in ticket count. Opening the dropdown marks everything read, which
// is what makes the unread dot actually clear on view.
export const NotificationBell = ({ hasPermission, onOpenTicket }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : null;
  };

  const fetchNotifications = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) return;
    try {
      const r = await axios.get(`${API_URL}/api/notifications`, { headers, params: { limit: 8 } });
      setNotifications(r.data.notifications || []);
      setUnread(r.data.unread || 0);
    } catch {
      // silent — a failed background poll shouldn't interrupt the admin
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    const headers = authHeaders();
    if (!headers || unread === 0) return;
    try {
      await axios.patch(`${API_URL}/api/notifications/read-all`, {}, { headers });
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // silent
    }
  };

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
    catch { return ''; }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { const next = !open; setOpen(next); if (next) markAllRead(); }}
        title="Notifications"
        className="relative w-8 h-8 flex items-center justify-center rounded-full text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-all"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-appear absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#1c1c2e] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
            <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">Notifications</p>
            <span className="text-[11px] text-[#A1A1A6] dark:text-[#71717a]">{notifications.length} recent</span>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] text-[#A1A1A6] dark:text-[#71717a]">Nothing to see right now.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#D2D2D7] dark:divide-[#2a2a3c]">
              {notifications.map(n => {
                const Icon = ICON_FOR_TYPE[n.type] || Info;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 ${!n.read ? 'bg-[#4ECDC4]/[0.04]' : ''}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={13} className="text-[#4ECDC4]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-[#1D1D1F] dark:text-[#e4e4e7] leading-snug">{n.message}</p>
                      <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] mt-0.5">{fmtDate(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {hasPermission('manage_tickets') && (
            <button
              onClick={() => { setOpen(false); onOpenTicket?.(); }}
              className="w-full px-4 py-2.5 text-[12px] font-semibold text-[#4ECDC4] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition-colors text-center border-t border-[#D2D2D7] dark:border-[#2a2a3c]"
            >
              View all tickets
            </button>
          )}
        </div>
      )}
    </div>
  );
};
