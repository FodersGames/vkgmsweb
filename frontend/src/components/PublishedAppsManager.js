import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, ShieldAlert, ShieldCheck as ShieldCheckIcon, Check, X, ThumbsDown, Clock, Globe, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// Moderation console for self-service apps that are already live — distinct
// from "App Builder" (staff's own house apps) and "Reviews" (pending
// decisions). Suspending here is an owner-proof kill switch: the flag is
// checked directly in get_public_studio_app before status/visibility, so
// the owner can't route around it by flipping those back themselves. See
// backend/app/routers/studio_apps.py's admin_takedown / STUDIO_APP_SNAPSHOT
// writeup for the full picture.
export default function PublishedAppsManager() {
  const { token } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [suspendingId, setSuspendingId] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/studio-apps/published`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setApps(data.apps || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const suspend = async (id) => {
    setBusyId(id);
    setError('');
    try {
      const r = await fetch(`${API}/api/admin/studio-apps/${id}/takedown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: suspendReason.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Could not suspend this app.'); }
      setSuspendingId(null);
      setSuspendReason('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (id) => {
    setBusyId(id);
    setError('');
    try {
      const r = await fetch(`${API}/api/admin/studio-apps/${id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Could not restore this app.'); }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Published Apps</h2>
        <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">
          Every community app that's currently live — suspend one instantly if it needs to come down; the owner can't bring it back themselves.
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={12} /></button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-[#D2D2D7] dark:bg-[#1c1c2e] animate-pulse" />)}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="No published apps yet"
          description="Community apps show up here once they're approved and live."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {apps.map(a => (
            <div key={a.id} className={`rounded-xl bg-white dark:bg-[#151520] border overflow-hidden flex flex-col ${a.admin_takedown ? 'border-red-300 dark:border-red-500/40' : 'border-[#D2D2D7] dark:border-[#2a2a3c]'}`}>
              {a.admin_takedown && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 flex items-center gap-2">
                  <ShieldAlert size={13} className="text-red-500 shrink-0" />
                  <p className="text-[11px] text-red-600 dark:text-red-400 leading-snug">
                    Suspended{a.admin_takedown_reason ? ` — ${a.admin_takedown_reason}` : ''}
                  </p>
                </div>
              )}
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c]">
                    {a.review_logo_url && (
                      <img src={a.review_logo_url.startsWith('/') ? `${API}${a.review_logo_url}` : a.review_logo_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{a.review_name || a.name}</p>
                    <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] truncate">by {a.owner || 'unknown'} · live since {fmtDate(a.reviewed_at)}</p>
                  </div>
                  <a
                    href={`/apps/${a.slug}`} target="_blank" rel="noopener noreferrer" title="View the live app"
                    className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] shrink-0"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                {a.review_description && (
                  <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed line-clamp-2">{a.review_description}</p>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#4ECDC4]/10 text-[#4ECDC4] flex items-center gap-1">
                    {a.visibility === 'public' ? <Globe size={9} /> : <Lock size={9} />}{a.visibility}
                  </span>
                  {a.price_cents > 0 && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      ${(a.price_cents / 100).toFixed(2)}
                    </span>
                  )}
                  {a.review_status === 'pending' && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={9} />update awaiting review
                    </span>
                  )}
                  {a.review_status === 'rejected' && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 flex items-center gap-1">
                      <ThumbsDown size={9} />update rejected
                    </span>
                  )}
                </div>

                <div className="flex-1" />

                {suspendingId === a.id ? (
                  <div className="pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e] space-y-2">
                    <textarea
                      autoFocus rows={2} value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                      placeholder="Reason for suspension (shown to the owner)"
                      className="w-full rounded-lg px-3 py-2 text-xs bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-red-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" className="flex-1" loading={busyId === a.id} onClick={() => suspend(a.id)}>Confirm suspend</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setSuspendingId(null); setSuspendReason(''); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e]">
                    {a.admin_takedown ? (
                      <Button size="sm" icon={Check} className="flex-1 !bg-emerald-500 hover:!bg-emerald-600 !text-white" loading={busyId === a.id} onClick={() => restore(a.id)}>Restore</Button>
                    ) : (
                      <Button size="sm" variant="danger" icon={ShieldAlert} className="flex-1" onClick={() => setSuspendingId(a.id)}>Suspend</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
