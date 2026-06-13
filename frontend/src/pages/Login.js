import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Shield, Copy, Check, AlertTriangle } from 'lucide-react';

export const Login = () => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [firstLogin, setFirstLogin] = useState(null); // { newKey }
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Login — Vakar Games'; }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(key);
    setLoading(false);

    if (result.success) {
      if (result.first_login && result.new_key) {
        setFirstLogin({ newKey: result.new_key });
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
  };

  const [copied, setCopied] = useState(false);
  const copyKey = () => {
    navigator.clipboard.writeText(firstLogin.newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0f]">
      {/* First Login Modal */}
      {firstLogin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="first-login-modal">
          <div className="bg-[#151520] border border-[#2a2a3c] rounded-2xl max-w-lg w-full p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 rounded-xl bg-[#4ECDC4]/10 flex items-center justify-center mb-4">
                <Shield size={32} className="text-[#4ECDC4]" />
              </div>
              <h2 className="text-2xl font-bold text-[#e4e4e7] mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
                FIRST CONNECTION
              </h2>
              <p className="text-sm text-[#71717a]">
                Welcome! A new secure access key has been generated for your Super Admin account. The initial setup key has been permanently invalidated.
              </p>
            </div>

            <div className="bg-[#0d0d14] border border-[#4ECDC4]/30 rounded-xl p-5 mb-6">
              <div className="text-xs font-bold text-[#4ECDC4] uppercase tracking-wider mb-3">Your New Super Admin Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-[#111118] border border-[#2a2a3c] text-[#e4e4e7] text-xs rounded-lg break-all font-mono select-all" data-testid="new-key-display">
                  {firstLogin.newKey}
                </code>
                <button onClick={copyKey}
                  className={`p-3 rounded-lg transition-all ${copied ? 'bg-[#4ECDC4] text-[#0a0a0f]' : 'bg-[#1c1c2e] border border-[#2a2a3c] text-[#71717a] hover:text-[#4ECDC4] hover:border-[#4ECDC4]/30'}`}
                  data-testid="copy-new-key">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-400 font-semibold mb-1">Save this key now!</p>
                <p className="text-xs text-red-400/70">This key will never be shown again. If you lose it, you will not be able to access the Super Admin account.</p>
              </div>
            </div>

            <button onClick={() => navigate('/dashboard')}
              className="w-full bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-3 text-sm font-bold transition-all"
              data-testid="continue-to-dashboard">
              I've saved my key — Continue to Dashboard
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-md">
        <div className="bg-[#151520] rounded-xl border border-[#2a2a3c] shadow-2xl">
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-xl bg-gradient-to-br from-[#4ECDC4] to-[#2CB5AC] flex items-center justify-center mb-5 shadow-lg shadow-[#4ECDC4]/20">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#e4e4e7]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
              VAKAR GAMES
            </h1>
            <p className="text-sm text-[#71717a] mt-2">
              Enter your access key to sign in
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8" data-testid="login-form">
            <div className="mb-5">
              <label htmlFor="access-key" className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">
                Access Key
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
                <input
                  id="access-key"
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0d0d14] border border-[#2a2a3c] text-[#e4e4e7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] transition-all"
                  placeholder="Enter your access key"
                  required
                  data-testid="access-key-input"
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                />
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3 border border-red-500/20 bg-red-500/5 text-red-400 text-sm rounded-lg" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-3 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-submit-button"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center text-xs text-[#52525b]">
          Secured with JWT authentication & encrypted keys
        </div>
      </div>
    </div>
  );
};
