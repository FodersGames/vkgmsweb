import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { PublicButton } from '../ui/PublicButton';
import { Reveal } from '../components/Reveal';
import { Sparkle, CheckCircle, Crown, ArrowRight, X } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL;

// Every row here is a real, currently-enforced limit or gate in the App
// Builder (studio_apps.py / constants/appBuilder.js) — not aspirational
// copy. Keep this in sync whenever a quota or a free/premium line changes.
const COMPARISON_ROWS = [
  { label: 'Apps you can build', free: '2', plus: '50' },
  { label: 'Screens per app', free: '15', plus: 'Unlimited' },
  { label: 'Storage per app', free: '20 MB', plus: '1 GB' },
  { label: 'Themes', free: '1 (Mint)', plus: 'All 12' },
  { label: 'Components', free: 'Core set', plus: 'Every component' },
  { label: 'Custom text sizing', free: false, plus: true },
  { label: 'Reactive visibility (elements that react to your data)', free: false, plus: true },
  { label: 'Entrance animations', free: 'Fade', plus: 'Fade, slide, pop' },
  { label: 'Export to code (VS Code project)', free: false, plus: true },
  { label: 'Sell your app (you keep 60%)', free: false, plus: true },
  { label: 'Build an installable Android APK', free: true, plus: true },
];

function ComparisonCell({ value, isPlus }) {
  if (value === true) return <CheckCircle size={17} weight={isPlus ? 'fill' : 'regular'} className={isPlus ? 'text-[#4ECDC4]' : 'text-[#6E6E73]'} />;
  if (value === false) return <X size={13} className="text-[#D2D2D7]" />;
  return <span className={`text-xs font-semibold ${isPlus ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'}`}>{value}</span>;
}

function ComparisonRow({ label, free, plus, last }) {
  return (
    <div className={`grid grid-cols-[1fr_72px_72px] items-center gap-2 py-3.5 ${last ? '' : 'border-b border-[#EDEDEF]'}`}>
      <p className="text-[13px] text-[#1D1D1F] pr-2">{label}</p>
      <div className="flex justify-center"><ComparisonCell value={free} isPlus={false} /></div>
      <div className="flex justify-center"><ComparisonCell value={plus} isPlus /></div>
    </div>
  );
}

function formatPrice(plan) {
  if (!plan) return null;
  try {
    return (plan.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: (plan.currency || 'usd').toUpperCase() });
  } catch {
    return `$${(plan.amount_cents / 100).toFixed(2)}`;
  }
}

