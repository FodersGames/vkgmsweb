import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowLeft } from 'lucide-react';

const ShopSuccess = () => {
  const { gameSlug } = useParams();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0d0d14] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#151520] rounded-2xl border border-zinc-200 dark:border-[#2a2a3c] shadow-xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} className="text-[#4ECDC4]" />
        </div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-[#e4e4e7] mb-2">Payment confirmed!</h1>
        <p className="text-sm text-zinc-500 dark:text-[#71717a] mb-6">
          Your purchase was successful. Your items will be delivered in-game the next time you connect.<br />
          <span className="text-xs mt-1 block">If you don't receive them within a few minutes, please contact support.</span>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={`/shop/${gameSlug}`}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#6C5CE7] text-white rounded-xl text-sm font-semibold hover:bg-[#5b4dd6] transition-colors"
          >
            <ShoppingBag size={15} />Back to Shop
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-700 dark:text-[#e4e4e7] rounded-xl text-sm font-semibold hover:border-zinc-300 dark:hover:border-[#3a3a4c] transition-colors"
          >
            <ArrowLeft size={15} />Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ShopSuccess;
