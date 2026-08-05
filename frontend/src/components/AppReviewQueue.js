import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Check, X, Clock, ThumbsDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const STATUS_TABS = [
  { id: 'pending',  label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// Admin review queue for Studio App submissions — approve makes an app
// publicly reachable and showcases it on the public "Applications" page;
// reject requires a reason and leaves the app exactly as it was (owner can
// edit and resubmit). See backend/app/routers/studio_apps.py's
// review_status state machine for the full picture.
export default function AppReviewQueue() {
  const { token } = useAuth();
  const [tab, setTab] = useState('pending');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveConfirm, setApproveConfirm] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/studio-apps/reviews?status=${tab}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setReviews(data.reviews || []);
    } finally {
      setLoading(false);
    }
  }, [tab, token]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    setBusyId(id);
    setError('');
    try {
      const r = await fetch(`${API}/api/admin/studio-apps/reviews/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Could not approve.'); }
      setApproveConfirm(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    setBusyId(id);
    setError('');
    try {
      const r = await fetch(`${API}/api/admin/studio-apps/reviews/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Could not reject.'); }
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">App Reviews</h2>
          <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">
            Community submissions — approving makes an app public and features it on Applications.
          </p>
        </div>

        <div className="inline-flex rounded-full bg-[#EDEDEF] dark:bg-[#1c1c2e] p-1 gap-1">
          {STATUS_TABS.map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${tab === t.id ? 'bg-white dark:bg-[#2a2a3c] text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#6E6E73] dark:text-[#a1a1aa]'}`}
            >
              {t.label}
            </button>
          ))}
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
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={tab === 'pending' ? Clock : tab === 'approved' ? Check : ThumbsDown}
            title={`No ${tab} submissions`}
            description={tab === 'pending' ? "You're all caught up — nothing waiting for review." : `No apps have been ${tab} yet.`}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reviews.map(a => (
              <div key={a.id} className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden flex flex-col">
                {a.review_banner_url && (
                  <div className="h-24 bg-[#F5F5F7] dark:bg-[#0d0d14]">
                    <img src={a.review_banner_url.startsWith('/') ? `${API}${a.review_banner_url}` : a.review_banner_url} alt="" className="w-full h-full object-cover" />
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
                      <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] truncate">by {a.owner || 'unknown'} · submitted {fmtDate(a.submitted_at)}</p>
                    </div>
                    <a
                      href={`/apps/${a.slug}`} target="_blank" rel="noopener noreferrer" title="Preview the app"
                      className="p-2 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white rounded-lg hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06] shrink-0"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  {a.review_description && (
                    <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed line-clamp-3">{a.review_description}</p>
                  )}

                  {a.review_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {a.review_tags.map(t => (
                        <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#4ECDC4]/10 text-[#4ECDC4]">{t}</span>
                      ))}
                    </div>
                  )}

                  {tab === 'rejected' && a.review_rejection_reason && (
                    <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">Reason: {a.review_rejection_reason}</p>
                  )}
                  {tab !== 'pending' && a.reviewed_at && (
                    <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">Reviewed {fmtDate(a.reviewed_at)} by {a.reviewed_by || '—'}</p>
                  )}

                  <div className="flex-1" />

                  {tab === 'pending' && (
                    rejectingId === a.id ? (
                      <div className="pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e] space-y-2">
                        <textarea
                          autoFocus rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection (shown to the submitter)"
                          className="w-full rounded-lg px-3 py-2 text-xs bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-red-400 resize-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" className="flex-1" loading={busyId === a.id} onClick={() => reject(a.id)}>Confirm reject</Button>
                          <Button size="sm" variant="secondary" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e]">
                        <Button size="sm" icon={Check} className="flex-1 !bg-emerald-500 hover:!bg-emerald-600 !text-white" onClick={() => setApproveConfirm(a)}>Approve</Button>
                        <Button size="sm" variant="secondary" icon={X} onClick={() => setRejectingId(a.id)}>Reject</Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!approveConfirm}
        onClose={() => !busyId && setApproveConfirm(null)}
        onConfirm={() => approve(approveConfirm.id)}
        title="Approve this app?"
        description={`"${approveConfirm?.review_name || approveConfirm?.name}" will go live immediately and appear on the public Applications page.`}
        confirmLabel="Approve & publish"
        loading={busyId === approveConfirm?.id}
      />
    </>
  );
}
