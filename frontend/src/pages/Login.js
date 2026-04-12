import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Shield } from 'lucide-react';

export const Login = () => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(key);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FBF9F7]">
      {/* Subtle warm gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#F2994A] opacity-[0.06] rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#EB5757] opacity-[0.04] rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-xl border border-[#EDE5DB] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          {/* Header with warm gradient */}
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-xl bg-gradient-to-br from-[#F2994A] to-[#EB5757] flex items-center justify-center mb-5 shadow-lg shadow-[#F2994A]/20">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Admin Dashboard
            </h1>
            <p className="text-sm text-[#8A8A9A] mt-2">
              Enter your access key to sign in
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8" data-testid="login-form">
            <div className="mb-5">
              <label htmlFor="access-key" className="block text-xs font-semibold text-[#8A8A9A] mb-2 uppercase tracking-wider">
                Access Key
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B5A5]" />
                <input
                  id="access-key"
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-[#EDE5DB] bg-[#FBF9F7] text-[#1A1A2E] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F2994A]/30 focus:border-[#F2994A] transition-all"
                  placeholder="Enter your access key"
                  required
                  data-testid="access-key-input"
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                />
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3 border border-[#EB5757]/20 bg-[#EB5757]/5 text-[#EB5757] text-sm rounded-lg" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#F2994A] to-[#EB5757] text-white hover:from-[#E88A3A] hover:to-[#D84848] rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#F2994A]/20"
              data-testid="login-submit-button"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center text-xs text-[#C4B5A5]">
          Secured with JWT authentication & encrypted keys
        </div>
      </div>
    </div>
  );
};
