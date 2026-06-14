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
    <div className="min-h-screen flex font-body" style={{ background: '#080808' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col"
        style={{ background: 'linear-gradient(160deg, #0d0d0d 0%, #080808 100%)' }}>
        {/* Dot grid */}
        <div className="dot-grid absolute inset-0 opacity-60 pointer-events-none" />
        {/* Radial glow */}
        <div style={{
          position:'absolute', inset:0,
          background:'radial-gradient(ellipse 80% 60% at 30% 40%, rgba(255,255,255,0.03) 0%, transparent 70%)',
        }} />
        {/* 3D sphere decoration */}
        <div style={{
          position:'absolute', top:'20%', right:'10%',
          width:220, height:220, borderRadius:'50%',
          background:'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.04) 30%, rgba(0,0,0,0.9) 100%)',
          boxShadow:'inset -20px -20px 40px rgba(0,0,0,0.8), inset 10px 10px 30px rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.9)',
          border:'1px solid rgba(255,255,255,0.08)',
          animation:'float 8s ease-in-out infinite',
        }} />
        <div style={{
          position:'absolute', bottom:'25%', left:'8%',
          width:80, height:80, borderRadius:'50%',
          background:'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.8) 100%)',
          border:'1px solid rgba(255,255,255,0.06)',
          animation:'float 6s ease-in-out infinite',
          animationDelay:'-3s',
        }} />

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8" style={{ perspective:'80px' }}>
              <div style={{ width:'100%',height:'100%',background:'linear-gradient(135deg,#FFFFFF 0%,#A0A0A8 100%)',borderRadius:'6px',transform:'rotateX(12deg) rotateY(-16deg)',boxShadow:'3px 5px 0px rgba(255,255,255,0.2)' }} />
            </div>
            <span className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</span>
          </div>

          <div className="mt-auto mb-auto flex flex-col">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-6 h-px bg-white/20" />
              <span className="text-xs text-[#6E6E73] tracking-widest uppercase">Admin Access</span>
            </div>
            <h2 className="font-display font-bold gradient-text-bright mb-4"
              style={{ fontSize:'3.5rem', letterSpacing:'-0.03em', lineHeight:0.92 }}>
              STUDIO<br />CONTROL
            </h2>
            <p className="text-[#6E6E73] text-base leading-relaxed max-w-xs" style={{ fontWeight:300 }}>
              Secure access to manage projects, users, games, blog content, and server settings.
            </p>

            {/* Features list */}
            <div className="mt-10 space-y-3">
              {[
                { icon: Shield, text: 'End-to-end encrypted session' },
                { icon: Lock, text: 'Role-based permissions' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 glass rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className="text-[#A1A1A6]" />
                  </div>
                  <span className="text-sm text-[#6E6E73]">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-[#3A3A3C]">&copy; {new Date().getFullYear()} Vakar Games</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="dot-grid absolute inset-0 opacity-30 pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-8 h-8" style={{ perspective:'80px' }}>
              <div style={{ width:'100%',height:'100%',background:'linear-gradient(135deg,#FFFFFF 0%,#A0A0A8 100%)',borderRadius:'6px',transform:'rotateX(12deg) rotateY(-16deg)' }} />
            </div>
            <span className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</span>
          </div>

          {firstLogin ? (
            /* First login — show new key */
            <div className="scale-in">
              <div className="w-12 h-12 glass glass-strong rounded-2xl flex items-center justify-center mb-6"
                style={{ boxShadow:'0 0 30px rgba(48,209,88,0.15)' }}>
                <Check size={22} className="text-[#30D158]" />
              </div>
              <h1 className="font-display font-bold text-2xl text-white mb-2" style={{ letterSpacing:'-0.02em' }}>
                Welcome aboard
              </h1>
              <p className="text-sm text-[#6E6E73] mb-8" style={{ fontWeight:300 }}>
                A new access key has been generated for you. Save it somewhere safe — it won't be shown again.
              </p>

              <div className="glass rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#6E6E73] uppercase tracking-widest">Your New Key</span>
                  <button onClick={copyKey} className="flex items-center gap-1.5 text-xs text-[#A1A1A6] hover:text-white transition-colors">
                    {copied ? <><Check size={12} className="text-[#30D158]" />Copied!</> : <><Copy size={12} />Copy</>}
                  </button>
                </div>
                <code className="text-sm text-white font-mono break-all block">
                  {showKey ? firstLogin.newKey : '•'.repeat(Math.min(firstLogin.newKey.length, 32))}
                </code>
                <button onClick={() => setShowKey(!showKey)} className="mt-2 text-xs text-[#6E6E73] hover:text-white transition-colors flex items-center gap-1">
                  {showKey ? <><EyeOff size={11} />Hide</> : <><Eye size={11} />Show key</>}
                </button>
              </div>

              <div className="flex items-start gap-3 glass rounded-xl p-4 mb-6" style={{ borderColor:'rgba(255,159,10,0.2)', borderWidth:'1px' }}>
                <AlertTriangle size={16} className="text-[#FF9F0A] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#A1A1A6] leading-relaxed" style={{ fontWeight:300 }}>
                  This key grants full access to your dashboard. Store it securely — treat it like a password.
                </p>
              </div>

              <button onClick={() => navigate('/dashboard')} className="btn-primary w-full justify-center">
                Continue to Dashboard
              </button>
            </div>
          ) : (
            /* Login form */
            <div className="fade-up">
              <h1 className="font-display font-bold text-2xl text-white mb-2" style={{ letterSpacing:'-0.02em' }}>
                Sign in
              </h1>
              <p className="text-sm text-[#6E6E73] mb-10" style={{ fontWeight:300 }}>
                Enter your access key to continue.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-[#6E6E73] uppercase tracking-widest mb-2 block">Access Key</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E73]" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={key}
                      onChange={e => setKey(e.target.value)}
                      placeholder="Enter your key..."
                      className="w-full pl-11 pr-11 py-3 glass rounded-xl text-sm text-white placeholder-[#3A3A3C] outline-none transition-all"
                      style={{ fontFamily:'JetBrains Mono, monospace', border:'1px solid rgba(255,255,255,0.08)' }}
                      onFocus={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'}
                      onBlur={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}
                      data-testid="api-key-input"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6E6E73] hover:text-white transition-colors">
                      {showKey ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-3 glass rounded-xl p-3" style={{ borderColor:'rgba(255,69,58,0.3)', borderWidth:'1px' }}>
                    <AlertTriangle size={15} className="text-[#FF453A] flex-shrink-0" />
                    <p className="text-xs text-[#FF453A]">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !key}
                  className="btn-primary w-full justify-center"
                  style={{ opacity: loading || !key ? 0.5 : 1 }}
                  data-testid="login-button"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Signing in...</>
                  ) : 'Sign in'}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-3 glass rounded-xl p-4">
                <Shield size={15} className="text-[#6E6E73] flex-shrink-0" />
                <p className="text-xs text-[#3A3A3C]">Access is restricted to authorized studio members only.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
