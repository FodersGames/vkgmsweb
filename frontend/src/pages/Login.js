import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { EnvelopeSimple, Lock, User, Eye, EyeSlash, Warning, CheckCircle } from '@phosphor-icons/react';
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
      <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
      <input
        id={id}
        type={isPassword && show ? 'text' : type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="w-full pl-10 pr-10 py-2.5 bg-[#181818] border border-white/15 text-white text-sm focus:outline-none focus:border-[#FF6600] transition-all placeholder:text-white/25"
      />
      {isPassword && (
        <button
          type="button"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/auth/change-password`,
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-7 bg-[#121212] border border-white/15 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#FF6600]" />
          <h2 className="text-base font-black uppercase text-white tracking-wider">
            Change Temporary Password
          </h2>
        </div>
        <p className="text-xs text-white/50 mb-5 leading-relaxed">
          You are using a temporary password. Please choose a new permanent password to continue.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <Warning size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
              Current Temporary Password
            </label>
            <InputField
              icon={Lock}
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              id="current-password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
              New Password
            </label>
            <InputField
              icon={Lock}
              type="password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              id="new-password"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
              Confirm New Password
            </label>
            <InputField
              icon={Lock}
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              id="confirm-password"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-kefir w-full py-3 text-xs mt-2 disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const Login = () => {
  const navigate = useNavigate();
  const { login, register, user, mustChangePassword } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [reg, setReg] = useState({ name: '', email: '', password: '' });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    document.title = tab === 'login' ? 'Sign In — Vakar Games' : 'Create Account — Vakar Games';
  }, [tab]);

  useEffect(() => {
    if (mustChangePassword) {
      setMustChange(true);
    }
  }, [mustChangePassword]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const result = await login(cleanEmail, password);
    setLoginLoading(false);
    if (!result.success) {
      setLoginError(result.error || 'Failed to sign in. Please check your credentials.');
      return;
    }
    if (result.must_change_password) {
      setMustChange(true);
      return;
    }
    if (hasDashboardAccess(result.user)) {
      navigate('/dashboard');
    } else {
      navigate('/profile');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (!reg.name.trim()) {
      setRegError('Please enter your name.');
      return;
    }
    if (reg.password.length < 8) {
      setRegError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Za-z]/.test(reg.password) || !/[0-9]/.test(reg.password)) {
      setRegError('Password must contain at least one letter and one number.');
      return;
    }
    setRegLoading(true);
    const cleanEmail = reg.email.trim().toLowerCase();
    const result = await register({
      name: reg.name.trim(),
      email: cleanEmail,
      password: reg.password,
    });
    setRegLoading(false);
    if (!result.success) {
      setRegError(result.error || 'Registration failed.');
    } else {
      setTab('login');
      setEmail(cleanEmail);
      setRegSuccess(true);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4 bg-[#0D0D0D]">
      {/* Dark background styling — No AI images */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-[#FF6600]/10 blur-[130px]" />
      </div>

      {mustChange && (
        <ChangePasswordModal
          onSuccess={() => {
            if (hasDashboardAccess(user)) {
              navigate('/dashboard');
            } else {
              navigate('/profile');
            }
          }}
        />
      )}

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex flex-col items-center gap-2.5 group transition-colors"
          >
            <img src="/logo.png" alt="Vakar Games" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" />
            <span className="text-[17px] font-black uppercase tracking-wider text-white group-hover:text-[#FF6600] transition-colors">
              Vakar Games
            </span>
          </Link>
          <p className="mt-2 text-xs font-mono uppercase tracking-wider text-white/50">
            {tab === 'login' ? 'Authentication / Sign In' : 'New Player Registration'}
          </p>
        </div>

        <div className="animate-appear bg-[#121212] border border-white/12 shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {[{ id: 'login', label: 'Sign In' }, { id: 'register', label: 'Create Account' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  tab === id
                    ? 'text-white border-b-2 border-[#FF6600] bg-[#161616]'
                    : 'text-white/40 hover:text-white bg-[#0F0F0F]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="p-6 sm:p-7 space-y-4" data-testid="login-form">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
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
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
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
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2" data-testid="login-error">
                  <Warning size={15} className="flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="btn-kefir w-full py-3 text-xs disabled:opacity-50"
                data-testid="login-submit-button"
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="p-6 sm:p-7">
              {regSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#FF6600]/15 border border-[#FF6600]/40 flex items-center justify-center mx-auto text-[#FF6600]">
                    <CheckCircle size={24} weight="bold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-wider">Account Created</h3>
                    <p className="text-xs text-white/50 mt-1">
                      You can now sign in with your email and password.
                    </p>
                  </div>
                  <button
                    onClick={() => { setTab('login'); setEmail(reg.email); setRegSuccess(false); }}
                    className="btn-kefir w-full py-2.5 text-xs mt-2"
                  >
                    Proceed to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
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
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
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
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      Password
                    </label>
                    <InputField
                      icon={Lock}
                      type="password"
                      placeholder="Min. 8 chars, 1 letter, 1 number"
                      value={reg.password}
                      onChange={e => setReg(r => ({ ...r, password: e.target.value }))}
                      autoComplete="new-password"
                    />
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2" data-testid="register-error">
                      <Warning size={15} className="flex-shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="btn-kefir w-full py-3 text-xs disabled:opacity-50"
                    data-testid="register-submit-button"
                  >
                    {regLoading ? 'Creating account…' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-white/40">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="underline hover:text-white transition-colors">Terms of Service</Link>.
        </p>
      </div>
    </div>
  );
};

export default Login;
