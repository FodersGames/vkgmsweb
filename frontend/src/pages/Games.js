import React, { useState, useEffect } from 'react';
import { ArrowSquareOut, CircleNotch, CheckCircle, ShoppingCart, Tag, X, GameController } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { HoverPreview } from '../components/HoverPreview';
import { PublicButton } from '../ui/PublicButton';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const PLATFORM_ICONS = {
  steam:       { label: 'Steam',        svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012zm8.397-8.308a3.02 3.02 0 00-3.015-3.015 3.02 3.02 0 00-3.015 3.015 3.02 3.02 0 003.015 3.015 3.02 3.02 0 003.015-3.015zm-5.273-.008a2.262 2.262 0 012.256-2.256 2.262 2.262 0 012.256 2.256 2.262 2.262 0 01-2.256 2.256 2.262 2.262 0 01-2.256-2.256z"/></svg> },
  google_play: { label: 'Google Play',  svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 1.332L16.698 12l3.302-2.493zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg> },
  apple:       { label: 'App Store',    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> },
  pc:          { label: 'PC',           svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg> },
  web:         { label: 'Web',          svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  android:     { label: 'Android',      svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.523 15.341c-.583 0-1.055.473-1.055 1.056s.473 1.055 1.055 1.055c.583 0 1.056-.473 1.056-1.055s-.474-1.056-1.056-1.056zm-11.046 0c-.583 0-1.055.473-1.055 1.056s.473 1.055 1.055 1.055c.583 0 1.056-.473 1.056-1.055s-.473-1.056-1.056-1.056zm11.405-6.02l1.945-3.368c.108-.188.044-.429-.144-.537-.188-.108-.429-.044-.537.144l-1.97 3.41c-1.479-.672-3.14-1.047-4.89-1.047s-3.411.375-4.89 1.047l-1.97-3.41c-.108-.188-.349-.252-.537-.144-.188.108-.252.349-.144.537l1.945 3.368C3.013 11.18.612 14.04.612 17.353h22.776c0-3.313-2.401-6.173-5.506-8.032z"/></svg> },
};


const GamesPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [purchaseError, setPurchaseError] = useState({ slug: '', msg: '' });
  const [ownedSlugs, setOwnedSlugs] = useState(new Set());
  const [buyingSlug, setBuyingSlug] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);

  useEffect(() => {
    document.title = 'Games — Vakar Games';
    axios.get(`${API_URL}/api/website/games/public`)
      .then(r => { setGames(r.data.games); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token || games.length === 0) return;
    const paidPublished = games.filter(g => g.price_cents > 0 && g.status === 'published');
    if (paidPublished.length === 0) return;
    Promise.all(
      paidPublished.map(g =>
        axios.get(`${API_URL}/api/games/${g.slug}/purchased`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.data.purchased ? g.slug : null)
          .catch(() => null)
      )
    ).then(results => setOwnedSlugs(new Set(results.filter(Boolean))));
  }, [token, games]);

  const openBuy = (game) => {
    if (!user) { navigate('/login'); return; }
    setBuyingSlug(game.slug);
    setCouponCode('');
    setCouponStatus(null);
    setPurchaseError({ slug: '', msg: '' });
  };

  const checkGameCoupon = async (gameSlug) => {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    setCouponStatus(null);
    try {
      const r = await axios.post(
        `${API_URL}/api/coupons/validate`,
        { code: couponCode.trim(), game_slug: gameSlug },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCouponStatus({ valid: true, discount_pct: r.data.discount_pct });
    } catch (e) {
      setCouponStatus({ valid: false, error: e.response?.data?.detail || 'Invalid coupon code.' });
    } finally {
      setCouponChecking(false);
    }
  };

  const buyGame = async (game) => {
    setPurchasing(game.slug);
    setPurchaseError({ slug: '', msg: '' });
    try {
      const r = await axios.post(
        `${API_URL}/api/games/${game.slug}/checkout`,
        { coupon_code: couponStatus?.valid ? couponCode.trim() : '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = r.data.checkout_url;
    } catch (e) {
      setPurchaseError({ slug: game.slug, msg: e.response?.data?.detail || 'Purchase failed. Please try again.' });
      setPurchasing(null);
    }
  };

  const imgUrl = (url) => url?.startsWith('/') ? `${API_URL}${url}` : url;

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh' }}>
      <PublicNav />

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div
        style={{ paddingTop: '60px', backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <p className="kefir-label mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Our Productions</p>
          <h1
            className="font-black uppercase text-white"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            Games
          </h1>
          <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Every title we release. Each one built with care.
          </p>
        </div>
      </div>

      {/* ── Games list ──────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-6 py-16">
        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <CircleNotch size={32} className="animate-spin mx-auto mb-4" />
            Loading…
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-20">
            <GameController size={48} style={{ color: 'rgba(78,205,196,0.3)', margin: '0 auto 1rem' }} />
            <h2 className="font-black uppercase text-white text-2xl tracking-tight mb-3">
              In Development
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)' }}>New games are in progress. Check the blog for updates.</p>
          </div>
        ) : (
          <div className="space-y-14">
            {games.map((game, idx) => (
              <div
                key={game.slug}
                className={`flex flex-col ${idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-10 lg:gap-16 items-center`}
                data-testid={`game-card-${game.slug}`}
              >
                {/* Image */}
                <div className="lg:w-1/2 relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  {game.logo_url ? (
                    <img
                      src={imgUrl(game.logo_url)}
                      alt={game.name}
                      className="w-full max-w-md mx-auto"
                      style={{ display: 'block' }}
                    />
                  ) : game.screenshots?.length > 0 ? (
                    <img
                      src={imgUrl(game.screenshots[0])}
                      alt={game.name}
                      className="w-full"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center" style={{ backgroundColor: '#1A1A1A' }}>
                      <span className="font-black uppercase text-white/20 text-2xl tracking-tight">
                        {game.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="lg:w-1/2 space-y-5">
                  <div className="flex items-center gap-4 flex-wrap">
                    <h2
                      className="font-black uppercase text-white"
                      style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)', letterSpacing: '-0.02em', lineHeight: 1 }}
                    >
                      {game.name}
                    </h2>
                    {game.status === 'coming_soon' && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1"
                        style={{ color: '#4ECDC4', border: '1px solid #4ECDC4' }}
                      >
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {game.description && (
                    <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}>
                      {game.description}
                    </p>
                  )}

                  {game.screenshots?.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {game.screenshots.slice(1, 4).map((s, i) => {
                        const full = imgUrl(s);
                        return (
                          <HoverPreview key={i} src={full} alt="" className="shrink-0" glass>
                            <img
                              src={full}
                              alt=""
                              className="h-16 sm:h-20 object-cover"
                              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                          </HoverPreview>
                        );
                      })}
                    </div>
                  )}

                  {game.platforms?.length > 0 && game.status !== 'coming_soon' && (
                    <div className="flex flex-wrap gap-2">
                      {game.platforms.map((p, i) => {
                        const pl = PLATFORM_ICONS[p.name];
                        return pl ? (
                          <a
                            key={i}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
                            style={{
                              color: 'rgba(255,255,255,0.5)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              fontSize: '0.8rem',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#4ECDC4'; e.currentTarget.style.borderColor = 'rgba(78,205,196,0.4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                            data-testid={`platform-${p.name}`}
                          >
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{pl.svg}</span>
                            {pl.label}
                            <ArrowSquareOut size={11} />
                          </a>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Buy button — only for published paid games */}
                  {game.price_cents > 0 && game.status === 'published' && (
                    <div>
                      {purchaseError.slug === game.slug && (
                        <p className="text-xs text-red-400 mb-2">{purchaseError.msg}</p>
                      )}
                      {ownedSlugs.has(game.slug) ? (
                        <span className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold" style={{ color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)' }}>
                          <CheckCircle size={14} />
                          Owned
                        </span>
                      ) : buyingSlug === game.slug ? (
                        <div className="p-4 space-y-3 max-w-xs" style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wide text-white">
                              Promo code <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                            </p>
                            <button onClick={() => setBuyingSlug(null)} style={{ color: 'rgba(255,255,255,0.3)' }} className="hover:text-white">
                              <X size={13} />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={couponCode}
                              onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null); }}
                              placeholder="VG-XXXXXXXX"
                              className="flex-1 text-xs px-2.5 py-2 focus:outline-none font-mono tracking-wide"
                              style={{ backgroundColor: '#0D0D0D', border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF' }}
                            />
                            <button
                              onClick={() => checkGameCoupon(game.slug)}
                              disabled={!couponCode.trim() || couponChecking}
                              className="text-xs font-bold uppercase tracking-wide px-3 py-2 transition-colors disabled:opacity-40"
                              style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}
                            >
                              {couponChecking ? '…' : 'Apply'}
                            </button>
                          </div>
                          {couponStatus?.valid && (
                            <p className="text-xs font-semibold flex items-center gap-1" style={{ color: '#4ECDC4' }}>
                              <Tag size={10} /> {couponStatus.discount_pct}% discount applied
                            </p>
                          )}
                          {couponStatus?.valid === false && (
                            <p className="text-xs text-red-400">{couponStatus.error}</p>
                          )}
                          <button
                            onClick={() => buyGame(game)}
                            disabled={purchasing === game.slug}
                            className="btn-kefir w-full text-[11px] py-2.5"
                          >
                            {purchasing === game.slug
                              ? <><CircleNotch size={14} className="animate-spin mr-1" /> Processing…</>
                              : <>
                                  <ShoppingCart size={14} className="mr-1" />
                                  {couponStatus?.valid
                                    ? `Buy — $${(Math.max(50, Math.round(game.price_cents * (1 - couponStatus.discount_pct / 100))) / 100).toFixed(2)}`
                                    : `Buy — $${(game.price_cents / 100).toFixed(2)}`
                                  }
                                </>
                            }
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => openBuy(game)} className="btn-kefir">
                          <ShoppingCart size={14} className="mr-2" />
                          {`Buy — $${(game.price_cents / 100).toFixed(2)}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
};

export default GamesPage;
