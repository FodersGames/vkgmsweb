import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ShoppingCart, X, Loader2, ArrowLeft, Link2, Gift, Star, Clock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BADGE_COLORS = {
  NEW:     { bg: '#4ECDC4', text: '#fff' },
  SALE:    { bg: '#EB5757', text: '#fff' },
  LIMITED: { bg: '#F2994A', text: '#fff' },
  HOT:     { bg: '#FF6B6B', text: '#fff' },
  POPULAR: { bg: '#A29BFE', text: '#fff' },
};

const BANNER_HEIGHT = { sm: 160, md: 260, lg: 380 };

// Format seconds → HH:MM:SS
const formatCountdown = (seconds) => {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
};

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = ({ p, primary, priceColor, surfaceColor, borderColor, textColor, textMuted, cardRadius, cardShadow, isRounded, onBuy, onCopyLink }) => {
  const badge  = BADGE_COLORS[p.badge];
  const imgSrc = p.image_url?.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url;

  return (
    <div
      className={!surfaceColor && !borderColor ? 'bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden flex flex-col group cursor-pointer' : 'overflow-hidden flex flex-col group cursor-pointer'}
      style={{ borderRadius: cardRadius, boxShadow: cardShadow, ...(surfaceColor ? { backgroundColor: surfaceColor } : {}), ...(borderColor ? { border: `1px solid ${borderColor}` } : {}) }}
      onClick={() => onBuy(p)}
    >
      {/* Image area */}
      <div className="relative overflow-hidden" style={{ height: 180 }}>
        <div className={`absolute inset-0 ${!surfaceColor ? 'bg-zinc-100 dark:bg-[#1c1c2e]' : ''}`}
          style={surfaceColor ? { backgroundColor: `${surfaceColor}cc` } : undefined} />
        {imgSrc
          ? <img src={imgSrc} alt={p.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="absolute inset-0 flex items-center justify-center opacity-30"><ShoppingCart size={40} /></div>
        }
        {/* Gradient overlay at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: `linear-gradient(to top, ${surfaceColor || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#151520' : '#ffffff')}ee, transparent)` }} />
        {/* Badges */}
        {badge && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 text-[10px] font-black rounded-full uppercase z-10 tracking-wider"
            style={{ backgroundColor: badge.bg, color: badge.text }}>
            {p.badge}{p.badge === 'SALE' && p.discount_pct ? ` -${p.discount_pct}%` : ''}
          </span>
        )}
        {p.featured && (
          <span className="absolute top-2.5 right-2.5 z-10">
            <Star size={16} className="text-yellow-400 fill-yellow-400 drop-shadow" />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-2 pb-4 flex flex-col flex-1">
        <h3 className={`font-bold text-sm mb-0.5 leading-tight ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`}
          style={textColor ? { color: textColor } : undefined}>
          {p.name}
        </h3>
        {p.description && (
          <p className={`text-xs mb-2 line-clamp-2 leading-relaxed ${!textMuted ? 'text-zinc-500 dark:text-[#71717a]' : ''}`}
            style={textMuted ? { color: textMuted } : undefined}>
            {p.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-lg font-black" style={{ color: priceColor }}>
            €{(p.price / 100).toFixed(2)}
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={e => { e.stopPropagation(); onCopyLink(p); }}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: textMuted || '#71717a' }}>
              <Link2 size={12} />
            </button>
            <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, borderRadius: isRounded ? 8 : 2 }}>
              <ShoppingCart size={11} />Get
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Featured Card (larger) ───────────────────────────────────────────────────
const FeaturedCard = ({ p, primary, priceColor, surfaceColor, borderColor, textColor, textMuted, cardRadius, cardShadow, isRounded, onBuy, onCopyLink }) => {
  const badge  = BADGE_COLORS[p.badge];
  const imgSrc = p.image_url?.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url;

  return (
    <div
      className={`relative overflow-hidden flex flex-col group cursor-pointer ${!surfaceColor && !borderColor ? 'bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c]' : ''}`}
      style={{ borderRadius: cardRadius, boxShadow: cardShadow, ...(surfaceColor ? { backgroundColor: surfaceColor } : {}), ...(borderColor ? { border: `1px solid ${borderColor}` } : {}) }}
      onClick={() => onBuy(p)}
    >
      {/* Full image */}
      <div className="relative" style={{ height: 220 }}>
        {imgSrc
          ? <img src={imgSrc} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}><ShoppingCart size={48} style={{ color: primary, opacity: 0.4 }} /></div>
        }
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${surfaceColor || '#000000'}ee 40%, transparent 80%)` }} />
        {badge && (
          <span className="absolute top-3 left-3 px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider"
            style={{ backgroundColor: badge.bg, color: badge.text }}>
            {p.badge}{p.badge === 'SALE' && p.discount_pct ? ` -${p.discount_pct}%` : ''}
          </span>
        )}
        {/* Overlaid content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-black text-lg text-white leading-tight mb-1 drop-shadow">{p.name}</h3>
          {p.description && <p className="text-white/70 text-xs line-clamp-1">{p.description}</p>}
          <div className="flex items-center justify-between mt-3">
            <span className="text-2xl font-black" style={{ color: priceColor }}>{`€${(p.price / 100).toFixed(2)}`}</span>
            <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-black text-white rounded-lg"
              style={{ backgroundColor: primary, borderRadius: isRounded ? 10 : 2 }}>
              <ShoppingCart size={14} />Get
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Shop page ───────────────────────────────────────────────────────────
const Shop = () => {
  const { gameSlug } = useParams();
  const [searchParams] = useSearchParams();

  const [products, setProducts]             = useState([]);
  const [settings, setSettings]             = useState(null);
  const [gift, setGift]                     = useState(null);
  const [loading, setLoading]               = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  // Buy modal
  const [buyingProduct, setBuyingProduct]   = useState(null);
  const [uid, setUid]                       = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [buyError, setBuyError]             = useState('');

  // Daily gift
  const [giftUid, setGiftUid]               = useState('');
  const [giftClaiming, setGiftClaiming]     = useState(false);
  const [giftClaimed, setGiftClaimed]       = useState(false);
  const [giftError, setGiftError]           = useState('');
  const [countdown, setCountdown]           = useState(0);

  // ── Theme vars ────────────────────────────────────────────────────────────
  const primary       = settings?.primary_color    || '#6C5CE7';
  const accent        = settings?.accent_color     || '#A29BFE';
  const priceColor    = settings?.price_color      || primary;
  const bgColor       = settings?.background_color || null;
  const surfaceColor  = settings?.surface_color    || null;
  const borderColor   = settings?.border_color     || null;
  const textColor     = settings?.text_color       || null;
  const textMuted     = settings?.text_muted_color || null;
  const bannerOverlay = settings?.banner_overlay   || 'rgba(0,0,0,0.55)';
  const bannerHeight  = BANNER_HEIGHT[settings?.banner_height || 'md'];
  const isRounded     = (settings?.card_style || 'rounded') === 'rounded';
  const cardRadius    = isRounded ? '1rem' : '0.25rem';
  const cardShadow    = settings?.card_shadow === 'glow'   ? `0 0 20px ${primary}55` :
                        settings?.card_shadow === 'md'     ? '0 4px 16px rgba(0,0,0,0.3)' :
                        settings?.card_shadow === 'none'   ? 'none' :
                                                             '0 1px 4px rgba(0,0,0,0.15)';
  const categories    = settings?.categories || [];

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prodRes, settRes, giftRes] = await Promise.all([
          axios.get(`${API_URL}/api/shop/${gameSlug}/products`),
          axios.get(`${API_URL}/api/shop/${gameSlug}/settings`),
          axios.get(`${API_URL}/api/shop/${gameSlug}/daily-gift`).catch(() => ({ data: { active: false } })),
        ]);
        setProducts(prodRes.data.products || []);
        setSettings(settRes.data);
        if (giftRes.data.active) {
          setGift(giftRes.data);
          setCountdown(giftRes.data.seconds_until_reset || 0);
        }
      } catch (e) {}
      finally { setLoading(false); }
    };
    load();
  }, [gameSlug]);

  // Auto-open modal if ?product= in URL
  useEffect(() => {
    if (products.length === 0) return;
    const productId = searchParams.get('product');
    if (productId) {
      const found = products.find(p => p.id === productId);
      if (found) { setBuyingProduct(found); setUid(''); setBuyError(''); }
    }
  }, [products, searchParams]);

  // Countdown timer
  useEffect(() => {
    if (!gift?.active) return;
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [gift?.active]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const copyProductLink = (p) => {
    const url = `${window.location.origin}/shop/${gameSlug}?product=${p.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  };

  const handleBuy = async () => {
    if (!uid.trim()) { setBuyError('Please enter your in-game Player ID.'); return; }
    setBuyError('');
    setCheckoutLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/shop/${gameSlug}/checkout`, {
        product_id: buyingProduct.id, player_uid: uid.trim(),
      });
      window.location.href = r.data.checkout_url;
    } catch (e) {
      setBuyError(e.response?.data?.detail || 'Payment service unavailable. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const checkGiftStatus = useCallback(async (uid) => {
    if (!uid.trim()) return;
    try {
      const r = await axios.get(`${API_URL}/api/shop/${gameSlug}/daily-gift?player_uid=${encodeURIComponent(uid.trim())}`);
      if (r.data.claimed) { setGiftClaimed(true); setGiftError(''); }
      else { setGiftClaimed(false); }
    } catch (e) {}
  }, [gameSlug]);

  const handleClaimGift = async () => {
    if (!giftUid.trim()) { setGiftError('Enter your Player ID.'); return; }
    setGiftClaiming(true); setGiftError('');
    try {
      await axios.post(`${API_URL}/api/shop/${gameSlug}/daily-gift/claim`, { player_uid: giftUid.trim() });
      setGiftClaimed(true);
      toast.success('Daily gift claimed! Check your in-game account.');
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to claim gift.';
      if (e.response?.status === 409) { setGiftClaimed(true); setGiftError(''); }
      else { setGiftError(msg); }
    } finally { setGiftClaiming(false); }
  };

  // ── Filtered products ─────────────────────────────────────────────────────
  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter(p => p.category === activeCategory);

  const featuredProducts = filteredProducts.filter(p => p.featured);
  const regularProducts  = filteredProducts.filter(p => !p.featured);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0d0d14]">
        <Loader2 size={32} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  const title = settings?.shop_title || 'Shop';
  const bannerBg = settings?.banner_url
    ? `linear-gradient(${bannerOverlay}, ${bannerOverlay}), url(${settings.banner_url.startsWith('/') ? API_URL + settings.banner_url : settings.banner_url}) center/cover no-repeat`
    : `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`;

  return (
    <div
      className={!bgColor ? 'min-h-screen bg-zinc-50 dark:bg-[#0d0d14]' : 'min-h-screen'}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      {/* Background texture */}
      {settings?.bg_texture_url && (
        <div className="fixed inset-0 pointer-events-none z-0"
          style={{ backgroundImage: `url(${settings.bg_texture_url})`, backgroundRepeat: 'repeat', opacity: settings.bg_texture_opacity ?? 0.05 }} />
      )}

      {/* ── HERO BANNER ─────────────────────────────────────────────────────── */}
      <div className="relative w-full z-10" style={{ background: bannerBg, minHeight: bannerHeight }}>
        {/* Decorative bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${bgColor || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#0d0d14' : '#f4f4f8')} )` }} />
        <div className="relative max-w-6xl mx-auto px-6 flex flex-col items-center justify-center text-center"
          style={{ minHeight: bannerHeight, paddingTop: 40, paddingBottom: 40 }}>
          <Link to="/" className="absolute top-5 left-6 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} />Back
          </Link>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-lg"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            {title}
          </h1>
          {settings?.banner_subtitle && (
            <p className="text-white/75 text-sm sm:text-base max-w-md mt-2 drop-shadow">{settings.banner_subtitle}</p>
          )}
        </div>
      </div>

      {/* ── DAILY GIFT ──────────────────────────────────────────────────────── */}
      {gift?.active && (
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 -mt-4 mb-6">
          <div className="rounded-2xl overflow-hidden border"
            style={{
              background: `linear-gradient(135deg, ${primary}22, ${accent}22)`,
              borderColor: `${primary}40`,
              boxShadow: `0 0 30px ${primary}25`,
            }}>
            <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Gift image */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2" style={{ borderColor: `${primary}60` }}>
                  {gift.image_url
                    ? <img src={gift.image_url.startsWith('/') ? `${API_URL}${gift.image_url}` : gift.image_url} alt="gift" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primary}30` }}><Gift size={28} style={{ color: primary }} /></div>
                  }
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                  style={{ backgroundColor: primary }}>🎁</div>
              </div>

              {/* Gift info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${primary}30`, color: primary }}>DAILY FREE</span>
                  <h3 className={`font-black text-base ${!textColor ? 'text-zinc-900 dark:text-white' : ''}`}
                    style={textColor ? { color: textColor } : undefined}>{gift.title}</h3>
                </div>
                {gift.description && (
                  <p className={`text-xs ${!textMuted ? 'text-zinc-500 dark:text-white/60' : ''}`}
                    style={textMuted ? { color: textMuted } : undefined}>{gift.description}</p>
                )}
                {/* Countdown */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock size={10} style={{ color: textMuted || '#71717a' }} />
                  <span className="text-xs font-mono font-semibold" style={{ color: textMuted || '#71717a' }}>
                    Resets in {formatCountdown(countdown)}
                  </span>
                </div>
              </div>

              {/* Claim form */}
              <div className="w-full sm:w-auto flex-shrink-0">
                {giftClaimed ? (
                  <div className="text-center px-4 py-2 rounded-xl" style={{ backgroundColor: `${primary}20`, border: `1px solid ${primary}40` }}>
                    <p className="text-xs font-bold" style={{ color: primary }}>✓ Claimed!</p>
                    <p className="text-[10px]" style={{ color: textMuted || '#71717a' }}>Come back tomorrow</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={giftUid}
                      onChange={e => { setGiftUid(e.target.value); setGiftError(''); }}
                      onBlur={() => checkGiftStatus(giftUid)}
                      placeholder="Your Player ID"
                      className={`w-36 text-xs px-3 py-2.5 rounded-xl border focus:outline-none transition-all ${!surfaceColor ? 'bg-white dark:bg-[#1c1c2e] border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-white' : ''}`}
                      style={surfaceColor ? { backgroundColor: surfaceColor, borderColor: borderColor || `${primary}40`, color: textColor || undefined } : undefined}
                    />
                    <button
                      onClick={handleClaimGift}
                      disabled={giftClaiming}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                      style={{ backgroundColor: primary, borderRadius: isRounded ? 12 : 4 }}>
                      {giftClaiming ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
                      Claim
                    </button>
                  </div>
                )}
                {giftError && <p className="text-xs text-red-400 mt-1">{giftError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORY TABS ───────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0"
              style={activeCategory === 'all' ? { backgroundColor: primary, color: '#fff' } : { backgroundColor: `${primary}15`, color: textColor || undefined }}>
              All
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0"
                style={activeCategory === c.id ? { backgroundColor: primary, color: '#fff' } : { backgroundColor: `${primary}15`, color: textColor || undefined }}>
                {c.emoji && <span>{c.emoji}</span>}{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PRODUCTS ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-24" style={textMuted ? { color: textMuted } : undefined}>
            <ShoppingCart size={44} className={`mx-auto mb-4 opacity-25 ${!textMuted ? 'text-zinc-400' : ''}`} />
            <p className={`font-semibold ${!textMuted ? 'text-zinc-400 dark:text-[#71717a]' : ''}`}>No products available.</p>
          </div>
        ) : (
          <>
            {/* Featured section */}
            {featuredProducts.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <Star size={16} className="fill-yellow-400 text-yellow-400" />
                  <h2 className={`text-lg font-black uppercase tracking-wider ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`}
                    style={textColor ? { color: textColor } : undefined}>
                    {settings?.featured_section_title || 'Featured Offers'}
                  </h2>
                  <div className="h-px flex-1" style={{ backgroundColor: borderColor || undefined, opacity: 0.4 }} />
                </div>
                <div className={`grid gap-4 ${featuredProducts.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {featuredProducts.map(p => (
                    <FeaturedCard key={p.id} p={p} primary={primary} priceColor={priceColor}
                      surfaceColor={surfaceColor} borderColor={borderColor} textColor={textColor}
                      textMuted={textMuted} cardRadius={cardRadius} cardShadow={cardShadow}
                      isRounded={isRounded} onBuy={setBuyingProduct} onCopyLink={copyProductLink} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular products */}
            {regularProducts.length > 0 && (
              <div>
                {featuredProducts.length > 0 && (
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className={`text-lg font-black uppercase tracking-wider ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`}
                      style={textColor ? { color: textColor } : undefined}>All Offers</h2>
                    <div className="h-px flex-1" style={{ backgroundColor: borderColor || undefined, opacity: 0.4 }} />
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {regularProducts.map(p => (
                    <ProductCard key={p.id} p={p} primary={primary} priceColor={priceColor}
                      surfaceColor={surfaceColor} borderColor={borderColor} textColor={textColor}
                      textMuted={textMuted} cardRadius={cardRadius} cardShadow={cardShadow}
                      isRounded={isRounded} onBuy={setBuyingProduct} onCopyLink={copyProductLink} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        {settings?.footer_text && (
          <p className="text-center text-xs mt-10 opacity-50" style={textMuted ? { color: textMuted } : { color: '#71717a' }}>
            {settings.footer_text}
          </p>
        )}
      </div>

      {/* ── BUY MODAL ───────────────────────────────────────────────────────── */}
      {buyingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#151520] rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a3c] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
                  <ShoppingCart size={16} style={{ color: primary }} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-[#e4e4e7] text-sm">{buyingProduct.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-[#71717a]">Complete your purchase</p>
                </div>
              </div>
              <button onClick={() => setBuyingProduct(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1c1c2e] transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Product summary */}
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-[#1c1c2e] rounded-xl border border-zinc-200 dark:border-[#2a2a3c]">
                {buyingProduct.image_url && (
                  <img src={buyingProduct.image_url.startsWith('/') ? `${API_URL}${buyingProduct.image_url}` : buyingProduct.image_url} alt="" className="w-14 h-14 object-cover rounded-xl" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-zinc-900 dark:text-[#e4e4e7] truncate">{buyingProduct.name}</p>
                  {buyingProduct.description && <p className="text-xs text-zinc-500 dark:text-[#71717a] truncate">{buyingProduct.description}</p>}
                </div>
                <span className="font-black text-2xl shrink-0" style={{ color: priceColor }}>
                  €{(buyingProduct.price / 100).toFixed(2)}
                </span>
              </div>
              {/* Player ID */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-[#71717a] mb-2 uppercase tracking-wider">Your in-game Player ID</label>
                <input type="text" value={uid} onChange={e => { setUid(e.target.value); setBuyError(''); }}
                  placeholder="player_12345"
                  className="w-full bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-xl text-sm px-4 py-3 focus:outline-none transition-all"
                  style={{ borderColor: uid ? primary : undefined }}
                  onKeyDown={e => e.key === 'Enter' && handleBuy()} autoFocus />
                <p className="text-xs text-zinc-400 dark:text-[#71717a] mt-1.5">The item will be delivered once payment is confirmed.</p>
                {buyError && <p className="text-xs text-red-500 mt-1.5 font-medium">{buyError}</p>}
              </div>
              <button onClick={handleBuy} disabled={checkoutLoading}
                className="w-full py-3.5 rounded-xl text-sm font-black text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: primary }}>
                {checkoutLoading ? <><Loader2 size={16} className="animate-spin" />Redirecting...</> : `Pay €${(buyingProduct.price / 100).toFixed(2)} with Stripe`}
              </button>
              <p className="text-center text-xs text-zinc-400 dark:text-[#71717a]">Secure payment powered by Stripe.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
