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

const BANNER_HEIGHT = { sm: 140, md: 220, lg: 320 };

const formatCountdown = (s) => {
  if (s <= 0) return '00:00:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
};

const Shop = () => {
  const { gameSlug } = useParams();
  const [searchParams] = useSearchParams();

  const [products, setProducts]           = useState([]);
  const [settings, setSettings]           = useState(null);
  const [gift, setGift]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  const [buyingProduct, setBuyingProduct] = useState(null);
  const [uid, setUid]                     = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [buyError, setBuyError]           = useState('');

  const [giftUid, setGiftUid]             = useState('');
  const [giftClaiming, setGiftClaiming]   = useState(false);
  const [giftClaimed, setGiftClaimed]     = useState(false);
  const [giftError, setGiftError]         = useState('');
  const [countdown, setCountdown]         = useState(0);

  // Theme
  const primary      = settings?.primary_color    || '#6C5CE7';
  const accent       = settings?.accent_color     || '#A29BFE';
  const priceColor   = settings?.price_color      || primary;
  const bgColor      = settings?.background_color || null;
  const surfaceColor = settings?.surface_color    || null;
  const borderColor  = settings?.border_color     || null;
  const textColor    = settings?.text_color       || null;
  const textMuted    = settings?.text_muted_color || null;
  const bannerH      = BANNER_HEIGHT[settings?.banner_height || 'md'];
  const bannerOverlay = settings?.banner_overlay  || 'rgba(0,0,0,0.55)';
  const isRounded    = (settings?.card_style || 'rounded') === 'rounded';
  const cardRadius   = isRounded ? '0.75rem' : '0.25rem';
  const categories   = settings?.categories || [];

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

  useEffect(() => {
    if (products.length === 0) return;
    const id = searchParams.get('product');
    if (id) { const found = products.find(p => p.id === id); if (found) { setBuyingProduct(found); setUid(''); setBuyError(''); } }
  }, [products, searchParams]);

  useEffect(() => {
    if (!gift?.active || countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [gift?.active, countdown]);

  const copyLink = (p) => {
    navigator.clipboard.writeText(`${window.location.origin}/shop/${gameSlug}?product=${p.id}`)
      .then(() => toast.success('Link copied!'));
  };

  const handleBuy = async () => {
    if (!uid.trim()) { setBuyError('Please enter your in-game Player ID.'); return; }
    setBuyError(''); setCheckoutLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/shop/${gameSlug}/checkout`, { product_id: buyingProduct.id, player_uid: uid.trim() });
      window.location.href = r.data.checkout_url;
    } catch (e) { setBuyError(e.response?.data?.detail || 'Payment unavailable. Please try again.'); setCheckoutLoading(false); }
  };

  const checkClaimed = useCallback(async (u) => {
    if (!u.trim()) return;
    try {
      const r = await axios.get(`${API_URL}/api/shop/${gameSlug}/daily-gift?player_uid=${encodeURIComponent(u.trim())}`);
      if (r.data.claimed) setGiftClaimed(true);
    } catch (e) {}
  }, [gameSlug]);

  const handleClaim = async () => {
    if (!giftUid.trim()) { setGiftError('Enter your Player ID.'); return; }
    setGiftClaiming(true); setGiftError('');
    try {
      await axios.post(`${API_URL}/api/shop/${gameSlug}/daily-gift/claim`, { player_uid: giftUid.trim() });
      setGiftClaimed(true);
      toast.success('Daily gift claimed! Check your in-game account.');
    } catch (e) {
      if (e.response?.status === 409) { setGiftClaimed(true); }
      else { setGiftError(e.response?.data?.detail || 'Failed to claim.'); }
    } finally { setGiftClaiming(false); }
  };

  const filtered  = activeCategory === 'all' ? products : products.filter(p => p.category === activeCategory);
  const featured  = filtered.filter(p => p.featured);
  const regular   = filtered.filter(p => !p.featured);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0d0d14]">
      <Loader2 size={28} className="animate-spin text-zinc-400" />
    </div>
  );

  const bannerBg = settings?.banner_url
    ? `linear-gradient(${bannerOverlay}, ${bannerOverlay}), url(${settings.banner_url.startsWith('/') ? API_URL + settings.banner_url : settings.banner_url}) center/cover no-repeat`
    : `linear-gradient(135deg, ${primary}, ${accent})`;

  const pageStyle = bgColor ? { backgroundColor: bgColor } : undefined;
  const cardStyle = (extra = {}) => ({
    borderRadius: cardRadius,
    ...(surfaceColor ? { backgroundColor: surfaceColor } : {}),
    ...(borderColor  ? { border: `1px solid ${borderColor}` } : {}),
    ...extra,
  });

  return (
    <div className={!bgColor ? 'min-h-screen bg-zinc-50 dark:bg-[#0d0d14]' : 'min-h-screen'} style={pageStyle}>

      {/* Background texture */}
      {settings?.bg_texture_url && (
        <div className="fixed inset-0 pointer-events-none z-0"
          style={{ backgroundImage: `url(${settings.bg_texture_url})`, backgroundRepeat: 'repeat', opacity: settings.bg_texture_opacity ?? 0.05 }} />
      )}

      {/* ── BANNER ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10" style={{ background: bannerBg, minHeight: bannerH }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col items-center justify-center text-center relative" style={{ minHeight: bannerH, paddingTop: 32, paddingBottom: 32 }}>
          <Link to="/" className="absolute top-5 left-0 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors">
            <ArrowLeft size={15} />Back
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>
            {settings?.shop_title || 'Shop'}
          </h1>
          {settings?.banner_subtitle && (
            <p className="text-white/75 text-sm mt-1">{settings.banner_subtitle}</p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 relative z-10 space-y-6">

        {/* ── DAILY GIFT ────────────────────────────────────────────────────── */}
        {gift?.active && (
          <div className={`rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${!surfaceColor && !borderColor ? 'bg-white dark:bg-[#151520] border-zinc-200 dark:border-[#2a2a3c]' : ''}`}
            style={cardStyle()}>
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-[#2a2a3c]">
              {gift.image_url
                ? <img src={gift.image_url.startsWith('/') ? `${API_URL}${gift.image_url}` : gift.image_url} alt="gift" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}><Gift size={22} style={{ color: primary }} /></div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}20`, color: primary }}>DAILY GIFT</span>
                <span className={`font-bold text-sm ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`} style={textColor ? { color: textColor } : undefined}>{gift.title}</span>
              </div>
              {gift.description && <p className={`text-xs ${!textMuted ? 'text-zinc-500 dark:text-[#71717a]' : ''}`} style={textMuted ? { color: textMuted } : undefined}>{gift.description}</p>}
              <div className="flex items-center gap-1 mt-1">
                <Clock size={10} className="text-zinc-400" />
                <span className="text-xs font-mono text-zinc-400">Resets in {formatCountdown(countdown)}</span>
              </div>
            </div>
            <div className="shrink-0 w-full sm:w-auto">
              {giftClaimed ? (
                <div className="text-center px-4 py-2 rounded-lg border" style={{ borderColor: `${primary}40`, backgroundColor: `${primary}10` }}>
                  <p className="text-xs font-bold" style={{ color: primary }}>✓ Claimed</p>
                  <p className="text-[10px] text-zinc-400">Come back tomorrow</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" value={giftUid} onChange={e => { setGiftUid(e.target.value); setGiftError(''); }}
                    onBlur={() => checkClaimed(giftUid)} placeholder="Player ID"
                    className={`text-xs px-3 py-2 rounded-lg border w-32 focus:outline-none focus:ring-1 ${!surfaceColor ? 'bg-zinc-50 dark:bg-[#0d0d14] border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-white' : ''}`}
                    style={surfaceColor ? { backgroundColor: surfaceColor, borderColor: borderColor || '#3a3a4c', color: textColor || undefined } : { focusRingColor: primary }} />
                  <button onClick={handleClaim} disabled={giftClaiming}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90 whitespace-nowrap"
                    style={{ backgroundColor: primary, borderRadius: isRounded ? 8 : 3 }}>
                    {giftClaiming ? <Loader2 size={11} className="animate-spin" /> : <Gift size={11} />}Claim
                  </button>
                </div>
              )}
              {giftError && <p className="text-xs text-red-400 mt-1">{giftError}</p>}
            </div>
          </div>
        )}

        {/* ── CATEGORIES ────────────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ id: 'all', label: 'All', emoji: '' }, ...categories].map(c => (
              <button key={c.id} onClick={() => setActiveCategory(c.id)}
                className="flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0"
                style={activeCategory === c.id
                  ? { backgroundColor: primary, color: '#fff', borderColor: primary }
                  : { backgroundColor: 'transparent', color: textColor || undefined, borderColor: borderColor || undefined }}>
                {c.emoji && <span>{c.emoji}</span>}{c.label}
              </button>
            ))}
          </div>
        )}

        {/* ── PRODUCTS ──────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart size={36} className="mx-auto mb-3 opacity-20 text-zinc-400" />
            <p className={`text-sm ${!textMuted ? 'text-zinc-400 dark:text-[#71717a]' : ''}`} style={textMuted ? { color: textMuted } : undefined}>No products available.</p>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={14} className="fill-yellow-400 text-yellow-400" />
                  <h2 className={`text-sm font-black uppercase tracking-widest ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`} style={textColor ? { color: textColor } : undefined}>
                    {settings?.featured_section_title || 'Featured'}
                  </h2>
                </div>
                <div className={`grid gap-4 ${featured.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {featured.map(p => {
                    const badge = BADGE_COLORS[p.badge];
                    const img = p.image_url?.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url;
                    return (
                      <div key={p.id} onClick={() => setBuyingProduct(p)}
                        className={`cursor-pointer rounded-xl overflow-hidden flex gap-4 p-4 items-center ${!surfaceColor && !borderColor ? 'bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c]' : ''}`}
                        style={cardStyle()}>
                        {img && <img src={img} alt={p.name} className="w-20 h-20 object-cover rounded-lg shrink-0" style={{ borderRadius: cardRadius }} />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mr-1" style={{ backgroundColor: badge.bg, color: badge.text }}>{p.badge}{p.badge === 'SALE' && p.discount_pct ? ` -${p.discount_pct}%` : ''}</span>}
                              <h3 className={`font-bold text-sm ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`} style={textColor ? { color: textColor } : undefined}>{p.name}</h3>
                            </div>
                            <button onClick={e => { e.stopPropagation(); copyLink(p); }} className="p-1 opacity-40 hover:opacity-100 transition-opacity shrink-0"><Link2 size={12} className="text-zinc-400" /></button>
                          </div>
                          {p.description && <p className={`text-xs mt-1 ${!textMuted ? 'text-zinc-500 dark:text-[#71717a]' : ''}`} style={textMuted ? { color: textMuted } : undefined}>{p.description}</p>}
                          <div className="flex items-center justify-between mt-3">
                            <span className="font-black text-lg" style={{ color: priceColor }}>€{(p.price / 100).toFixed(2)}</span>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg" style={{ backgroundColor: primary, borderRadius: isRounded ? 8 : 2 }}>
                              <ShoppingCart size={11} />Buy
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Regular grid */}
            {regular.length > 0 && (
              <div>
                {featured.length > 0 && (
                  <h2 className={`text-sm font-black uppercase tracking-widest mb-3 ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`} style={textColor ? { color: textColor } : undefined}>All Offers</h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {regular.map(p => {
                    const badge = BADGE_COLORS[p.badge];
                    const img = p.image_url?.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url;
                    return (
                      <div key={p.id} onClick={() => setBuyingProduct(p)}
                        className={`cursor-pointer overflow-hidden flex flex-col ${!surfaceColor && !borderColor ? 'bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c]' : ''}`}
                        style={cardStyle()}>
                        {/* Image */}
                        <div className={`relative w-full ${!surfaceColor ? 'bg-zinc-100 dark:bg-[#1c1c2e]' : ''}`} style={{ height: 140, ...(surfaceColor ? { backgroundColor: surfaceColor } : {}) }}>
                          {img
                            ? <img src={img} alt={p.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={28} className="opacity-20 text-zinc-400" /></div>
                          }
                          {badge && (
                            <span className="absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-full uppercase"
                              style={{ backgroundColor: badge.bg, color: badge.text }}>
                              {p.badge}{p.badge === 'SALE' && p.discount_pct ? ` -${p.discount_pct}%` : ''}
                            </span>
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-3 flex flex-col flex-1">
                          <h3 className={`font-semibold text-xs leading-tight mb-0.5 ${!textColor ? 'text-zinc-900 dark:text-[#e4e4e7]' : ''}`} style={textColor ? { color: textColor } : undefined}>{p.name}</h3>
                          {p.description && <p className={`text-[11px] mb-2 line-clamp-2 ${!textMuted ? 'text-zinc-500 dark:text-[#71717a]' : ''}`} style={textMuted ? { color: textMuted } : undefined}>{p.description}</p>}
                          <div className="flex items-center justify-between mt-auto">
                            <span className="font-black text-sm" style={{ color: priceColor }}>€{(p.price / 100).toFixed(2)}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={e => { e.stopPropagation(); copyLink(p); }} className="p-1 opacity-40 hover:opacity-80 transition-opacity"><Link2 size={11} className="text-zinc-400" /></button>
                              <span className="text-[10px] font-bold text-white px-2 py-1 rounded" style={{ backgroundColor: primary, borderRadius: isRounded ? 5 : 2 }}>Get</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        {settings?.footer_text && (
          <p className="text-center text-xs pt-4 opacity-40" style={textMuted ? { color: textMuted } : { color: '#71717a' }}>{settings.footer_text}</p>
        )}
      </div>

      {/* ── BUY MODAL ───────────────────────────────────────────────────────── */}
      {buyingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#151520] rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a3c] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primary}18` }}>
                  <ShoppingCart size={16} style={{ color: primary }} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-[#e4e4e7] text-sm">{buyingProduct.name}</h3>
                  <p className="text-xs text-zinc-400">Complete your purchase</p>
                </div>
              </div>
              <button onClick={() => setBuyingProduct(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#1c1c2e] transition-all"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-[#1c1c2e] rounded-xl border border-zinc-200 dark:border-[#2a2a3c]">
                {buyingProduct.image_url && <img src={buyingProduct.image_url.startsWith('/') ? `${API_URL}${buyingProduct.image_url}` : buyingProduct.image_url} alt="" className="w-12 h-12 object-cover rounded-lg" />}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-zinc-900 dark:text-[#e4e4e7] truncate">{buyingProduct.name}</p>
                  {buyingProduct.description && <p className="text-xs text-zinc-400 truncate">{buyingProduct.description}</p>}
                </div>
                <span className="font-black text-xl shrink-0" style={{ color: priceColor }}>€{(buyingProduct.price / 100).toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-[#71717a] mb-1.5 uppercase tracking-wider">Your in-game Player ID</label>
                <input type="text" value={uid} onChange={e => { setUid(e.target.value); setBuyError(''); }}
                  placeholder="player_12345"
                  className="w-full bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-xl text-sm px-4 py-3 focus:outline-none transition-all"
                  style={{ borderColor: uid ? primary : undefined }}
                  onKeyDown={e => e.key === 'Enter' && handleBuy()} autoFocus />
                <p className="text-xs text-zinc-400 mt-1.5">Item delivered once payment is confirmed.</p>
                {buyError && <p className="text-xs text-red-500 mt-1 font-medium">{buyError}</p>}
              </div>
              <button onClick={handleBuy} disabled={checkoutLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: primary }}>
                {checkoutLoading ? <><Loader2 size={15} className="animate-spin" />Redirecting...</> : `Pay €${(buyingProduct.price / 100).toFixed(2)} with Stripe`}
              </button>
              <p className="text-center text-xs text-zinc-400">Secure payment powered by Stripe.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
