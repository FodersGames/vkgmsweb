import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ShoppingCart, X, Loader2, ArrowLeft } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BADGE_COLORS = {
  NEW:     { bg: '#4ECDC4', text: '#fff' },
  SALE:    { bg: '#EB5757', text: '#fff' },
  LIMITED: { bg: '#F2994A', text: '#fff' },
  HOT:     { bg: '#FF6B6B', text: '#fff' },
  POPULAR: { bg: '#A29BFE', text: '#fff' },
};

const Shop = () => {
  const { gameSlug } = useParams();
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyingProduct, setBuyingProduct] = useState(null);
  const [uid, setUid] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  const primary = settings?.primary_color || '#6C5CE7';
  const accent = settings?.accent_color || '#A29BFE';
  const isRounded = (settings?.card_style || 'rounded') === 'rounded';
  const cardRadius = isRounded ? '1rem' : '0.25rem';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prodRes, settRes] = await Promise.all([
          axios.get(`${API_URL}/api/shop/${gameSlug}/products`),
          axios.get(`${API_URL}/api/shop/${gameSlug}/settings`),
        ]);
        setProducts(prodRes.data.products || []);
        setSettings(settRes.data);
      } catch (e) {}
      finally { setLoading(false); }
    };
    load();
  }, [gameSlug]);

  const handleBuy = async () => {
    if (!uid.trim()) { setError('Please enter your in-game Player ID.'); return; }
    setError('');
    setCheckoutLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/shop/${gameSlug}/checkout`, {
        product_id: buyingProduct.id,
        player_uid: uid.trim(),
      });
      window.location.href = r.data.checkout_url;
    } catch (e) {
      setError(e.response?.data?.detail || 'Payment service unavailable. Please try again.');
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0d0d14]">
        <Loader2 size={32} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  const title = settings?.shop_title || 'Shop';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0d0d14]">
      {/* Banner */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          background: settings?.banner_url
            ? `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${settings.banner_url.startsWith('/') ? API_URL + settings.banner_url : settings.banner_url}) center/cover`
            : `linear-gradient(135deg, ${primary}, ${accent})`,
          minHeight: 220,
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-14 flex flex-col items-center text-center">
          <Link to="/" className="absolute top-5 left-6 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} />Back
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}>
            {title}
          </h1>
          {settings?.banner_subtitle && (
            <p className="text-white/80 text-sm max-w-md">{settings.banner_subtitle}</p>
          )}
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {products.length === 0 ? (
          <div className="text-center py-20 text-zinc-400 dark:text-[#71717a]">
            <ShoppingCart size={40} className="mx-auto mb-4 opacity-30" />
            <p>No products available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map(p => {
              const badge = BADGE_COLORS[p.badge];
              const imgSrc = p.image_url?.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url;
              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  style={{ borderRadius: cardRadius }}
                >
                  {/* Image */}
                  <div className="relative w-full h-44 bg-zinc-100 dark:bg-[#1c1c2e] overflow-hidden">
                    {imgSrc
                      ? <img src={imgSrc} alt={p.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-[#2a2a3c]"><ShoppingCart size={36} /></div>
                    }
                    {badge && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold rounded-full uppercase" style={{ backgroundColor: badge.bg, color: badge.text }}>
                        {p.badge}{p.badge === 'SALE' && p.discount_pct ? ` -${p.discount_pct}%` : ''}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-zinc-900 dark:text-[#e4e4e7] text-base mb-1">{p.name}</h3>
                    {p.description && <p className="text-sm text-zinc-500 dark:text-[#71717a] mb-3 flex-1">{p.description}</p>}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-100 dark:border-[#2a2a3c]">
                      <span className="text-xl font-black" style={{ color: primary }}>
                        €{(p.price / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => { setBuyingProduct(p); setUid(''); setError(''); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                        style={{ backgroundColor: primary, borderRadius: isRounded ? '0.5rem' : '0.2rem' }}
                      >
                        <ShoppingCart size={14} />Buy
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Buy modal */}
      {buyingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#151520] rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
            {/* Modal header */}
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
                  <img src={buyingProduct.image_url.startsWith('/') ? `${API_URL}${buyingProduct.image_url}` : buyingProduct.image_url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-zinc-900 dark:text-[#e4e4e7] truncate">{buyingProduct.name}</p>
                  {buyingProduct.description && <p className="text-xs text-zinc-500 dark:text-[#71717a] truncate">{buyingProduct.description}</p>}
                </div>
                <span className="font-black text-lg shrink-0" style={{ color: primary }}>
                  €{(buyingProduct.price / 100).toFixed(2)}
                </span>
              </div>

              {/* UID input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-[#71717a] mb-2 uppercase tracking-wider">Your in-game Player ID</label>
                <input
                  type="text"
                  value={uid}
                  onChange={e => { setUid(e.target.value); setError(''); }}
                  placeholder="player_12345"
                  className="w-full bg-zinc-50 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-xl text-sm px-4 py-3 focus:outline-none transition-all"
                  style={{ borderColor: uid ? primary : undefined }}
                  onKeyDown={e => e.key === 'Enter' && handleBuy()}
                  autoFocus
                />
                <p className="text-xs text-zinc-400 dark:text-[#71717a] mt-1.5">The item will be delivered to this account once payment is confirmed.</p>
                {error && <p className="text-xs text-red-500 mt-1.5 font-medium">{error}</p>}
              </div>

              {/* CTA */}
              <button
                onClick={handleBuy}
                disabled={checkoutLoading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: primary }}
              >
                {checkoutLoading ? <><Loader2 size={16} className="animate-spin" />Redirecting to payment...</> : `Pay €${(buyingProduct.price / 100).toFixed(2)} with Stripe`}
              </button>
              <p className="text-center text-xs text-zinc-400 dark:text-[#71717a]">Secure payment powered by Stripe. Your card info is never stored.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
