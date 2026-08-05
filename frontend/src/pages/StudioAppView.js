import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, WarningCircle, LockKey, LockSimple, ShoppingCart, CircleNotch } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import AppRuntime from '../components/AppRuntime';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function StudioAppView() {
  const { slug } = useParams();
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justPurchased = searchParams.get('purchased') === '1';
  // ?rev=pending / ?rev=published — owner/staff only (see
  // get_public_studio_app); used by the admin Reviews queue's "Preview"
  // link so it always shows exactly the version frozen at submission time,
  // never whatever the owner may have since edited in their live draft.
  const rev = searchParams.get('rev');
  const [app, setApp] = useState(null);
  const [status, setStatus] = useState('loading');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  const load = useCallback(() => {
    const qs = rev ? `?rev=${encodeURIComponent(rev)}` : '';
    return fetch(`${API_URL}/api/apps/${slug}${qs}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); });
  }, [slug, token, rev]);

  useEffect(() => {
    if (authLoading) return;
    setStatus('loading');
    document.title = 'Vakar Games';
    load()
      .then(data => {
        setApp(data);
        setStatus('ok');
        document.title = `${data.name} — Vakar Games`;
      })
      .catch(() => setStatus('not_found'));
  }, [load, authLoading]);

  // A Stripe redirect can land back here slightly before the webhook has
  // fulfilled the purchase — poll briefly instead of showing the paywall
  // again right after paying.
  useEffect(() => {
    if (!justPurchased || status !== 'ok' || !app?.requires_purchase) return undefined;
    let attempts = 0;
    const t = setInterval(async () => {
      attempts += 1;
      try {
        const data = await load();
        if (!data.requires_purchase || attempts >= 5) {
          setApp(data);
          clearInterval(t);
        }
      } catch {
        clearInterval(t);
      }
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPurchased, status, app?.requires_purchase]);

  const buyAccess = async () => {
    if (!user) { navigate('/login'); return; }
    setBuying(true);
    setBuyError('');
    try {
      const r = await fetch(`${API_URL}/api/apps/${slug}/checkout`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Could not start checkout.');
      window.location.href = data.checkout_url;
    } catch (e) {
      setBuyError(e.message);
      setBuying(false);
    }
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="w-8 h-8 border-2 border-[#D2D2D7] border-t-[#4ECDC4] rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] text-center px-6">
        <WarningCircle size={28} className="text-[#A1A1A6] mb-4" />
        <p className="font-display text-xl font-medium text-[#1D1D1F] mb-2">App not found</p>
        <p className="text-sm text-[#6E6E73] mb-6 max-w-xs">
          This app doesn't exist, isn't published, or you don't have access to it.
        </p>
        <Link to="/" className="text-sm font-semibold text-[#4ECDC4] hover:underline">Back to Vakar Games</Link>
      </div>
    );
  }

  if (app.requires_purchase) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F5F5F7]">
        <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors px-6 py-4">
          <ArrowLeft size={12} />Vakar Games
        </Link>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm w-full text-center">
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-6 bg-white border border-[#D2D2D7] flex items-center justify-center">
              {app.app_icon_url ? (
                <img src={app.app_icon_url.startsWith('/') ? `${API_URL}${app.app_icon_url}` : app.app_icon_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <LockSimple size={26} className="text-[#A1A1A6]" />
              )}
            </div>
            <h1 className="font-display text-2xl font-medium text-[#1D1D1F] mb-2">{app.name}</h1>
            {app.description && <p className="text-sm text-[#6E6E73] mb-6 leading-relaxed">{app.description}</p>}
            {buyError && <p className="text-xs text-red-500 mb-3">{buyError}</p>}
            <button
              onClick={buyAccess} disabled={buying}
              className="w-full rounded-full inline-flex items-center justify-center gap-2 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {buying ? <CircleNotch size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
              {buying ? 'Redirecting…' : `Buy access — $${(app.price_cents / 100).toFixed(2)}`}
            </button>
            <p className="text-[11px] text-[#A1A1A6] mt-4">One-time purchase. Yours to keep, sign in to access it anywhere.</p>
          </div>
        </div>
      </div>
    );
  }

  // No device-frame chrome here — this is the real, shipped app (same
  // principle as the APK export), so it just fills the screen with its
  // own content. The phone simulation is a design-time aid only, kept in
  // the builder's canvas and its Preview modal.
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7]">
      <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors px-6 py-4">
        <ArrowLeft size={12} />Vakar Games
      </Link>
      <div className="relative flex-1">
        <AppRuntime app={app} token={token} className="w-full h-full" showWatermark={!app.owner_is_vakar_plus} />
      </div>
      {app.visibility === 'private' && (
        <p className="text-[11px] text-[#A1A1A6] flex items-center justify-center gap-1 py-3 border-t border-[#D2D2D7]"><LockKey size={11} />Internal tool — staff only</p>
      )}
    </div>
  );
}
