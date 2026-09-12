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
      <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B] pointer-events-none" />
      <input
        id={id}
        type={isPassword && show ? 'text' : type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="w-full pl-10 pr-10 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg text-[#1D1D1F] text-sm focus:outline-none focus:border-[#1D1D1F] transition-all placeholder:text-[#86868B]"
      />
      {isPassword && (
        <button
          type="button"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
        >
          {show ? <EyeSlash size={15} /> : <Eye size={15} />}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl border border-[#E5E5EA] shadow-2xl">
        <h2 className="text-lg font-semibold text-[#1D1D1F] tracking-tight mb-1">
          Change Temporary Password
        </h2>
        <p className="text-xs text-[#6E6E73] mb-6 leading-relaxed">
          You are using a temporary password. Please choose a new permanent password to continue.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <Warning size={15} className="flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
            <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
            <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
            className="btn-apple w-full !py-2.5 text-xs mt-2 disabled:opacity-50"
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
  const [tab, setTab] = useState('login');

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
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-[#F5F5F7] text-[#1D1D1F]">
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

      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex flex-col items-center gap-2 group"
          >
            <img src="/logo.png" alt="Vakar Games" className="h-9 w-auto object-contain transition-transform group-hover:scale-105" />
            <span className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
              Vakar Games
            </span>
          </Link>
          <p className="mt-1 text-xs text-[#6E6E73]">
            {tab === 'login' ? 'Sign in with your account' : 'Create your player profile'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-sm overflow-hidden">
          {/* Segmented control tabs */}
          <div className="flex border-b border-[#E5E5EA] bg-[#FBFBFD] p-1 gap-1">
            {[{ id: 'login', label: 'Sign In' }, { id: 'register', label: 'Create Account' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  tab === id
                    ? 'bg-white text-[#1D1D1F] shadow-sm font-semibold'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="p-7 space-y-4" data-testid="login-form">
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
                <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2" data-testid="login-error">
                  <Warning size={15} className="flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="btn-apple w-full !py-2.5 text-xs font-medium mt-2 disabled:opacity-50"
                data-testid="login-submit-button"
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="p-7">
              {regSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle size={26} weight="bold" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#1D1D1F]">Account Created</h3>
                    <p className="text-xs text-[#6E6E73] mt-1">
                      You can now sign in with your email and password.
                    </p>
                  </div>
                  <button
                    onClick={() => { setTab('login'); setEmail(reg.email); setRegSuccess(false); }}
                    className="btn-apple w-full !py-2.5 text-xs mt-2"
                  >
                    Proceed to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4" data-testid="register-form">
                  <div>
                    <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
                    <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
                    <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
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
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2" data-testid="register-error">
                      <Warning size={15} className="flex-shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="btn-apple w-full !py-2.5 text-xs font-medium mt-2 disabled:opacity-50"
                    data-testid="register-submit-button"
                  >
                    {regLoading ? 'Creating account…' : 'Create Account'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#86868B]">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-[#1D1D1F] transition-colors">Terms of Service</Link> and{' '}
          <Link to="/privacy" className="underline hover:text-[#1D1D1F] transition-colors">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default Login;
