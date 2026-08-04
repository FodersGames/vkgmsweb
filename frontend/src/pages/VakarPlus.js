import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { PublicButton } from '../ui/PublicButton';
import { Reveal } from '../components/Reveal';
import { Sparkle, CheckCircle, AppWindow, Code, Rocket, Crown, ArrowRight } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL;

const BENEFITS = [
  {
    icon: AppWindow, title: 'App Builder — Pro tools', tag: 'Early access',
    description: 'Advanced components, extra themes, and higher app & screen limits in our no-code App Builder.',
  },
  {
    icon: Code, title: 'Export to code', tag: null,
    description: 'Download any app you build as a real, ready-to-open VS Code project — HTML, CSS and JS.',
  },
  {
    icon: Rocket, title: 'Growing every release', tag: null,
    description: 'New Vakar+ perks roll out across our apps as we ship them — subscribe once, keep unlocking more.',
  },
];

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

        <div className="grid sm:grid-cols-3 gap-5 mb-16">
          {BENEFITS.map(b => (
            <div key={b.title} className="rounded-xl liquid-glass p-6">
              <div className="w-10 h-10 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center mb-4">
                <b.icon size={18} className="text-[#4ECDC4]" />
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="font-display text-base font-medium text-[#1D1D1F]">{b.title}</h3>
                {b.tag && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#F2994A]/10 text-[#F2994A]">
                    {b.tag}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#6E6E73] leading-relaxed">{b.description}</p>
            </div>
          ))}
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
