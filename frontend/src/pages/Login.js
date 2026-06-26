import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

const InputField = ({ icon: Icon, type, placeholder, value, onChange, id, autoComplete }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="relative">
      <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] pointer-events-none" />
      <input
        id={id}
        type={isPassword && show ? 'text' : type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="w-full pl-9 pr-9 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]"
      />
      {isPassword && (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#78716C] transition-colors"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      )}
    </div>
  );
};

const ChangePasswordModal = ({ onSuccess }) => {
  const { changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    const result = await changePassword({ newPassword });
    setLoading(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E3DB] rounded-xl max-w-md w-full p-8 shadow-xl">
        <div className="mb-6">
          <div className="w-11 h-11 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-[#1C1917] mb-1">Change your password</h2>
          <p className="text-sm text-[#78716C]">
            You must set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
              New password
            </label>
            <InputField
              icon={Lock}
              type="password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
              Confirm new password
            </label>
            <InputField
              icon={Lock}
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const Login = () => {
  const [tab, setTab] = useState('login');
  const [mustChange, setMustChange] = useState(false);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [reg, setReg] = useState({ email: '', password: '', firstName: '', lastName: '', username: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Sign In — Vakar Games'; }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const result = await login(email, password);
    setLoginLoading(false);
    if (result.success) {
      if (result.first_login) {
        setMustChange(true);
      } else {
        navigate('/dashboard');
      }
    } else {
      setLoginError(result.error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);
    const result = await register(reg);
    setRegLoading(false);
    if (result.success) {
      setRegSuccess(true);
    } else {
      setRegError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F9F7F4]">

      {mustChange && (
        <ChangePasswordModal onSuccess={() => navigate('/dashboard')} />
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
          <p className="mt-1.5 text-sm text-[#78716C]">
            {tab === 'login' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        <div className="bg-white border border-[#E8E3DB] rounded-xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#E8E3DB]">
            {[{ id: 'login', label: 'Sign In' }, { id: 'register', label: 'Create Account' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === id
                    ? 'text-[#1C1917] border-b-2 border-[#1C1917] -mb-px'
                    : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="px-7 py-7 space-y-4" data-testid="login-form">
              <div>
                <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <InputField
                  icon={Mail}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  id="email"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <InputField
                  icon={Lock}
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  id="password"
                  autoComplete="current-password"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg" data-testid="login-error">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="login-submit-button"
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="px-7 py-7">
              {regSuccess ? (
                <div className="text-center py-4">
                  <div className="w-11 h-11 bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={18} className="text-[#4ECDC4]" />
                  </div>
                  <h3 className="text-base font-bold text-[#1C1917] mb-1">Account created</h3>
                  <p className="text-sm text-[#78716C] mb-5">
                    You can now sign in with your email and password.
                  </p>
                  <button
                    onClick={() => { setTab('login'); setEmail(reg.email); setRegSuccess(false); }}
                    className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
                  >
                    Go to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
                        First name <span className="text-[#C9C3BB] normal-case font-normal">(optional)</span>
                      </label>
                      <InputField
                        icon={User}
                        type="text"
                        placeholder="Jane"
                        value={reg.firstName}
                        onChange={e => setReg(r => ({ ...r, firstName: e.target.value }))}
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
                        Last name <span className="text-[#C9C3BB] normal-case font-normal">(optional)</span>
                      </label>
                      <InputField
                        icon={User}
                        type="text"
                        placeholder="Doe"
                        value={reg.lastName}
                        onChange={e => setReg(r => ({ ...r, lastName: e.target.value }))}
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
                      Username <span className="text-[#C9C3BB] normal-case font-normal">(optional — auto-generated from email)</span>
                    </label>
                    <InputField
                      icon={User}
                      type="text"
                      placeholder="jane_doe"
                      value={reg.username}
                      onChange={e => setReg(r => ({ ...r, username: e.target.value }))}
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
                      Email
                    </label>
                    <InputField
                      icon={Mail}
                      type="email"
                      placeholder="your@email.com"
                      value={reg.email}
                      onChange={e => setReg(r => ({ ...r, email: e.target.value }))}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <InputField
                      icon={Lock}
                      type="password"
                      placeholder="Min. 8 characters, 1 letter, 1 number"
                      value={reg.password}
                      onChange={e => setReg(r => ({ ...r, password: e.target.value }))}
                      autoComplete="new-password"
                    />
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg" data-testid="register-error">
                      {regError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="register-submit-button"
                  >
                    {regLoading ? 'Creating account…' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[#A8A29E]">
          Protected with JWT authentication
        </p>
      </div>
    </div>
  );
};
