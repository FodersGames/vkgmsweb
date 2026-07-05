import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import {
  ShoppingCart, X, Loader2, ArrowLeft, ArrowRight, Star,
  Package, Shield, Zap, Heart, Leaf, Flame, Target, Trophy, Rocket, Gem,
  Key, Lock, Wrench, Hammer, Globe, Sparkles, Box, Layers, Users,
  Award, Map, Cpu, Music, Moon, Sun, Tag, Gift,
  CheckCircle, LogIn,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ── Grade system ──────────────────────────────────────────────────────────────
const TIERS = {
  bronze:  { label: 'Bronze',  color: '#CD7F32', bg: '#CD7F3215', icon: Shield,  discount: 0,  min: 0,    max: 2500  },
  silver:  { label: 'Silver',  color: '#94A3B8', bg: '#94A3B815', icon: Star,    discount: 5,  min: 2500,  max: 10000 },
  gold:    { label: 'Gold',    color: '#F59E0B', bg: '#F59E0B15', icon: Trophy,  discount: 10, min: 10000, max: 25000 },
  diamond: { label: 'Diamond', color: '#22D3EE', bg: '#22D3EE15', icon: Gem,     discount: 15, min: 25000, max: null  },
};
const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond'];

const GradeBadge = ({ tier, size = 'sm' }) => {
  const cfg = TIERS[tier] || TIERS.bronze;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold ${size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-[10px] px-2 py-0.5'}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon size={size === 'lg' ? 14 : 10} />
      {cfg.label}
      {cfg.discount > 0 && ` −${cfg.discount}%`}
    </span>
  );
};

const LoyaltyBar = ({ loyalty }) => {
  const [showInfo, setShowInfo] = useState(false);
  if (!loyalty) return null;
  const { total_spent_cents, tier, next_tier, next_threshold_cents } = loyalty;
  const tierIdx = TIER_ORDER.indexOf(tier);
  const cfg = TIERS[tier] || TIERS.bronze;
  const Icon = cfg.icon;
  const progressPct = next_threshold_cents
    ? Math.min(100, ((total_spent_cents - cfg.min) / (next_threshold_cents - cfg.min)) * 100)
    : 100;

  return (
    <div className="bg-white border border-[#E8E3DB] p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon size={14} style={{ color: cfg.color }} />
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: cfg.color }}>{cfg.label}</span>
          {cfg.discount > 0 && (
            <span className="text-xs text-[#78716C]">−{cfg.discount}% on purchases</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#A8A29E] tabular-nums">${(total_spent_cents / 100).toFixed(2)} spent</span>
          <button
            onClick={() => setShowInfo(v => !v)}
            className="w-4 h-4 border border-[#C9C3BB] text-[#A8A29E] hover:border-[#78716C] hover:text-[#78716C] flex items-center justify-center text-[10px] font-bold transition-colors"
          >?</button>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-px bg-[#E8E3DB] mb-1">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-700"
          style={{ width: `${progressPct}%`, backgroundColor: cfg.color }}
        />
        {/* Tier tick marks */}
        {[{ pct: 10, t: 'bronze' }, { pct: 33, t: 'silver' }, { pct: 66, t: 'gold' }, { pct: 100, t: 'diamond' }].map(({ pct, t }) => (
          <div
            key={t}
            className="absolute -top-1 w-px h-3"
            style={{ left: `${pct}%`, backgroundColor: TIER_ORDER.indexOf(t) <= tierIdx ? TIERS[t].color : '#E8E3DB' }}
          />
        ))}
      </div>

      {/* Tier labels row */}
      <div className="flex justify-between mb-4">
        {TIER_ORDER.map((t, i) => {
          const tc = TIERS[t];
          const reached = i <= tierIdx;
          return (
            <span
              key={t}
              className="text-[9px] font-semibold tracking-[0.15em] uppercase"
              style={{ color: reached ? tc.color : '#C9C3BB' }}
            >
              {tc.label}
            </span>
          );
        })}
      </div>

      {next_tier && next_threshold_cents ? (
        <p className="text-[10px] text-[#A8A29E]">
          ${((next_threshold_cents - total_spent_cents) / 100).toFixed(2)} to reach{' '}
          <span className="font-semibold" style={{ color: TIERS[next_tier]?.color }}>{TIERS[next_tier]?.label}</span>
        </p>
      ) : (
        <p className="text-[10px] font-semibold" style={{ color: cfg.color }}>Maximum rank achieved.</p>
      )}

      {showInfo && (
        <div className="mt-4 pt-4 border-t border-[#E8E3DB] text-xs text-[#78716C] space-y-3">
          <p className="font-semibold text-[#1C1917]">Loyalty program</p>
          <p>Every dollar you spend adds to your loyalty total. The more you spend, the higher your rank and the bigger your discount on future purchases.</p>
          <div className="grid grid-cols-2 gap-1">
            {TIER_ORDER.map(t => {
              const tc = TIERS[t];
              const TIcon = tc.icon;
              const reached = TIER_ORDER.indexOf(t) <= tierIdx;
              return (
                <div key={t} className="flex items-center gap-1.5 px-2 py-1.5 bg-[#F9F7F4] border" style={{ borderColor: reached ? `${tc.color}55` : '#E8E3DB' }}>
                  <TIcon size={10} style={{ color: tc.color }} />
                  <span className="font-semibold text-[10px]" style={{ color: tc.color }}>{tc.label}</span>
                  <span className="text-[#A8A29E] text-[10px] ml-auto">${tc.min / 100}+{tc.discount > 0 ? ` ·−${tc.discount}%` : ''}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[#A8A29E] pt-1 border-t border-[#E8E3DB]">
            Silver, Gold and Diamond members receive exclusive coupons and bonus offers.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Badge system ──────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  NEW:     { bg: '#4ECDC4', text: '#fff',     label: 'New'     },
  SALE:    { bg: '#EB5757', text: '#fff',     label: 'Sale'    },
  LIMITED: { bg: '#F2994A', text: '#fff',     label: 'Limited' },
  HOT:     { bg: '#FF6B6B', text: '#fff',     label: 'Hot 🔥'  },
  POPULAR: { bg: '#A29BFE', text: '#fff',     label: 'Popular' },
  BEST:    { bg: '#F59E0B', text: '#fff',     label: 'Best Value' },
  BUNDLE:  { bg: '#6C5CE7', text: '#fff',     label: 'Bundle'  },
  EXCLUSIVE: { bg: '#1C1917', text: '#4ECDC4', label: '✦ Exclusive' },
};

const BadgePill = ({ badge, discount_pct }) => {
  const cfg = BADGE_STYLES[badge];
  if (!cfg) return null;
  return (
    <span
      className="text-[9px] font-black px-1.5 py-0.5 tracking-wide"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}{badge === 'SALE' && discount_pct ? ` −${discount_pct}%` : ''}
    </span>
  );
};

// ── Icon picker for categories ────────────────────────────────────────────────
const ICONS = { package: Package, shield: Shield, zap: Zap, heart: Heart, leaf: Leaf,
  flame: Flame, target: Target, trophy: Trophy, rocket: Rocket, gem: Gem,
  key: Key, lock: Lock, wrench: Wrench, hammer: Hammer, globe: Globe,
  sparkles: Sparkles, box: Box, layers: Layers, users: Users, award: Award,
  map: Map, cpu: Cpu, music: Music, moon: Moon, sun: Sun, gift: Gift, tag: Tag, star: Star,
};

// ── Main component ────────────────────────────────────────────────────────────
const Shop = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [loyalty, setLoyalty]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [activeGame, setActiveGame]     = useState(searchParams.get('game') || 'all');
  const [activeCat, setActiveCat]       = useState(searchParams.get('cat') || '');
  const [activeSub, setActiveSub]       = useState(searchParams.get('sub') || '');

  const [buying, setBuying]             = useState(null);
  const [uid, setUid]                   = useState('');
  const [buyError, setBuyError]         = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [couponCode, setCouponCode]     = useState('');
  const [couponStatus, setCouponStatus] = useState(null); // { valid, discount_pct, error }
  const [couponChecking, setCouponChecking] = useState(false);

  useEffect(() => { document.title = 'Shop — Vakar Games'; }, []);

  // Sync state with URL params
  useEffect(() => {
    const g = searchParams.get('game') || 'all';
    const c = searchParams.get('cat') || '';
    const s = searchParams.get('sub') || '';
    setActiveGame(g);
    setActiveCat(c);
    setActiveSub(s);
  }, [searchParams]);

  // Fetch products (+ the global category list) and the "browse by game" list
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes] = await Promise.all([
          axios.get(`${API_URL}/api/shop/products`),
          axios.get(`${API_URL}/api/shop/categories`),
        ]);
        setProducts(prodRes.data.products || []);
        setProductCategories(prodRes.data.categories || []);
        setCategories(catRes.data.categories || []);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Fetch loyalty (auth only)
  useEffect(() => {
    if (!token) return;
    axios.get(`${API_URL}/api/user/loyalty`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setLoyalty(r.data))
      .catch(() => {});
  }, [token]);

  const discount = loyalty ? (TIERS[loyalty.tier]?.discount || 0) : 0;

  const applyDiscount = (priceInCents) => {
    if (!discount) return priceInCents;
    return Math.max(50, Math.round(priceInCents * (1 - discount / 100)));
  };

  const openBuy = (product) => {
    if (!user) { navigate('/login'); return; }
    setBuying(product);
    setUid('');
    setBuyError('');
    setCouponCode('');
    setCouponStatus(null);
  };

  const checkCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    setCouponStatus(null);
    try {
      const r = await axios.post(
        `${API_URL}/api/coupons/validate`,
        { code: couponCode.trim(), product_id: buying?.id || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCouponStatus({ valid: true, discount_pct: r.data.discount_pct, scope_name: r.data.scope_name });
    } catch (e) {
      setCouponStatus({ valid: false, error: e.response?.data?.detail || 'Invalid coupon code.' });
    } finally {
      setCouponChecking(false);
    }
  };

  const handleBuy = async () => {
    if (!uid.trim()) { setBuyError('Please enter your in-game Player ID.'); return; }
    setBuyError('');
    setCheckoutLoading(true);
    try {
      const r = await axios.post(
        `${API_URL}/api/shop/checkout`,
        { product_id: buying.id, player_uid: uid.trim(), coupon_code: couponStatus?.valid ? couponCode.trim() : '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = r.data.checkout_url;
    } catch (e) {
      setBuyError(e.response?.data?.detail || 'Payment unavailable. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const setGame = (slug) => {
    if (slug === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ game: slug });
    }
    setActiveCat('');
    setActiveSub('');
  };

  const selectCat = (catId) => {
    const params = { game: activeGame };
    if (catId) params.cat = catId;
    setSearchParams(params);
    setActiveSub('');
  };

  const selectSub = (subId) => {
    const params = { game: activeGame };
    if (activeCat) params.cat = activeCat;
    if (subId) params.sub = subId;
    setSearchParams(params);
  };

  const loyaltyFinalPrice = buying ? applyDiscount(buying.price) : 0;
  const couponExtraDiscount = couponStatus?.valid ? couponStatus.discount_pct : 0;
  const finalPrice = buying
    ? Math.max(50, Math.round(loyaltyFinalPrice * (1 - couponExtraDiscount / 100)))
    : 0;

  // ── Filtered products ────────────────────────────────────────────────────
  const filteredByGame = activeGame === 'all' ? products : products.filter(p => p.game_slug === activeGame);
  const filteredByCat = activeCat ? filteredByGame.filter(p => p.category === activeCat) : filteredByGame;
  const filtered = activeSub ? filteredByCat.filter(p => p.subcategory === activeSub) : filteredByCat;
  const featured = filtered.filter(p => p.featured);
  const regular  = filtered.filter(p => !p.featured);

  const activeCatObj = productCategories.find(c => c.id === activeCat);
  const activeSubcats = activeCatObj?.subcategories || [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#F9F7F4] min-h-screen">
      <PublicNav />

      <div className="pt-16">
        {/* Header — same style as home page sections */}
        <section className="bg-white border-b border-[#E8E3DB] px-6 md:px-10 lg:px-16 pt-16 pb-10">
          <div className="max-w-screen-xl mx-auto">
            <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-4">Store</p>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <h1
                className="text-5xl sm:text-6xl font-black text-[#1C1917] leading-tight"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                VAKAR GAMES<br />SHOP
              </h1>
              {!user && (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 border border-[#1C1917] text-[#1C1917] hover:bg-[#1C1917] hover:text-white px-5 py-2.5 text-sm font-semibold transition-all"
                >
                  <LogIn size={14} />Sign in to purchase
                </Link>
              )}
            </div>
          </div>
        </section>

        <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 py-10 space-y-10">

          {/* Loyalty bar (auth only) */}
          {user && loyalty && <LoyaltyBar loyalty={loyalty} />}

          {/* Auth notice if not logged in */}
          {!user && (
            <div className="bg-white border border-[#E8E3DB] p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                <LogIn size={16} className="text-[#4ECDC4]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1C1917]">Sign in to buy</p>
                <p className="text-xs text-[#78716C]">An account is required to make purchases. Earn loyalty points with every order.</p>
              </div>
              <Link to="/login" className="ml-auto shrink-0 bg-[#1C1917] hover:bg-[#2D2926] text-white px-4 py-2 text-sm font-semibold transition-colors">
                Sign In
              </Link>
            </div>
          )}

          {/* Category filter */}
          {categories.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-3">Browse by game</p>
              <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
                <button
                  onClick={() => setGame('all')}
                  className={`px-4 py-1.5 text-xs font-semibold whitespace-nowrap border transition-colors ${
                    activeGame === 'all'
                      ? 'bg-[#1C1917] text-white border-[#1C1917]'
                      : 'bg-white text-[#78716C] border-[#E8E3DB] hover:border-[#C9C3BB] hover:text-[#1C1917]'
                  }`}
                >
                  All Games
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setGame(cat.id)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold whitespace-nowrap border transition-colors ${
                      activeGame === cat.id
                        ? 'bg-[#1C1917] text-white border-[#1C1917]'
                        : 'bg-white text-[#78716C] border-[#E8E3DB] hover:border-[#C9C3BB] hover:text-[#1C1917]'
                    }`}
                  >
                    {cat.label}
                    <span className="opacity-50">({cat.product_count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category filter — works across all games, or narrowed to the selected one */}
          {productCategories.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-3">Category</p>
              <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
                <button
                  onClick={() => selectCat('')}
                  className={`px-4 py-1.5 text-xs font-semibold whitespace-nowrap border transition-colors ${
                    !activeCat ? 'bg-[#4ECDC4] text-white border-[#4ECDC4]' : 'bg-white text-[#78716C] border-[#E8E3DB] hover:border-[#4ECDC4]/50 hover:text-[#1C1917]'
                  }`}
                >
                  All
                </button>
                {productCategories.map(cat => {
                  const Icon = ICONS[cat.icon] || Package;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => selectCat(cat.id)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold whitespace-nowrap border transition-colors ${
                        activeCat === cat.id ? 'bg-[#4ECDC4] text-white border-[#4ECDC4]' : 'bg-white text-[#78716C] border-[#E8E3DB] hover:border-[#4ECDC4]/50 hover:text-[#1C1917]'
                      }`}
                    >
                      <Icon size={12} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-category sub-category filter */}
          {activeCat && activeSubcats.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-3">Sub-category</p>
              <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
                <button
                  onClick={() => selectSub('')}
                  className={`px-3 py-1 text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                    !activeSub ? 'bg-[#1C1917] text-white border-[#1C1917]' : 'bg-white text-[#A8A29E] border-[#E8E3DB] hover:border-[#C9C3BB] hover:text-[#78716C]'
                  }`}
                >
                  All
                </button>
                {activeSubcats.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectSub(s.id)}
                    className={`px-3 py-1 text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                      activeSub === s.id ? 'bg-[#1C1917] text-white border-[#1C1917]' : 'bg-white text-[#A8A29E] border-[#E8E3DB] hover:border-[#C9C3BB] hover:text-[#78716C]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {loading ? (
            <div className="py-24 flex justify-center">
              <Loader2 size={24} className="animate-spin text-[#A8A29E]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <ShoppingCart size={32} className="mx-auto mb-4 text-[#C9C3BB]" />
              <p className="text-sm text-[#A8A29E]">No products available in this category yet.</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featured.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-4 flex items-center gap-2">
                    <Star size={11} className="text-[#F59E0B]" />Featured
                  </p>
                  <div className={`grid gap-4 ${featured.length === 1 ? 'grid-cols-1 max-w-lg' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {featured.map(p => <FeaturedCard key={p.id} product={p} discount={discount} applyDiscount={applyDiscount} onBuy={openBuy} user={user} />)}
                  </div>
                </div>
              )}

              {/* Regular grid */}
              {regular.length > 0 && (
                <div>
                  {featured.length > 0 && (
                    <p className="text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-4">All Offers</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {regular.map(p => <ProductCard key={p.id} product={p} discount={discount} applyDiscount={applyDiscount} onBuy={openBuy} user={user} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1C1917] mt-16 py-8 px-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-black tracking-[0.18em] text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</span>
          <p className="text-xs text-[#44403C]">Secure payments powered by Stripe.</p>
        </div>
      </footer>

      {/* Buy modal */}
      {buying && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#1C1917]/50">
          <div className="bg-white border border-[#E8E3DB] w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E8E3DB] flex items-center justify-between">
              <h3 className="font-bold text-[#1C1917] text-sm">{buying.name}</h3>
              <button onClick={() => setBuying(null)} className="p-1 text-[#A8A29E] hover:text-[#1C1917] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Product summary */}
              <div className="flex items-center gap-4 p-4 bg-[#F9F7F4] border border-[#E8E3DB]">
                {buying.image_url && (
                  <img
                    src={buying.image_url.startsWith('/') ? `${API_URL}${buying.image_url}` : buying.image_url}
                    alt=""
                    className="w-14 h-14 object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[#1C1917] truncate">{buying.name}</p>
                  {buying.description && <p className="text-xs text-[#78716C] truncate">{buying.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  {(discount > 0 || couponExtraDiscount > 0) && (
                    <p className="text-xs text-[#A8A29E] line-through">${(buying.price / 100).toFixed(2)}</p>
                  )}
                  <p className="text-lg font-black text-[#1C1917]">${(finalPrice / 100).toFixed(2)}</p>
                </div>
              </div>

              {/* Loyalty discount info */}
              {discount > 0 && loyalty && (
                <div className="flex items-center gap-3 p-3 border border-[#4ECDC4]/20 bg-[#4ECDC4]/5">
                  <GradeBadge tier={loyalty.tier} />
                  <p className="text-xs text-[#4ECDC4] font-semibold">
                    {discount}% loyalty discount applied
                  </p>
                </div>
              )}

              {/* Promo coupon */}
              <div>
                <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-1.5">
                  Promo code <span className="text-[#C9C3BB] normal-case font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null); }}
                    placeholder="VG-XXXXXXXX"
                    className="flex-1 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] text-sm px-3 py-2.5 focus:outline-none focus:border-[#4ECDC4] font-mono tracking-wide placeholder:text-[#A8A29E] placeholder:font-sans placeholder:tracking-normal"
                  />
                  <button
                    onClick={checkCoupon}
                    disabled={!couponCode.trim() || couponChecking}
                    className="shrink-0 text-xs font-semibold border border-[#E8E3DB] hover:border-[#4ECDC4] text-[#78716C] hover:text-[#4ECDC4] px-3 py-2.5 transition-colors disabled:opacity-40"
                  >
                    {couponChecking ? '…' : 'Apply'}
                  </button>
                </div>
                {couponStatus?.valid && (
                  <p className="text-xs text-[#4ECDC4] font-semibold mt-1.5">
                    ✓ {couponStatus.discount_pct}% promo discount applied
                    {couponStatus.scope_name ? ` (${couponStatus.scope_name})` : ''}
                    {' '}— you save ${((loyaltyFinalPrice - finalPrice) / 100).toFixed(2)} extra
                  </p>
                )}
                {couponStatus?.valid === false && (
                  <p className="text-xs text-red-500 mt-1.5">{couponStatus.error}</p>
                )}
              </div>

              {/* Player ID */}
              <div>
                <label className="block text-[10px] font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-1.5">
                  Your in-game Player ID
                </label>
                <input
                  type="text"
                  value={uid}
                  onChange={e => { setUid(e.target.value); setBuyError(''); }}
                  placeholder="player_12345"
                  className="w-full bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] text-sm px-4 py-2.5 focus:outline-none focus:border-[#4ECDC4] focus:ring-2 focus:ring-[#4ECDC4]/20 transition-all placeholder:text-[#A8A29E]"
                  onKeyDown={e => e.key === 'Enter' && handleBuy()}
                  autoFocus
                />
                <p className="text-[10px] text-[#A8A29E] mt-1.5">Item delivered once payment is confirmed.</p>
                {buyError && <p className="text-xs text-red-500 mt-1.5 font-medium">{buyError}</p>}
              </div>

              <button
                onClick={handleBuy}
                disabled={checkoutLoading}
                className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white py-3 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {checkoutLoading
                  ? <><Loader2 size={15} className="animate-spin" />Redirecting…</>
                  : `Pay $${(finalPrice / 100).toFixed(2)} with Stripe`
                }
              </button>

              <p className="text-center text-[10px] text-[#A8A29E]">
                Secure payment · Powered by Stripe · Your grade: {loyalty ? TIERS[loyalty.tier]?.label : 'Bronze'}
              </p>
            </div>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const FeaturedCard = ({ product, discount, applyDiscount, onBuy, user }) => {
  const finalPrice = applyDiscount(product.price);
  const img = product.image_url?.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${product.image_url}` : product.image_url;
  return (
    <div
      className="flex gap-4 p-5 bg-white border border-[#E8E3DB] hover:border-[#C9C3BB] cursor-pointer transition-colors"
      onClick={() => onBuy(product)}
    >
      {img && <img src={img} alt={product.name} className="w-20 h-20 object-cover shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {product.badge && <BadgePill badge={product.badge} discount_pct={product.discount_pct} />}
          <h3 className="font-bold text-sm text-[#1C1917] leading-tight">{product.name}</h3>
        </div>
        {product.description && <p className="text-xs text-[#78716C] mb-3 line-clamp-2">{product.description}</p>}
        <div className="flex items-center justify-between">
          <div>
            {discount > 0 && <p className="text-xs text-[#A8A29E] line-through">${(product.price / 100).toFixed(2)}</p>}
            <p className="text-lg font-black text-[#1C1917]">${(finalPrice / 100).toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1C1917] hover:bg-[#2D2926] text-white text-xs font-bold px-3 py-1.5 transition-colors">
            <ShoppingCart size={11} />Buy
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductCard = ({ product, discount, applyDiscount, onBuy, user }) => {
  const finalPrice = applyDiscount(product.price);
  const img = product.image_url?.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${product.image_url}` : product.image_url;
  return (
    <div
      className="flex flex-col bg-white border border-[#E8E3DB] hover:border-[#C9C3BB] cursor-pointer transition-colors overflow-hidden"
      onClick={() => onBuy(product)}
    >
      {/* Image */}
      <div className="relative w-full bg-[#F9F7F4]" style={{ height: 140 }}>
        {img
          ? <img src={img} alt={product.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={24} className="text-[#C9C3BB]" /></div>
        }
        {product.badge && (
          <div className="absolute top-2 left-2">
            <BadgePill badge={product.badge} discount_pct={product.discount_pct} />
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-xs text-[#1C1917] leading-tight mb-1 line-clamp-1">{product.name}</h3>
        {product.description && <p className="text-[11px] text-[#78716C] mb-2 line-clamp-2">{product.description}</p>}
        <div className="flex items-center justify-between mt-auto">
          <div>
            {discount > 0 && <p className="text-[10px] text-[#A8A29E] line-through">${(product.price / 100).toFixed(2)}</p>}
            <p className="text-sm font-black text-[#1C1917]">${(finalPrice / 100).toFixed(2)}</p>
          </div>
          <span className="text-[10px] font-bold text-white bg-[#1C1917] px-2 py-1">Get</span>
        </div>
      </div>
    </div>
  );
};

export default Shop;
