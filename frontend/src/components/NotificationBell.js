import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Bell, Ticket } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60000;

// Admin-side "things need your attention" bell — starts with open support
// tickets (the highest-signal, lowest-risk source already exposed by an
// existing endpoint). Silent on failure: a background poll is not the place
// to interrupt the admin with a toast every minute a request hiccups.
export const NotificationBell = ({ hasPermission, onOpenTicket }) => {
  const canSeeTickets = hasPermission('manage_tickets');
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const ref = useRef(null);

  const fetchOpenTickets = useCallback(async () => {
    if (!canSeeTickets) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const r = await axios.get(`${API_URL}/api/admin/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { status: 'open', limit: 5 },
      });
      setTickets(r.data.tickets || []);
      setTotal(r.data.total || 0);
    } catch {
      // silent — a failed background poll shouldn't interrupt the admin
    }
  }, [canSeeTickets]);

  useEffect(() => {
    fetchOpenTickets();
    const id = setInterval(fetchOpenTickets, POLL_MS);
    return () => clearInterval(id);
  }, [fetchOpenTickets]);

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

  if (!canSeeTickets) return null;

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
    catch { return ''; }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) fetchOpenTickets(); }}
        title="Notifications"
        className="relative w-8 h-8 flex items-center justify-center rounded-full text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4] dark:hover:border-[#3a3a4c] outline-none focus-visible:ring-2 focus-visible:ring-[#4ECDC4]/50 transition-all"
      >
        <Bell size={14} />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-appear absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#1c1c2e] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
            <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">Open tickets</p>
            <span className="text-[11px] text-[#A1A1A6] dark:text-[#71717a]">{total} total</span>
          </div>
          {tickets.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[12px] text-[#A1A1A6] dark:text-[#71717a]">Nothing needs attention right now.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#D2D2D7] dark:divide-[#2a2a3c]">
              {tickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setOpen(false); onOpenTicket?.(); }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Ticket size={13} className="text-[#4ECDC4]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{t.subject}</p>
                    <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] mt-0.5">{t.username} · {fmtDate(t.updated_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { setOpen(false); onOpenTicket?.(); }}
            className="w-full px-4 py-2.5 text-[12px] font-semibold text-[#4ECDC4] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] transition-colors text-center border-t border-[#D2D2D7] dark:border-[#2a2a3c]"
          >
            View all tickets
          </button>
        </div>
      )}
    </div>
  );
};
