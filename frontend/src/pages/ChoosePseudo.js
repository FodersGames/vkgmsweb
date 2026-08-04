import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, ArrowRight, CircleNotch } from '@phosphor-icons/react';
import { PublicButton } from '../ui/PublicButton';
import seaStackDusk from '../assets/photos/sea-stack-dusk.jpg';

const PSEUDO_REGEX = /^[a-zA-Z0-9_]{5,14}$/;

export const ChoosePseudo = () => {
  const { user, loading: authLoading, setPseudo, logout } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Choose your pseudo — Vakar Games';
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
    // Already picked one — nothing to do here.
    if (!authLoading && user?.pseudo_set) navigate('/');
  }, [authLoading, user, navigate]);

  const validLength = value.length >= 5 && value.length <= 14;
  const validCharset = /^[a-zA-Z0-9_]*$/.test(value);
  const canSubmit = validLength && validCharset && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    const result = await setPseudo(value.trim());
    setSubmitting(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="relative min-h-screen overflow-hidden [contain:paint] flex items-center justify-center p-4 bg-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <img src={seaStackDusk} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#F5F5F7]/90" />
        <div className="absolute top-1/2 left-1/2 -translate-x-[70%] -translate-y-[60%] w-[520px] h-[520px] rounded-full bg-[#4ECDC4]/25 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 translate-x-[10%] -translate-y-[30%] w-[420px] h-[420px] rounded-full bg-[#6C5CE7]/15 blur-[110px]" />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display text-[18px] font-medium tracking-tight text-[#1D1D1F]">
            Welcome, {user.firstName || 'there'}.
          </p>
          <p className="mt-1.5 text-sm text-[#6E6E73] [text-shadow:0_1px_12px_rgba(245,245,247,0.9)]">
            One last step before you're in
          </p>
        </div>

        <div className="animate-appear rounded-2xl liquid-glass overflow-hidden">
          <div className="px-7 pt-7 pb-2">
            <h1 className="font-display text-xl font-medium text-[#1D1D1F] mb-1.5">Choose your pseudo</h1>
            <p className="text-sm text-[#6E6E73] leading-relaxed">
              This is how you'll be known across Vakar Games — in chat, in-game and on your profile.
              You can change it again after 7 days.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-7 pb-7 pt-5 space-y-4">
            <div>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={value}
                  onChange={e => { setValue(e.target.value.replace(/\s/g, '')); setError(''); }}
                  placeholder="your_pseudo"
                  maxLength={14}
                  className="rounded-lg w-full pl-9 pr-16 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A1A1A6]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-[#A1A1A6]">
                  {value.length}/14
                </span>
              </div>
              <p className={`mt-1.5 text-xs ${value && !validCharset ? 'text-red-500' : 'text-[#A1A1A6]'}`}>
                5-14 characters — letters, numbers and underscores only.
              </p>
            </div>

            {error && (
              <div className="rounded-lg p-3 bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            <PublicButton type="submit" disabled={!canSubmit} className="w-full">
              {submitting ? <CircleNotch size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {submitting ? 'Saving…' : 'Continue'}
            </PublicButton>
          </form>
        </div>

        <button
          onClick={logout}
          className="mt-5 block mx-auto text-xs text-[#6E6E73] hover:text-[#1D1D1F] [text-shadow:0_1px_12px_rgba(245,245,247,0.9)] transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default ChoosePseudo;