export default function VakarPlus() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justSubscribed = !!searchParams.get('session_id');

  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState('monthly');
  const [status, setStatus] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Vakar+ — Vakar Games';
    fetch(`${API}/api/vakar-plus/pricing`)
      .then(r => r.json())
      .then(d => {
        setPricing(d.plans);
        if (!d.plans?.monthly && d.plans?.yearly) setCycle('yearly');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token) { setStatus(null); return; }
    fetch(`${API}/api/vakar-plus/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setStatus).catch(() => {});
  }, [token, justSubscribed]);

  const subscribe = async () => {
    if (!user) { navigate('/login'); return; }
    setSubscribing(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/vakar-plus/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: cycle }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Something went wrong.');
      window.location.href = data.checkout_url;
    } catch (e) {
      setError(e.message);
      setSubscribing(false);
    }
  };

  const activePlan = pricing?.[cycle];
  const bothConfigured = pricing && (pricing.monthly || pricing.yearly);
  const isSubscriber = !!status?.is_active;

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <PublicNav />

      <section className="bg-white border-b border-[#D2D2D7] px-6 md:px-10 lg:px-16 pt-[104px] pb-16">
        <Reveal className="max-w-screen-md mx-auto text-center">
          <p className="text-[12px] font-mono text-[#4ECDC4] mb-4">// vakar+</p>
          <h1 className="font-display text-4xl sm:text-6xl font-medium tracking-[-0.02em] text-[#1D1D1F] mb-5" style={{ textWrap: 'balance' }}>
            Everything Vakar, unlocked.
          </h1>
          <p className="text-[#6E6E73] text-base leading-relaxed max-w-lg mx-auto">
            One subscription, growing benefits across every tool and app we build — starting with our App Builder.
          </p>
        </Reveal>
      </section>

      <main className="flex-1 max-w-screen-md mx-auto w-full px-6 md:px-10 lg:px-16 py-14">
        {justSubscribed && (
          <div className="rounded-xl liquid-glass p-5 mb-10 flex items-center gap-3">
            <CheckCircle size={20} className="text-[#4ECDC4] shrink-0" />
            <p className="text-sm text-[#1D1D1F]"><strong>Welcome to Vakar+!</strong> Your subscription is being activated — this can take a few seconds.</p>
          </div>
        )}

        {isSubscriber && !justSubscribed && (
          <div className="rounded-xl liquid-glass p-5 mb-10 flex items-center gap-3">
            <Crown size={20} className="text-[#4ECDC4] shrink-0" />
            <p className="text-sm text-[#1D1D1F]">
              You're a Vakar+ subscriber{status.plan ? ` (${status.plan})` : ''}.{' '}
              <Link to="/profile" className="text-[#4ECDC4] font-semibold hover:underline">Manage your subscription</Link>
            </p>
          </div>
        )}

        <div className="mb-16">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl font-medium tracking-[-0.01em] text-[#1D1D1F] mb-2">Free vs Vakar+</h2>
            <p className="text-sm text-[#6E6E73] max-w-md mx-auto">Everything below is a real limit or feature in the App Builder today — not a promise for later.</p>
          </div>
          <div className="rounded-2xl liquid-glass overflow-hidden max-w-xl mx-auto">
            <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2 px-6 py-4 border-b border-[#D2D2D7]">
              <p className="text-[10px] font-bold text-[#A1A1A6] uppercase tracking-wider">What you get</p>
              <p className="text-[10px] font-bold text-[#6E6E73] uppercase tracking-wider text-center">Free</p>
              <p className="text-[10px] font-bold text-[#4ECDC4] uppercase tracking-wider text-center flex items-center justify-center gap-1">
                <Crown size={10} weight="fill" />Vakar+
              </p>
            </div>
            <div className="px-6">
              {COMPARISON_ROWS.map((row, i) => (
                <ComparisonRow key={row.label} {...row} last={i === COMPARISON_ROWS.length - 1} />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl liquid-glass p-8 sm:p-10 text-center max-w-md mx-auto">
          {loading ? (
            <div className="h-40 animate-pulse" />
          ) : !bothConfigured ? (
            <>
              <Sparkle size={22} className="text-[#A1A1A6] mx-auto mb-4" />
              <p className="font-display text-lg font-medium text-[#1D1D1F] mb-2">Vakar+ is almost here</p>
              <p className="text-sm text-[#6E6E73]">Pricing is being finalized — check back soon.</p>
            </>
          ) : (
            <>
              {pricing.monthly && pricing.yearly && (
                <div className="inline-flex rounded-full bg-[#EDEDEF] p-1 gap-1 mb-6">
                  {['monthly', 'yearly'].map(c => (
                    <button
                      key={c} onClick={() => setCycle(c)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${cycle === c ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}
                    >
                      {c === 'monthly' ? 'Monthly' : 'Yearly'}
                    </button>
                  ))}
                </div>
              )}

              <p className="font-display text-5xl font-medium text-[#1D1D1F] tracking-[-0.02em]">
                {formatPrice(activePlan)}
                <span className="text-base font-normal text-[#A1A1A6]">/{activePlan?.interval === 'year' ? 'yr' : 'mo'}</span>
              </p>

              {error && <p className="mt-4 text-xs text-red-500">{error}</p>}

              <div className="mt-8">
                {isSubscriber ? (
                  <PublicButton as={Link} to="/profile" icon={Crown} iconPosition="leading" className="w-full">
                    Manage subscription
                  </PublicButton>
                ) : (
                  <PublicButton onClick={subscribe} disabled={subscribing} icon={ArrowRight} className="w-full">
                    {subscribing ? 'Redirecting…' : user ? 'Subscribe to Vakar+' : 'Sign in to subscribe'}
                  </PublicButton>
                )}
              </div>
              <p className="mt-4 text-[11px] text-[#A1A1A6]">Cancel anytime from your account.</p>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
