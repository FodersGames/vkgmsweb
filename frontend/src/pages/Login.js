import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { EnvelopeSimple, Lock, User, Eye, EyeSlash, Warning, CheckCircle } from '@phosphor-icons/react';
import { PublicButton } from '../ui/PublicButton';
import heroCoastSunset from '../assets/photos/hero-coast-sunset.jpg';

import { API_URL } from '../utils/api';

const hasDashboardAccess = (u) =>
  !!u && (
    u.is_super_admin ||
    u.role === 'admin' ||
    u.role === 'super_admin' ||
    (Array.isArray(u.permissions) && u.permissions.length > 0) ||
    (Array.isArray(u.custom_roles) && u.custom_roles.length > 0) ||
    (Array.isArray(u.roles) && u.roles.length > 0)
  );

const InputField = ({ icon: Icon, type, placeholder, value, onChange, id, autoComplete, required = true }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="relative">
      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] pointer-events-none" />
      <input
        id={id}
        type={isPassword && show ? 'text' : type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="w-full pl-9 pr-9 py-2.5 bg-[#F8F9FA] border border-[#D4D4D8] text-[#0A0A0A] text-sm focus:outline-none focus:border-[#FF6600] transition-all placeholder:text-[#A1A1AA]"
      />
      {isPassword && (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#0A0A0A] transition-colors"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
        >
          {show ? <EyeSlash size={14} /> : <Eye size={14} />}
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="animate-appear bg-white border border-[#E5E7EB] shadow-2xl max-w-md w-full p-8">
        <div className="mb-6">
          <div className="w-11 h-11 bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
            <Warning size={18} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-[#0A0A0A] mb-1">Change your password</h2>
          <p className="text-sm text-[#52525B]">
            You must set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1.5">
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
            <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1.5">
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
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-kefir w-full">
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
  const [maintenance, setMaintenance] = useState(false);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [reg, setReg] = useState({ email: '', password: '', name: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const { login, register, logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Sign In — Vakar Games';
    axios.get(`${API_URL}/api/website/settings`)
      .then(r => setMaintenance(!!r.data.maintenance_mode))
      .catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setLoginError('Email is required');
      return;
    }
    if (!password) {
      setLoginError('Password is required');
      return;
    }
    setLoginLoading(true);
    const result = await login(cleanEmail, password);
    setLoginLoading(false);
    if (result.success) {
      // During maintenance, only accounts with dashboard access may sign in
      if (maintenance && !hasDashboardAccess(result.user)) {
        logout();
        setLoginError('The site is under maintenance. Only staff accounts can sign in right now.');
        return;
      }
      if (result.first_login) {
        setMustChange(true);
      } else if (hasDashboardAccess(result.user)) {
        navigate('/dashboard');
      } else {
        navigate('/profile');
      }
    } else {
      setLoginError(result.error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    const cleanEmail = reg.email.trim().toLowerCase();
    const cleanName = (reg.name || reg.firstName || '').trim();

    if (!cleanName) {
      setRegError('Name is required');
      return;
    }
    if (!cleanEmail) {
      setRegError('Email is required');
      return;
    }
    if (!reg.password || reg.password.length < 8) {
      setRegError('Password must be at least 8 characters');
      return;
    }

    setRegLoading(true);
    const result = await register({
      email: cleanEmail,
      password: reg.password,
      name: cleanName,
    });
    if (!result.success) {
      setRegLoading(false);
      setRegError(result.error);
      return;
    }
    // Log the new account straight in — registration alone used to leave the
    // user logged out on a "go sign in" panel, which is now only a fallback
    // if this auto-login step itself fails.
    const loginResult = await login(cleanEmail, reg.password);
    setRegLoading(false);
    if (loginResult.success) {
      if (hasDashboardAccess(loginResult.user)) {
        navigate('/dashboard');
      } else {
        navigate('/profile');
      }
    } else {
      setTab('login');
      setEmail(cleanEmail);
      setRegSuccess(true);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden [contain:paint] flex items-center justify-center p-4 bg-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <img src={heroCoastSunset} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-white/70" />
        <div className="absolute top-1/2 left-1/2 -translate-x-[70%] -translate-y-[60%] w-[520px] h-[520px] rounded-full bg-[#FF6600]/10 blur-[110px]" />
      </div>

      {mustChange && (
        <ChangePasswordModal onSuccess={() => {
          if (hasDashboardAccess(user)) {
            navigate('/dashboard');
          } else {
            navigate('/profile');
          }
        }} />
      )}

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex flex-col items-center gap-2 group transition-colors"
          >
            <img src="/logo.png" alt="Vakar Games" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" />
            <span className="font-black text-[20px] tracking-tight uppercase text-[#0A0A0A] group-hover:text-[#FF6600] transition-colors">
              Vakar Games
            </span>
          </Link>
          <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-[#52525B]">
            {tab === 'login' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        <div className="animate-appear bg-white border border-[#E5E7EB] shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#E5E7EB]">
            {[{ id: 'login', label: 'Sign In' }, { id: 'register', label: 'Create Account' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  tab === id
                    ? 'text-[#0A0A0A] border-b-2 border-[#FF6600] -mb-px bg-white'
                    : 'text-[#71717A] hover:text-[#0A0A0A] bg-[#F8F9FA]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="px-7 py-7 space-y-4" data-testid="login-form">
              <div>
                <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <InputField
                  icon={EnvelopeSimple}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  id="email"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1.5">
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
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-medium" data-testid="login-error">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="btn-kefir w-full text-center"
                data-testid="login-submit-button"
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="px-7 py-7">
              {regSuccess ? (
                <div className="text-center py-4">
                  <div className="w-11 h-11 bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={18} className="text-[#FF6600]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0A0A0A] mb-1">Account created</h3>
                  <p className="text-xs text-[#52525B] mb-5">
                    You can now sign in with your email and password.
                  </p>
                  <button
                    onClick={() => { setTab('login'); setEmail(reg.email); setRegSuccess(false); }}
                    className="btn-kefir w-full"
                  >
                    Go to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                  <div>
                    <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1.5">
                      Name
                    </label>
                    <InputField
                      icon={User}
                      type="text"
                      placeholder="Jane Doe"
                      value={reg.name}
                      onChange={e => setReg(r => ({ ...r, name: e.target.value }))}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1.5">
                      Email
                    </label>
                    <InputField
                      icon={EnvelopeSimple}
                      type="email"
                      placeholder="your@email.com"
                      value={reg.email}
                      onChange={e => setReg(r => ({ ...r, email: e.target.value }))}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1.5">
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
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-medium" data-testid="register-error">
                      {regError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="btn-kefir w-full text-center"
                    data-testid="register-submit-button"
                  >
                    {regLoading ? 'Creating account…' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs font-medium text-[#52525B]">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="underline text-[#0A0A0A] hover:text-[#FF6600] transition-colors">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
};
