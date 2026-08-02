import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { SHOP_BADGE_MAP } from '../constants/shopBadges';
import { PublicButton } from '../ui/PublicButton';
import {
  ShoppingCart, X, CircleNotch, Star, Shield, Trophy, Diamond,
  CheckCircle, SignIn, GameController, AppWindow, Wrench,
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ── Grade system ──────────────────────────────────────────────────────────────
const TIERS = {
  bronze:  { label: 'Bronze',  color: '#CD7F32', bg: '#CD7F3215', icon: Shield,  discount: 0,  min: 0,    max: 2500  },
  silver:  { label: 'Silver',  color: '#94A3B8', bg: '#94A3B815', icon: Star,    discount: 5,  min: 2500,  max: 10000 },
  gold:    { label: 'Gold',    color: '#F59E0B', bg: '#F59E0B15', icon: Trophy,  discount: 10, min: 10000, max: 25000 },
  diamond: { label: 'Diamond', color: '#22D3EE', bg: '#22D3EE15', icon: Diamond, discount: 15, min: 25000, max: null  },
};
const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond'];

// ── Product type — what the Shop's top-level tabs group by. Comes straight
// from each game/app's own "Type" field (set in the admin's Games manager),
// not a second hand-maintained taxonomy layered on top. ────────────────────
const TYPE_ORDER = ['game', 'application', 'software'];
const TYPE_META = {
  game:        { label: 'Games',        icon: GameController },
  application: { label: 'Applications', icon: AppWindow },
  software:    { label: 'Software',     icon: Wrench },
};

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
    <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon size={14} style={{ color: cfg.color }} />
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: cfg.color }}>{cfg.label}</span>
          {cfg.discount > 0 && (
            <span className="text-xs text-[#6E6E73]">−{cfg.discount}% on purchases</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#A1A1A6] tabular-nums">${(total_spent_cents / 100).toFixed(2)} spent</span>
          <button
            onClick={() => setShowInfo(v => !v)}
            className="rounded-lg w-4 h-4 border border-[#BFBFC4] text-[#A1A1A6] hover:border-[#6E6E73] hover:text-[#6E6E73] flex items-center justify-center text-[10px] font-bold transition-colors"
          >?</button>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-px bg-[#D2D2D7] mb-1">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-700"
          style={{ width: `${progressPct}%`, backgroundColor: cfg.color }}
        />
        {/* Tier tick marks */}
        {[{ pct: 10, t: 'bronze' }, { pct: 33, t: 'silver' }, { pct: 66, t: 'gold' }, { pct: 100, t: 'diamond' }].map(({ pct, t }) => (
          <div
            key={t}
            className="absolute -top-1 w-px h-3"
            style={{ left: `${pct}%`, backgroundColor: TIER_ORDER.indexOf(t) <= tierIdx ? TIERS[t].color : '#D2D2D7' }}
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
              style={{ color: reached ? tc.color : '#BFBFC4' }}
            >
              {tc.label}
            </span>
          );
        })}
      </div>

      {next_tier && next_threshold_cents ? (
        <p className="text-[10px] text-[#A1A1A6]">
          ${((next_threshold_cents - total_spent_cents) / 100).toFixed(2)} to reach{' '}
          <span className="font-semibold" style={{ color: TIERS[next_tier]?.color }}>{TIERS[next_tier]?.label}</span>
        </p>
      ) : (
        <p className="text-[10px] font-semibold" style={{ color: cfg.color }}>Maximum rank achieved.</p>
      )}

      {showInfo && (
        <div className="mt-4 pt-4 border-t border-[#D2D2D7] text-xs text-[#6E6E73] space-y-3">
          <p className="font-semibold text-[#1D1D1F]">Loyalty program</p>
          <p>Every dollar you spend adds to your loyalty total. The more you spend, the higher your rank and the bigger your discount on future purchases.</p>
          <div className="grid grid-cols-2 gap-1">
            {TIER_ORDER.map(t => {
              const tc = TIERS[t];
              const TIcon = tc.icon;
              const reached = TIER_ORDER.indexOf(t) <= tierIdx;
              return (
                <div key={t} className="rounded-lg flex items-center gap-1.5 px-2 py-1.5 bg-[#F5F5F7] border" style={{ borderColor: reached ? `${tc.color}55` : '#D2D2D7' }}>
                  <TIcon size={10} style={{ color: tc.color }} />
                  <span className="font-semibold text-[10px]" style={{ color: tc.color }}>{tc.label}</span>
                  <span className="text-[#A1A1A6] text-[10px] ml-auto">${tc.min / 100}+{tc.discount > 0 ? ` ·−${tc.discount}%` : ''}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[#A1A1A6] pt-1 border-t border-[#D2D2D7]">
            Silver, Gold and Diamond members receive exclusive coupons and bonus offers.
          </p>
        </div>
      )}
    </div>
  );
};

// ── Badge system ──────────────────────────────────────────────────────────────
const BadgePill = ({ badge, discount_pct }) => {
  const cfg = SHOP_BADGE_MAP[badge];
  if (!cfg) return null;
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 tracking-wide"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}{badge === 'SALE' && discount_pct ? ` −${discount_pct}%` : ''}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const Shop = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts]         = useState([]);
  // Games/apps that have at least one active shop product — the Shop's
  // "browse by product" level, each tagged with its own product_type.
  const [gamesWithProducts, setGamesWithProducts] = useState([]);
  const [loyalty, setLoyalty]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [activeType, setActiveType]     = useState(searchParams.get('type') || '');
  const [activeGame, setActiveGame]     = useState(searchParams.get('game') || 'all');

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
    setActiveType(searchParams.get('type') || '');
    setActiveGame(searchParams.get('game') || 'all');
  }, [searchParams]);

  // Fetch products + the "browse by game/app" list (each tagged with its type)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prodRes, gamesRes] = await Promise.all([
          axios.get(`${API_URL}/api/shop/products`),
          axios.get(`${API_URL}/api/shop/categories`),
        ]);
        setProducts(prodRes.data.products || []);
        setGamesWithProducts(gamesRes.data.categories || []);
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

  // Selecting a type resets the game filter back to "all" within that type.
  const selectType = (type) => {
    const params = {};
    if (type) params.type = type;
    setSearchParams(params);
  };

  const selectGame = (slug) => {
    const params = {};
    if (activeType) params.type = activeType;
    if (slug !== 'all') params.game = slug;
    setSearchParams(params);
  };

  const loyaltyFinalPrice = buying ? applyDiscount(buying.price) : 0;
  const couponExtraDiscount = couponStatus?.valid ? couponStatus.discount_pct : 0;
  const finalPrice = buying
    ? Math.max(50, Math.round(loyaltyFinalPrice * (1 - couponExtraDiscount / 100)))
    : 0;

  // ── Type tabs — only show types that actually have a product behind them
  const availableTypes = useMemo(
    () => TYPE_ORDER.filter(t => gamesWithProducts.some(g => (g.product_type || 'game') === t)),
    [gamesWithProducts]
  );

  // ── Games/apps pills for the selected type (or all, if no type selected)
  const gamesForType = useMemo(
    () => activeType ? gamesWithProducts.filter(g => (g.product_type || 'game') === activeType) : gamesWithProducts,
    [gamesWithProducts, activeType]
  );

  const gameTypeMap = useMemo(
    () => Object.fromEntries(gamesWithProducts.map(g => [g.id, g.product_type || 'game'])),
    [gamesWithProducts]
  );

  // ── Filtered products ────────────────────────────────────────────────────
  const byType = activeType ? products.filter(p => gameTypeMap[p.game_slug] === activeType) : products;
  const filtered = activeGame === 'all' ? byType : byType.filter(p => p.game_slug === activeGame);
  const featured = filtered.filter(p => p.featured);
  const regular  = filtered.filter(p => !p.featured);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#F5F5F7] min-h-screen">
      <PublicNav />

      <div className="pt-[52px]">
        {/* Header — same style as home page sections */}
        <section className="bg-white border-b border-[#D2D2D7] px-6 md:px-10 lg:px-16 pt-16 pb-10">
          <Reveal className="max-w-screen-xl mx-auto">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// store</p>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.02em] text-[#1D1D1F]">
                Shop
              </h1>
              {!user && (
                <PublicButton as={Link} to="/login" variant="outline" icon={SignIn} iconPosition="leading">
                  Sign in to purchase
                </PublicButton>
              )}
            </div>
          </Reveal>
        </section>

        <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 py-10 space-y-10">

          {/* Loyalty bar (auth only) */}
          {user && loyalty && <LoyaltyBar loyalty={loyalty} />}

          {/* Auth notice if not logged in */}
          {!user && (
            <div className="rounded-xl bg-white border border-[#D2D2D7] p-5 flex items-center gap-4">
              <div className="rounded-lg w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                <SignIn size={16} className="text-[#4ECDC4]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1D1D1F]">Sign in to buy</p>
                <p className="text-xs text-[#6E6E73]">An account is required to make purchases. Earn loyalty points with every order.</p>
              </div>
              <PublicButton as={Link} to="/login" size="sm" className="ml-auto shrink-0">
                Sign In
              </PublicButton>
            </div>
          )}

          {/* Type tabs — Games / Applications / Software */}
          {availableTypes.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-[#A1A1A6] mb-3">Category</p>
              <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
                <button
                  onClick={() => selectType('')}
                  className={`px-4 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg border transition-colors ${
                    !activeType
                      ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                      : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:border-[#BFBFC4] hover:text-[#1D1D1F]'
                  }`}
                >
                  All
                </button>
                {availableTypes.map(t => {
                  const meta = TYPE_META[t];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={t}
                      onClick={() => selectType(t)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg border transition-colors ${
                        activeType === t
                          ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                          : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:border-[#BFBFC4] hover:text-[#1D1D1F]'
                      }`}
                    >
                      <Icon size={13} />{meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specific game/app pills, within the selected type */}
          {gamesForType.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#A1A1A6] mb-3">
                {activeType ? TYPE_META[activeType].label : 'Browse'}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
                <button
                  onClick={() => selectGame('all')}
                  className={`px-4 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg border transition-colors ${
                    activeGame === 'all'
                      ? 'bg-[#4ECDC4] text-white border-[#4ECDC4]'
                      : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:border-[#4ECDC4]/50 hover:text-[#1D1D1F]'
                  }`}
                >
                  All
                </button>
                {gamesForType.map(g => (
                  <button
                    key={g.id}
                    onClick={() => selectGame(g.id)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg border transition-colors ${
                      activeGame === g.id
                        ? 'bg-[#4ECDC4] text-white border-[#4ECDC4]'
                        : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:border-[#4ECDC4]/50 hover:text-[#1D1D1F]'
                    }`}
                  >
                    {g.label}
                    <span className="opacity-60">({g.product_count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {loading ? (
            <div className="py-24 flex justify-center">
              <CircleNotch size={24} className="animate-spin text-[#A1A1A6]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <ShoppingCart size={32} className="mx-auto mb-4 text-[#BFBFC4]" />
              <p className="text-sm text-[#A1A1A6]">No products available here yet.</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featured.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[#A1A1A6] mb-4 flex items-center gap-2">
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
                    <p className="text-[10px] font-semibold text-[#A1A1A6] mb-4">All Offers</p>
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
      <footer className="bg-[#1D1D1F] mt-16 py-8 px-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-bold tracking-[0.18em] text-white">VAKAR GAMES</span>
          <p className="text-xs text-[#3A3A3C]">Secure payments powered by Stripe.</p>
        </div>
      </footer>

      {/* Buy modal */}
      {buying && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-[#1D1D1F]/40" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
          <div className="animate-appear rounded-2xl liquid-glass w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#D2D2D7]/60 flex items-center justify-between">
              <h3 className="font-bold text-[#1D1D1F] text-sm">{buying.name}</h3>
              <button onClick={() => setBuying(null)} className="p-1 text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Product summary */}
              <div className="rounded-xl flex items-center gap-4 p-4 bg-[#F5F5F7] border border-[#D2D2D7]">
                {buying.image_url && (
                  <img
                    src={buying.image_url.startsWith('/') ? `${API_URL}${buying.image_url}` : buying.image_url}
                    alt=""
                    className="w-14 h-14 object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[#1D1D1F] truncate">{buying.name}</p>
                  {buying.description && <p className="text-xs text-[#6E6E73] truncate">{buying.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  {(discount > 0 || couponExtraDiscount > 0) && (
                    <p className="text-xs text-[#A1A1A6] line-through">${(buying.price / 100).toFixed(2)}</p>
                  )}
                  <p className="text-lg font-bold text-[#1D1D1F]">${(finalPrice / 100).toFixed(2)}</p>
                </div>
              </div>

              {/* Loyalty discount info */}
              {discount > 0 && loyalty && (
                <div className="rounded-lg flex items-center gap-3 p-3 border border-[#4ECDC4]/20 bg-[#4ECDC4]/5">
                  <GradeBadge tier={loyalty.tier} />
                  <p className="text-xs text-[#4ECDC4] font-semibold">
                    {discount}% loyalty discount applied
                  </p>
                </div>
              )}

              {/* Promo coupon */}
              <div>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] mb-1.5">
                  Promo code <span className="text-[#BFBFC4] normal-case font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null); }}
                    placeholder="VG-XXXXXXXX"
                    className="rounded-lg flex-1 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm px-3 py-2.5 focus:outline-none focus:border-[#4ECDC4] font-mono tracking-wide placeholder:text-[#A1A1A6] placeholder:font-sans placeholder:tracking-normal"
                  />
                  <button
                    onClick={checkCoupon}
                    disabled={!couponCode.trim() || couponChecking}
                    className="rounded-xl shrink-0 text-xs font-semibold border border-[#D2D2D7] hover:border-[#4ECDC4] text-[#6E6E73] hover:text-[#4ECDC4] px-3 py-2.5 transition-colors disabled:opacity-40"
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
                <label className="block text-[10px] font-semibold text-[#A1A1A6] mb-1.5">
                  Your in-game Player ID
                </label>
                <input
                  type="text"
                  value={uid}
                  onChange={e => { setUid(e.target.value); setBuyError(''); }}
                  placeholder="player_12345"
                  className="rounded-lg w-full bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm px-4 py-2.5 focus:outline-none focus:border-[#4ECDC4] focus:ring-2 focus:ring-[#4ECDC4]/20 transition-all placeholder:text-[#A1A1A6]"
                  onKeyDown={e => e.key === 'Enter' && handleBuy()}
                  autoFocus
                />
                <p className="text-[10px] text-[#A1A1A6] mt-1.5">Item delivered once payment is confirmed.</p>
                {buyError && <p className="text-xs text-red-500 mt-1.5 font-medium">{buyError}</p>}
              </div>

              <PublicButton onClick={handleBuy} disabled={checkoutLoading} size="lg" className="w-full">
                {checkoutLoading
                  ? <><CircleNotch size={15} className="animate-spin" />Redirecting…</>
                  : `Pay $${(finalPrice / 100).toFixed(2)} with Stripe`
                }
              </PublicButton>

              <p className="text-center text-[10px] text-[#A1A1A6]">
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
      className="group flex gap-4 p-5 rounded-xl bg-white border border-[#D2D2D7] hover:border-[#BFBFC4] cursor-pointer transition-colors"
      onClick={() => onBuy(product)}
    >
      {img && <img src={img} alt={product.name} className="w-20 h-20 object-cover shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {product.badge && <BadgePill badge={product.badge} discount_pct={product.discount_pct} />}
          <h3 className="font-bold text-sm text-[#1D1D1F] leading-tight">{product.name}</h3>
        </div>
        {product.description && <p className="text-xs text-[#6E6E73] mb-3 line-clamp-2">{product.description}</p>}
        <div className="flex items-center justify-between">
          <div>
            {discount > 0 && <p className="text-xs text-[#A1A1A6] line-through">${(product.price / 100).toFixed(2)}</p>}
            <p className="text-lg font-bold text-[#1D1D1F]">${(finalPrice / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-lg flex items-center gap-1.5 bg-[#1D1D1F] group-hover:bg-black text-white text-xs font-semibold px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.1),0_6px_16px_-8px_rgba(0,0,0,0.45)] transition-colors">
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
      className="group flex flex-col rounded-xl bg-white border border-[#D2D2D7] hover:border-[#BFBFC4] cursor-pointer transition-colors overflow-hidden"
      onClick={() => onBuy(product)}
    >
      {/* Image */}
      <div className="relative w-full bg-[#F5F5F7]" style={{ height: 140 }}>
        {img
          ? <img src={img} alt={product.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={24} className="text-[#BFBFC4]" /></div>
        }
        {product.badge && (
          <div className="absolute top-2 left-2">
            <BadgePill badge={product.badge} discount_pct={product.discount_pct} />
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-xs text-[#1D1D1F] leading-tight mb-1 line-clamp-1">{product.name}</h3>
        {product.description && <p className="text-[11px] text-[#6E6E73] mb-2 line-clamp-2">{product.description}</p>}
        <div className="flex items-center justify-between mt-auto">
          <div>
            {discount > 0 && <p className="text-[10px] text-[#A1A1A6] line-through">${(product.price / 100).toFixed(2)}</p>}
            <p className="text-sm font-bold text-[#1D1D1F]">${(finalPrice / 100).toFixed(2)}</p>
          </div>
          <span className="rounded-md text-[10px] font-semibold text-white bg-[#1D1D1F] group-hover:bg-black px-2 py-1 transition-colors">Get</span>
        </div>
      </div>
    </div>
  );
};

export default Shop;
