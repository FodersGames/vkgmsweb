import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Shield, Copy, Check, AlertTriangle } from 'lucide-react';

export const Login = () => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [firstLogin, setFirstLogin] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Sign In — Vakar Games'; }, []);

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F9F7F4]">

      {/* First Login Modal */}
      {firstLogin && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="first-login-modal"
        >
          <div className="bg-white border border-[#E8E3DB] rounded-xl max-w-lg w-full p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 rounded-xl flex items-center justify-center mb-4">
                <Shield size={20} className="text-[#4ECDC4]" />
              </div>
              <h2
                className="text-2xl font-black text-[#1C1917] mb-2"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}
              >
                FIRST CONNECTION
              </h2>
              <p className="text-sm text-[#78716C]">
                A new secure access key has been generated for your account. Your initial setup key has been permanently invalidated.
              </p>
            </div>

            <div className="bg-[#F9F7F4] border border-[#E8E3DB] rounded-xl p-5 mb-5">
              <div className="text-xs font-bold text-[#78716C] uppercase tracking-wider mb-3">
                Your New Super Admin Key
              </div>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 p-3 bg-white border border-[#E8E3DB] text-[#1C1917] text-xs rounded-lg break-all select-all"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                  data-testid="new-key-display"
                >
                  {firstLogin.newKey}
                </code>
                <button
                  onClick={copyKey}
                  className={`p-3 rounded-lg border transition-all shrink-0 ${
                    copied
                      ? 'bg-[#4ECDC4] border-[#4ECDC4] text-white'
                      : 'border-[#E8E3DB] text-[#78716C] hover:border-[#4ECDC4] hover:text-[#4ECDC4]'
                  }`}
                  data-testid="copy-new-key"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-600 font-semibold mb-0.5">Save this key now</p>
                <p className="text-xs text-red-500/80 leading-relaxed">
                  This key will not be shown again. If lost, access to the Super Admin account cannot be recovered.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
              data-testid="continue-to-dashboard"
            >
              I've saved my key — Enter dashboard
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="text-xl font-black text-[#1C1917] tracking-[0.18em] hover:text-[#2D2926] transition-colors"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            VAKAR GAMES
          </Link>
          <p className="mt-1.5 text-sm text-[#78716C]">Studio dashboard</p>
        </div>

        <div className="bg-white border border-[#E8E3DB] rounded-xl shadow-sm">
          <div className="px-7 pt-7 pb-5">
            <h1 className="text-base font-bold text-[#1C1917] mb-1">Sign in</h1>
            <p className="text-sm text-[#78716C]">Enter your access key to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="px-7 pb-7" data-testid="login-form">
            <div className="mb-5">
              <label
                htmlFor="access-key"
                className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-2"
              >
                Access Key
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  id="access-key"
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]"
                  placeholder="Enter your access key"
                  required
                  data-testid="access-key-input"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                />
              </div>
            </div>

            {error && (
              <div
                className="mb-5 p-3 border border-red-200 bg-red-50 text-red-600 text-sm rounded-lg"
                data-testid="login-error"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-submit-button"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[#A8A29E]">
          Secured with JWT authentication
        </p>
      </div>
    </div>
  );
};
