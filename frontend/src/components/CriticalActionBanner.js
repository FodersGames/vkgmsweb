import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import api from '../utils/api';

// Site-wide (every Dashboard tab, every super admin session — see
// Dashboard.js) live alert for any critical action currently counting down
// (backend: admin_system.py's /admin/critical-actions/*). Polls for new/
// cancelled/completed actions every few seconds; the countdown itself ticks
// locally between polls so it reads as genuinely live rather than jumping
// in 3s steps. Cancelling here works for ANY super admin, not just whoever
// triggered it — that's the whole point.
const POLL_MS = 3000;

function secondsLeft(executeAtIso) {
  return Math.max(0, Math.round((new Date(executeAtIso).getTime() - Date.now()) / 1000));
}

export default function CriticalActionBanner() {
  const [actions, setActions] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [, forceTick] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = () => {
      api.get('/api/admin/critical-actions/pending')
        .then(r => setActions(r.data.actions || []))
        .catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  // Local 1s ticker just to re-render the countdown text smoothly between polls.
  useEffect(() => {
    if (!actions.length) return undefined;
    const t = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [actions.length]);

  if (!actions.length) return null;

  const cancel = async (id) => {
    setCancellingId(id);
    try {
      await api.post(`/api/admin/critical-actions/${id}/cancel`);
      setActions(prev => prev.filter(a => a.id !== id));
    } catch {
      // Poll will reconcile either way.
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="sticky top-14 z-20 shrink-0">
      {actions.map(a => {
        const left = secondsLeft(a.execute_at);
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 bg-red-600 text-white border-b border-red-800">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert size={16} className="shrink-0 animate-pulse" />
              <span className="text-xs font-semibold truncate">
                CRITICAL ACTION PENDING — {a.label}
              </span>
            </div>
            <span className="text-xs text-red-100">
              requested by <span className="font-semibold">{a.requested_by}</span>
            </span>
            <span className="text-xs font-mono font-bold tabular-nums">
              {left > 0 ? `executes in ${left}s` : 'executing now…'}
            </span>
            <button
              onClick={() => cancel(a.id)}
              disabled={cancellingId === a.id || left <= 0}
              className="ml-auto flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-white text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
            >
              {cancellingId === a.id && <Loader2 size={12} className="animate-spin" />}
              Cancel
            </button>
          </div>
        );
      })}
    </div>
  );
}
