import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { EnvelopeSimple, Lock, User, Eye, EyeSlash, Warning, CheckCircle } from '@phosphor-icons/react';
import { PublicButton } from '../ui/PublicButton';
import seaStackDusk from '../assets/photos/sea-stack-dusk.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const hasDashboardAccess = (u) =>
  !!u && (u.is_super_admin || u.role === 'admin' || (u.permissions?.length > 0));

const InputField = ({ icon: Icon, type, placeholder, value, onChange, id, autoComplete, required = true }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="relative">
      <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] pointer-events-none" />
      <input
        id={id}
        type={isPassword && show ? 'text' : type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="rounded-lg w-full pl-9 pr-9 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A1A1A6]"
      />
      {isPassword && (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#6E6E73] transition-colors"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
        >
          {show ? <EyeSlash size={13} /> : <Eye size={13} />}
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
      <div className="animate-appear rounded-2xl liquid-glass max-w-md w-full p-8">
        <div className="mb-6">
          <div className="rounded-lg w-11 h-11 bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
            <Warning size={18} className="text-amber-600" />
          </div>
          <h2 className="font-display text-xl font-medium text-[#1D1D1F] mb-1">Change your password</h2>
          <p className="text-sm text-[#6E6E73]">
            You must set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
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
            <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
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
            <div className="rounded-lg p-3 bg-red-50 border border-red-100 text-red-600 text-sm">
              {error}
            </div>
          )}

          <PublicButton type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving…' : 'Set new password'}
          </PublicButton>
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
  const [reg, setReg] = useState({ email: '', password: '', firstName: '', lastName: '', username: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const { login, register, logout } = useAuth();
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
    setLoginLoading(true);
    const result = await login(email, password);
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
    <div className="relative min-h-screen overflow-hidden [contain:paint] flex items-center justify-center p-4 bg-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <img src={seaStackDusk} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#F5F5F7]/72" />
        <div className="absolute top-1/2 left-1/2 -translate-x-[70%] -translate-y-[60%] w-[520px] h-[520px] rounded-full bg-[#4ECDC4]/25 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 translate-x-[10%] -translate-y-[30%] w-[420px] h-[420px] rounded-full bg-[#6C5CE7]/15 blur-[110px]" />
      </div>

      {mustChange && (
        <ChangePasswordModal onSuccess={() => navigate('/dashboard')} />
      )}

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="font-display text-[18px] font-medium tracking-tight text-[#1D1D1F] hover:text-[#3A3A3C] transition-colors"
          >
            Vakar Games
          </Link>
          <p className="mt-1.5 text-sm text-[#6E6E73]">
            {tab === 'login' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        <div className="animate-appear rounded-2xl liquid-glass overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#D2D2D7]/60">
            {[{ id: 'login', label: 'Sign In' }, { id: 'register', label: 'Create Account' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === id
                    ? 'text-[#1D1D1F] border-b-2 border-[#1D1D1F] -mb-px'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="px-7 py-7 space-y-4" data-testid="login-form">
              <div>
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
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
                <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
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
                <div className="rounded-lg p-3 bg-red-50 border border-red-100 text-red-600 text-sm" data-testid="login-error">
                  {loginError}
                </div>
              )}

              <PublicButton
                type="submit"
                disabled={loginLoading}
                className="w-full"
                data-testid="login-submit-button"
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </PublicButton>
            </form>
          ) : (
            <div className="px-7 py-7">
              {regSuccess ? (
                <div className="text-center py-4">
                  <div className="rounded-lg w-11 h-11 bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={18} className="text-[#4ECDC4]" />
                  </div>
                  <h3 className="font-display text-lg font-medium text-[#1D1D1F] mb-1">Account created</h3>
                  <p className="text-sm text-[#6E6E73] mb-5">
                    You can now sign in with your email and password.
                  </p>
                  <PublicButton
                    onClick={() => { setTab('login'); setEmail(reg.email); setRegSuccess(false); }}
                    className="w-full"
                  >
                    Go to Sign In
                  </PublicButton>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                        First name <span className="text-[#BFBFC4] normal-case font-normal">(optional)</span>
                      </label>
                      <InputField
                        icon={User}
                        type="text"
                        placeholder="Jane"
                        value={reg.firstName}
                        onChange={e => setReg(r => ({ ...r, firstName: e.target.value }))}
                        autoComplete="given-name"
                        required={false}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                        Last name <span className="text-[#BFBFC4] normal-case font-normal">(optional)</span>
                      </label>
                      <InputField
                        icon={User}
                        type="text"
                        placeholder="Doe"
                        value={reg.lastName}
                        onChange={e => setReg(r => ({ ...r, lastName: e.target.value }))}
                        autoComplete="family-name"
                        required={false}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                      Username <span className="text-[#BFBFC4] normal-case font-normal">(optional — auto-generated from email)</span>
                    </label>
                    <InputField
                      icon={User}
                      type="text"
                      placeholder="jane_doe"
                      value={reg.username}
                      onChange={e => setReg(r => ({ ...r, username: e.target.value }))}
                      autoComplete="username"
                      required={false}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
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
                    <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
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
                    <div className="rounded-lg p-3 bg-red-50 border border-red-100 text-red-600 text-sm" data-testid="register-error">
                      {regError}
                    </div>
                  )}

                  <PublicButton
                    type="submit"
                    disabled={regLoading}
                    className="w-full"
                    data-testid="register-submit-button"
                  >
                    {regLoading ? 'Creating account…' : 'Create Account'}
                  </PublicButton>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[#A1A1A6]">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="underline hover:text-[#6E6E73] transition-colors">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
};
