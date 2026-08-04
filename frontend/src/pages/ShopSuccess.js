import React from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowLeft } from '@phosphor-icons/react';
import { SiteFooter } from '../components/SiteFooter';
import { PublicButton } from '../ui/PublicButton';

const ShopSuccess = ({ legacy }) => {
  const [searchParams] = useSearchParams();
  const { gameSlug } = useParams();
  const type = searchParams.get('type');
  const isGame = type === 'game';

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="rounded-xl liquid-glass p-10 max-w-md w-full text-center">

        <div className="rounded-lg w-14 h-14 bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={28} className="text-[#4ECDC4]" />
        </div>

        <p className="text-[12px] font-mono text-[#4ECDC4] mb-2">// payment confirmed</p>
        <h1
          className="font-display text-3xl font-medium text-[#1D1D1F] mb-3"
        >
          {isGame ? 'Game unlocked' : 'Purchase complete'}
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
          <PublicButton as={Link} to={legacy && gameSlug ? `/shop/${gameSlug}` : '/shop'} icon={ShoppingBag} iconPosition="leading">
            Back to Shop
          </PublicButton>
          <PublicButton as={Link} to="/" variant="outline" icon={ArrowLeft} iconPosition="leading">
            Home
          </PublicButton>
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default ShopSuccess;
