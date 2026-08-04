import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { PublicButton } from '../ui/PublicButton';
import { SiteFooter } from '../components/SiteFooter';
import { User, Lock, SignOut, Bell, Eye, EyeSlash, CheckCircle, Warning, PencilSimple, X, FloppyDisk, SquaresFour, Camera, GameController, CaretRight } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PasswordField = ({ label, value, onChange, autoComplete, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className="w-full rounded-lg pl-9 pr-9 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A1A1A6]"
        />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#6E6E73] transition-colors" onClick={() => setShow(s => !s)} tabIndex={-1}>
          {show ? <EyeSlash size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );
};

const TextField = ({ label, value, onChange, placeholder, icon: Icon, autoComplete }) => (
  <div>
    <label className="block text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">{label}</label>
    <div className="relative">
      {Icon && <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] pointer-events-none" />}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className={`w-full rounded-lg ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A1A1A6]`}
      />
    </div>
  </div>
);

// ── Loyalty system — one accent color throughout, no per-tier rainbow;
// reads as a membership level, not a game rank-up bar. ─────────────────────
const TIERS = {
  bronze:  { label: 'Bronze',  discount: 0,  min: 0     },
  silver:  { label: 'Silver',  discount: 5,  min: 2500  },
  gold:    { label: 'Gold',    discount: 10, min: 10000 },
  diamond: { label: 'Diamond', discount: 15, min: 25000 },
};
const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond'];

const LoyaltyWidget = ({ loyalty }) => {
  if (!loyalty) return null;
  const { total_spent_cents, tier, next_tier, next_threshold_cents } = loyalty;
  const cfg = TIERS[tier] || TIERS.bronze;
  const tierIdx = TIER_ORDER.indexOf(tier);
  const progressPct = next_threshold_cents
    ? Math.min(100, ((total_spent_cents - cfg.min) / (next_threshold_cents - cfg.min)) * 100)
    : 100;

  return (
    <div className="rounded-xl liquid-glass p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-mono text-[#6E6E73]">// membership</h2>
        <span className="text-xs text-[#A1A1A6] tabular-nums">${(total_spent_cents / 100).toFixed(2)} spent</span>
      </div>

      <p className="font-display text-2xl font-medium tracking-[-0.01em] text-[#1D1D1F] mb-4">{cfg.label}</p>

      {/* Track */}
      <div className="relative h-1 rounded-full bg-[#EDEDEF] mb-2">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-[#4ECDC4] transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex justify-between mb-5">
        {TIER_ORDER.map((t, i) => (
          <span
            key={t}
            className={`text-[9px] font-semibold tracking-[0.1em] uppercase ${i <= tierIdx ? 'text-[#1D1D1F]' : 'text-[#BFBFC4]'}`}
          >
            {TIERS[t].label}
          </span>
        ))}
      </div>

      {next_threshold_cents && next_tier ? (
        <p className="text-[10px] text-[#A1A1A6]">
          ${((next_threshold_cents - total_spent_cents) / 100).toFixed(2)} to reach{' '}
          <span className="font-semibold text-[#1D1D1F]">{TIERS[next_tier]?.label}</span>
        </p>
      ) : (
        <p className="text-[10px] font-semibold text-[#1D1D1F]">Highest membership level reached.</p>
      )}

      {cfg.discount > 0 && (
        <p className="text-[10px] mt-1 text-[#6E6E73]">
          {cfg.discount}% discount applied on all in-app purchases.
        </p>
      )}
    </div>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`rounded-xl liquid-glass p-6 ${className}`}>{children}</div>
);

const CardTitle = ({ icon: Icon, children, action }) => (
  <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
      <Icon size={15} className="text-[#4ECDC4]" />
      {children}
    </h2>
    {action}
  </div>
);

const TABS = [
  { id: 'account',       label: 'Account',       icon: User },
  { id: 'security',      label: 'Security',      icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const Profile = () => {
  const { user, logout, updateProfile, changePassword, token, isAdmin, refreshUser, loading: authLoading } = useAuth();
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('account');

  const DEFAULT_LOYALTY = { total_spent_cents: 0, tier: 'bronze', discount_pct: 0, next_tier: 'silver', next_threshold_cents: 2500 };
  const [loyalty, setLoyalty] = useState(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);

  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', username: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    document.title = 'My Account — Vakar Games';
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    setProfileForm({ firstName: user.firstName || '', lastName: user.lastName || '', username: user.username || '' });
    fetchNotifications();
    if (token) {
      setLoyaltyLoading(true);
      axios.get(`${API_URL}/api/user/loyalty`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => setLoyalty(r.data))
        .catch(() => setLoyalty(DEFAULT_LOYALTY))
        .finally(() => setLoyaltyLoading(false));
    } else {
      setLoyalty(DEFAULT_LOYALTY);
      setLoyaltyLoading(false);
    }
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setNotifUnread(data.unread || 0);
      }
    } catch { /* silent */ } finally {
      setNotifLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
      setNotifUnread(u => Math.max(0, u - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
      setNotifUnread(0);
    } catch { /* silent */ }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);
    setProfileLoading(true);
    const result = await updateProfile(profileForm);
    setProfileLoading(false);
    if (result.success) {
      setProfileSuccess(true);
      setEditingProfile(false);
      setTimeout(() => setProfileSuccess(false), 4000);
    } else {
      setProfileError(result.error);
    }
  };

  const handleProfileCancel = () => {
    setEditingProfile(false);
    setProfileError('');
    setProfileForm({ firstName: user.firstName || '', lastName: user.lastName || '', username: user.username || '' });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    const result = await changePassword({ currentPassword: currentPw, newPassword: newPw });
    setPwLoading(false);
    if (result.success) {
      setPwSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSuccess(false), 4000);
    } else {
      setPwError(result.error);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (!ALLOWED.includes(file.type)) {
      setAvatarError('Only JPG, PNG or SVG files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('File too large. Maximum 5 MB.');
      return;
    }
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API_URL}/api/user/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      await refreshUser();
    } catch {
      setAvatarError('Upload failed. Please try again.');
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  if (authLoading || !user) return null;

  const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';
  const displayName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
  const currentTier = TIERS[loyalty?.tier] || TIERS.bronze;

  return (
    <div className="bg-[#F5F5F7] min-h-screen flex flex-col">
      <PublicNav />

      <div className="pt-[52px] flex-1">

        {/* Hero — centered Apple-ID-style summary */}
        <div className="bg-white border-b border-[#D2D2D7] px-6 pt-14 pb-8">
          <div className="max-w-lg mx-auto flex flex-col items-center text-center">

            {/* Avatar */}
            <div className="relative shrink-0 group cursor-pointer mb-4" onClick={() => avatarInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-medium font-display bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73]">
                {avatarPreview || user.avatar_url ? (
                  <img
                    src={avatarPreview || (user.avatar_url?.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url)}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : initials}
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-full bg-[#1D1D1F]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {avatarUploading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={16} className="text-white" />
                }
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.svg"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <p className="text-[12px] font-mono text-[#6E6E73] mb-2">// my account</p>

            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap justify-center mb-1">
              <h1 className="font-display text-2xl font-medium tracking-[-0.01em] text-[#1D1D1F]">{displayName}</h1>
              {user.is_super_admin && (
                <span className="rounded-full text-[10px] font-bold bg-[#4ECDC4]/15 text-[#4ECDC4] px-2 py-0.5">
                  SUPER ADMIN
                </span>
              )}
            </div>
            <p className="text-[#6E6E73] text-sm">{user.email}</p>
            {loyalty && (
              <p className="text-xs mt-1.5 font-medium text-[#6E6E73]">
                {currentTier.label} membership{currentTier.discount > 0 ? ` · ${currentTier.discount}% off in-app purchases` : ''}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-5">
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  className="rounded-full inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] px-3 py-2 transition-all"
                >
                  <SquaresFour size={12} />
                  Dashboard
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="rounded-full inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-red-500 border border-[#D2D2D7] hover:border-red-200 px-3 py-2 transition-all"
              >
                <SignOut size={12} />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Avatar error */}
        {avatarError && (
          <div className="max-w-lg mx-auto px-6 pt-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs">
              <Warning size={12} className="shrink-0" />{avatarError}
              <button onClick={() => setAvatarError('')} className="ml-auto"><X size={12} /></button>
            </div>
          </div>
        )}

        {/* Vakar Play quick link — always visible, independent of the tabs below */}
        <div className="max-w-lg mx-auto px-6 pt-6">
          <Link
            to="/play"
            className="flex items-center gap-4 rounded-xl liquid-glass liquid-glass-interactive p-4 group"
          >
            <div className="rounded-lg w-9 h-9 flex items-center justify-center shrink-0 bg-[#F5F5F7] border border-[#D2D2D7]">
              <GameController size={16} className="text-[#6E6E73]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1D1D1F]">Vakar Play</p>
              <p className="text-xs text-[#6E6E73]">Your game library and last sessions</p>
            </div>
            <CaretRight size={15} className="text-[#BFBFC4] group-hover:text-[#4ECDC4] transition-colors shrink-0" />
          </Link>
        </div>

        {/* Settings tabs — segmented control, System-Settings style */}
        <div className="max-w-lg mx-auto px-6 pt-6">
          <div className="inline-flex w-full rounded-full bg-[#EDEDEF] p-1 gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-all ${
                  activeTab === id ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                <Icon size={13} />
                {label}
                {id === 'notifications' && notifUnread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4ECDC4] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

          {activeTab === 'account' && (
            <>
              <Card>
                <CardTitle
                  icon={User}
                  action={
                    !editingProfile ? (
                      <button
                        onClick={() => setEditingProfile(true)}
                        className="rounded-full inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] px-2.5 py-1.5 transition-all"
                      >
                        <PencilSimple size={11} />Edit
                      </button>
                    ) : null
                  }
                >
                  Account Details
                </CardTitle>

                {editingProfile ? (
                  <form onSubmit={handleProfileSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <TextField label="First Name" value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jane" icon={User} autoComplete="given-name" />
                      <TextField label="Last Name" value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" icon={User} autoComplete="family-name" />
                    </div>
                    <TextField label="Username" value={profileForm.username} onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} placeholder="jane_doe" autoComplete="username" />
                    <div>
                      <p className="text-xs font-semibold text-[#A1A1A6] uppercase tracking-wider mb-1">Email</p>
                      <p className="text-sm text-[#6E6E73]">{user.email} <span className="text-[#A1A1A6] text-xs">(cannot be changed)</span></p>
                    </div>
                    {profileError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                        <Warning size={13} className="shrink-0" />{profileError}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <PublicButton type="submit" disabled={profileLoading} size="sm" icon={FloppyDisk} iconPosition="leading">
                        {profileLoading ? 'Saving…' : 'Save Changes'}
                      </PublicButton>
                      <PublicButton type="button" onClick={handleProfileCancel} variant="outline" size="sm" icon={X} iconPosition="leading">
                        Cancel
                      </PublicButton>
                    </div>
                  </form>
                ) : (
                  <>
                    {profileSuccess && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-green-600 text-sm mb-4">
                        <CheckCircle size={13} className="shrink-0" />Profile updated successfully.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {[
                        { label: 'First Name', value: user.firstName || '—' },
                        { label: 'Last Name',  value: user.lastName  || '—' },
                        { label: 'Username',   value: '@' + user.username  },
                        { label: 'Email',      value: user.email           },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold text-[#A1A1A6] uppercase tracking-wider mb-0.5">{label}</p>
                          <p className="text-sm text-[#1D1D1F] break-all">{value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>

              {loyaltyLoading
                ? <div className="rounded-xl bg-white border border-[#D2D2D7] p-6 h-[200px] animate-pulse" />
                : <LoyaltyWidget loyalty={loyalty} />
              }
            </>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardTitle icon={Lock}>Change Password</CardTitle>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <PasswordField label="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" placeholder="Your current password" />
                <PasswordField label="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 chars" />
                <PasswordField label="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" placeholder="Repeat your new password" />
                {pwError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs">
                    <Warning size={12} className="shrink-0" />{pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-green-600 text-xs">
                    <CheckCircle size={12} className="shrink-0" />Password updated successfully.
                  </div>
                )}
                <PublicButton type="submit" disabled={pwLoading} className="w-full">
                  {pwLoading ? 'Saving…' : 'Update Password'}
                </PublicButton>
              </form>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardTitle
                icon={Bell}
                action={notifUnread > 0 ? (
                  <button onClick={markAllRead} className="text-xs text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
                    Mark all read
                  </button>
                ) : null}
              >
                Notifications
              </CardTitle>

              {notifLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="rounded-lg h-12 bg-[#F5F5F7] animate-pulse" />)}
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#A1A1A6]">No notifications yet.</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto -mx-1 px-1">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={`rounded-lg p-3 border transition-all cursor-pointer ${
                        n.read ? 'border-[#EDEDEF] bg-[#FAFAF9]' : 'border-[#4ECDC4]/20 bg-[#4ECDC4]/5 hover:bg-[#4ECDC4]/8'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug ${n.read ? 'text-[#6E6E73]' : 'text-[#1D1D1F] font-semibold'}`}>{n.title}</p>
                          {n.message && <p className="text-[10px] text-[#A1A1A6] mt-0.5 leading-relaxed">{n.message}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" />}
                          <time className="text-[9px] text-[#A1A1A6] whitespace-nowrap">
                            {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </time>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Profile;
