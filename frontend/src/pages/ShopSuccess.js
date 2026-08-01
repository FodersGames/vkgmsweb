import React from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowLeft } from 'lucide-react';
import { SiteFooter } from '../components/SiteFooter';

const ShopSuccess = ({ legacy }) => {
  const [searchParams] = useSearchParams();
  const { gameSlug } = useParams();
  const type = searchParams.get('type');
  const isGame = type === 'game';

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="rounded-xl bg-white border border-[#D2D2D7] p-10 max-w-md w-full text-center">

        <div className="rounded-lg w-14 h-14 bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={28} className="text-[#4ECDC4]" />
        </div>

        <p className="text-xs font-semibold text-[#4ECDC4] tracking-[0.16em] uppercase mb-2">
          Payment confirmed
        </p>
        <h1
          className="text-3xl font-black text-[#1D1D1F] mb-3"
        >
          {isGame ? 'GAME UNLOCKED' : 'PURCHASE COMPLETE'}
        </h1>

        <p className="text-sm text-[#6E6E73] mb-2 leading-relaxed">
          {isGame
            ? 'Your game purchase was successful. You can now sign in to play using your Vakar Games account.'
            : 'Your purchase was successful. Your items will be delivered in-game the next time you connect.'
          }
        </p>
        {!isGame && (
          <p className="text-xs text-[#A1A1A6] mb-8">
            Items not received within a few minutes? Contact support.
          </p>
        )}
        {isGame && <div className="mb-8" />}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={legacy && gameSlug ? `/shop/${gameSlug}` : '/shop'}
            className="rounded-full inline-flex items-center justify-center gap-2 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            <ShoppingBag size={14} />Back to Shop
          </Link>
          <Link
            to="/"
            className="rounded-full inline-flex items-center justify-center gap-2 border border-[#D2D2D7] hover:border-[#BFBFC4] text-[#6E6E73] hover:text-[#1D1D1F] px-5 py-2.5 text-sm font-semibold transition-all"
          >
            <ArrowLeft size={14} />Home
          </Link>
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default ShopSuccess;
