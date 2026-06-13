import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Shield, Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export const Login = () => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [firstLogin, setFirstLogin] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
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
      if (result.first_login && result.new_key) setFirstLogin({ newKey: result.new_key });
      else navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(firstLogin.newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen flex font-body" style={{ background: 'linear-gradient(160deg, #F8F8F8 0%, #EFF6FC 60%, #F3F2F1 100%)' }}>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-[#1E1E1E] flex-col">
        {/* Grid wires */}
        <div className="absolute inset-0">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="lp-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,120,212,0.12)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lp-grid)"/>
          </svg>
        </div>
        {/* Blue left border */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0078D4] via-[#40A9FF] to-transparent" />

        {/* 3D floating cubes */}
        <div className="absolute top-[20%] right-[15%] iso-cube opacity-50">
          <svg width="120" height="108" viewBox="0 0 120 108" style={{filter:'drop-shadow(0 12px 32px rgba(0,120,212,0.3))'}}>
            <polygon points="60,0 120,30 60,60 0,30" fill="#0078D4" opacity="0.9"/>
            <polygon points="0,30 60,60 60,104 0,74" fill="#0078D4" opacity="0.5"/>
            <polygon points="60,60 120,30 120,74 60,104" fill="#0078D4" opacity="0.3"/>
          </svg>
        </div>
        <div className="absolute bottom-[30%] left-[10%] opacity-30" style={{ animation: 'iso-float 9s ease-in-out infinite', animationDelay: '-4s' }}>
          <svg width="60" height="54" viewBox="0 0 120 108">
            <polygon points="60,0 120,30 60,60 0,30" fill="#40A9FF" opacity="0.9"/>
            <polygon points="0,30 60,60 60,104 0,74" fill="#40A9FF" opacity="0.5"/>
            <polygon points="60,60 120,30 120,74 60,104" fill="#40A9FF" opacity="0.3"/>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8" style={{perspective:'80px'}}>
              <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#0078D4 0%,#40A9FF 100%)',borderRadius:'3px',transform:'rotateX(10deg) rotateY(-12deg)',boxShadow:'3px 4px 0px #005A9E'}}/>
            </div>
            <span className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <span className="text-xs font-semibold tracking-widest uppercase text-[#40A9FF] mb-4">Admin Portal</span>
            <h1 className="font-display font-black text-5xl leading-none tracking-tight text-white mb-6">
              STUDIO<br />DASHBOARD
            </h1>
            <p className="text-[#6E6E6E] text-base leading-relaxed max-w-sm">
              Manage your games, blog, users, and website settings from a single control panel.
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-3">
              {[
                'Game & blog content management',
                'User & permission system',
                'Server status monitoring',
                'Variable & log management',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0078D4] flex-shrink-0" />
                  <span className="text-sm text-[#8A8A8A]">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-[#3C3C3C]">Secured with JWT authentication & AES key encryption</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-7 h-7" style={{perspective:'60px'}}>
              <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#0078D4 0%,#40A9FF 100%)',borderRadius:'2px',transform:'rotateX(10deg) rotateY(-12deg)',boxShadow:'2px 3px 0px #005A9E'}}/>
            </div>
            <span className="text-sm font-bold tracking-tight text-[#201F1E] font-display">VAKAR GAMES</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display font-black text-3xl text-[#201F1E] mb-2">Sign in</h2>
            <p className="text-sm text-[#605E5C]">Enter your access key to continue</p>
          </div>

          {/* First login modal */}
          {firstLogin && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" data-testid="first-login-modal">
              <div className="bg-white border border-[#E1DFDD] rounded-sm max-w-lg w-full shadow-2xl">
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#E1DFDD] flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#EFF6FC] border border-[#C7E0F4] rounded-sm flex items-center justify-center">
                    <Shield size={18} className="text-[#0078D4]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#201F1E] font-display">First Connection</h3>
                    <p className="text-xs text-[#605E5C]">Your access key has been rotated</p>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-[#605E5C] mb-5">
                    A new secure access key has been generated for your Super Admin account. The initial setup key has been permanently invalidated.
                  </p>

                  <div className="mb-5">
                    <p className="text-xs font-semibold text-[#0078D4] uppercase tracking-wider mb-2">Your New Super Admin Key</p>
                    <div className="flex gap-2">
                      <code className="flex-1 p-3 bg-[#F8F8F8] border border-[#E1DFDD] text-[#201F1E] text-xs rounded-sm break-all font-mono select-all" data-testid="new-key-display">
                        {firstLogin.newKey}
                      </code>
                      <button
                        onClick={copyKey}
                        className={`px-3 rounded-sm border transition-all text-sm ${copied ? 'bg-[#DFF6DD] border-[#107C10] text-[#107C10]' : 'bg-white border-[#E1DFDD] text-[#605E5C] hover:border-[#0078D4] hover:text-[#0078D4]'}`}
                        data-testid="copy-new-key"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-[#FDE7E9] border border-[#A4262C]/20 rounded-sm mb-5">
                    <AlertTriangle size={16} className="text-[#A4262C] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#A4262C] mb-0.5">Save this key now</p>
                      <p className="text-xs text-[#A4262C]/80">This key will never be shown again. If you lose it, you will not be able to access the Super Admin account.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/dashboard')}
                    className="az-btn-primary w-full"
                    data-testid="continue-to-dashboard"
                  >
                    I've saved my key — Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} data-testid="login-form" className="space-y-5">
            <div>
              <label htmlFor="access-key" className="block text-xs font-semibold text-[#605E5C] mb-1.5 uppercase tracking-wider">
                Access Key
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A19F9D]" />
                <input
                  id="access-key"
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 border border-[#E1DFDD] bg-white text-[#201F1E] text-sm rounded-sm
                    focus:outline-none focus:ring-2 focus:ring-[#0078D4]/30 focus:border-[#0078D4] transition-all font-mono"
                  placeholder="Enter your access key"
                  required
                  data-testid="access-key-input"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A19F9D] hover:text-[#605E5C] transition-colors"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-[#FDE7E9] border border-[#A4262C]/20 rounded-sm" data-testid="login-error">
                <AlertTriangle size={14} className="text-[#A4262C] shrink-0" />
                <span className="text-xs text-[#A4262C]">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="az-btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-submit-button"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-[#A19F9D]">
            Vakar Games Admin Portal — v1.3.0
          </p>
        </div>
      </div>
    </div>
  );
};
