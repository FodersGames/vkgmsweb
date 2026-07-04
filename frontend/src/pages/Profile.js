import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { User, Lock, LogOut, Bell, Eye, EyeOff, CheckCircle, AlertTriangle, Edit2, X, Save, Shield, Star, Trophy, Gem, LayoutDashboard, Camera } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PasswordField = ({ label, value, onChange, autoComplete, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className="w-full pl-9 pr-9 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]"
        />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#78716C] transition-colors" onClick={() => setShow(s => !s)} tabIndex={-1}>
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );
};

const TextField = ({ label, value, onChange, placeholder, icon: Icon, autoComplete }) => (
  <div>
    <label className="block text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-1.5">{label}</label>
    <div className="relative">
      {Icon && <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] pointer-events-none" />}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]`}
      />
    </div>
  </div>
);

// ── Loyalty system ────────────────────────────────────────────────────────────

const TIERS = {
  bronze:  { label: 'Bronze',  color: '#CD7F32', icon: Shield,  discount: 0,  min: 0     },
  silver:  { label: 'Silver',  color: '#94A3B8', icon: Star,    discount: 5,  min: 2500  },
  gold:    { label: 'Gold',    color: '#F59E0B', icon: Trophy,  discount: 10, min: 10000 },
  diamond: { label: 'Diamond', color: '#22D3EE', icon: Gem,     discount: 15, min: 25000 },
};
const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond'];

const LoyaltyWidget = ({ loyalty }) => {
  if (!loyalty) return null;
  const { total_spent_cents, tier, next_tier, next_threshold_cents } = loyalty;
  const cfg = TIERS[tier] || TIERS.bronze;
  const tierIdx = TIER_ORDER.indexOf(tier);
  const Icon = cfg.icon;
  const progressPct = next_threshold_cents
    ? Math.min(100, ((total_spent_cents - cfg.min) / (next_threshold_cents - cfg.min)) * 100)
    : 100;

  return (
    <div className="bg-[#1C1917] p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color: cfg.color }} />
          <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: cfg.color }}>
            {cfg.label} rank
          </h2>
        </div>
        <span className="text-xs text-[#44403C] tabular-nums">${(total_spent_cents / 100).toFixed(2)} spent</span>
      </div>

      {/* Track */}
      <div className="relative h-px bg-[#292524] mb-2">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-700"
          style={{ width: `${progressPct}%`, backgroundColor: cfg.color }}
        />
        {[{ pct: 10, t: 'bronze' }, { pct: 33, t: 'silver' }, { pct: 66, t: 'gold' }, { pct: 100, t: 'diamond' }].map(({ pct, t }) => (
          <div
            key={t}
            className="absolute -top-1 w-px h-3"
            style={{ left: `${pct}%`, backgroundColor: TIER_ORDER.indexOf(t) <= tierIdx ? TIERS[t].color : '#292524' }}
          />
        ))}
      </div>

      <div className="flex justify-between mb-5">
        {TIER_ORDER.map((t, i) => (
          <span
            key={t}
            className="text-[9px] font-semibold tracking-[0.15em] uppercase"
            style={{ color: i <= tierIdx ? TIERS[t].color : '#292524' }}
          >
            {TIERS[t].label}
          </span>
        ))}
      </div>

      {next_threshold_cents && next_tier ? (
        <p className="text-[10px] text-[#44403C]">
          ${((next_threshold_cents - total_spent_cents) / 100).toFixed(2)} to reach{' '}
          <span style={{ color: TIERS[next_tier]?.color }}>{TIERS[next_tier]?.label}</span>
        </p>
      ) : (
        <p className="text-[10px]" style={{ color: cfg.color }}>Maximum rank achieved.</p>
      )}

      {cfg.discount > 0 && (
        <p className="text-[10px] mt-1" style={{ color: cfg.color }}>
          {cfg.discount}% discount applied on all in-app purchases.
        </p>
      )}
    </div>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-[#E8E3DB] p-6 ${className}`}>{children}</div>
);

const CardTitle = ({ icon: Icon, children, action }) => (
  <div className="flex items-center justify-between mb-5">
    <h2 className="text-xs font-bold text-[#1C1917] uppercase tracking-[0.12em] flex items-center gap-2">
      <Icon size={13} className="text-[#4ECDC4]" />
      {children}
    </h2>
    {action}
  </div>
);

const Profile = () => {
  const { user, logout, updateProfile, changePassword, token, isAdmin, refreshUser } = useAuth();
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const navigate = useNavigate();

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
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!user) return null;

  const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';
  const displayName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
  const currentTier = TIERS[loyalty?.tier] || TIERS.bronze;

  return (
    <div className="bg-[#F9F7F4] min-h-screen flex flex-col">
      <PublicNav />

      <div className="pt-16 flex-1">

        {/* Hero banner */}
        <div className="bg-white border-b border-[#E8E3DB] px-6 md:px-10 lg:px-16 pt-16 pb-10">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold text-[#4ECDC4] tracking-[0.16em] uppercase mb-4">My Account</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className="relative shrink-0 group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <div
                  className="w-16 h-16 overflow-hidden flex items-center justify-center text-xl font-black"
                  style={{
                    background: loyalty ? `${currentTier.color}18` : '#4ECDC418',
                    border: `2px solid ${loyalty ? currentTier.color + '44' : '#4ECDC444'}`,
                    color: loyalty ? currentTier.color : '#4ECDC4',
                    fontFamily: "'Bebas Neue', sans-serif",
                  }}
                >
                  {avatarPreview || user.avatar_url ? (
                    <img
                      src={avatarPreview || (user.avatar_url?.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url)}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : initials}
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-[#1C1917]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {avatarUploading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={14} className="text-white" />
                  }
                </div>
                {loyalty && !avatarPreview && !user.avatar_url && (
                  <div
                    className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: currentTier.color }}
                  >
                    {React.createElement(currentTier.icon, { size: 10, color: 'white' })}
                  </div>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.svg"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1
                    className="text-4xl sm:text-5xl font-black text-[#1C1917] leading-tight"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    {displayName}
                  </h1>
                  {user.is_super_admin && (
                    <span className="text-[10px] font-bold bg-[#4ECDC4]/15 text-[#4ECDC4] px-2 py-0.5">
                      SUPER ADMIN
                    </span>
                  )}
                </div>
                <p className="text-[#78716C] text-sm">{user.email}</p>
                {loyalty && (
                  <p className="text-xs mt-1" style={{ color: currentTier.color }}>
                    {currentTier.label} grade{currentTier.discount > 0 ? ` · ${currentTier.discount}% off in-app purchases` : ''}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && isAdmin() && (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] px-3 py-2 transition-all"
                  >
                    <LayoutDashboard size={12} />
                    Dashboard
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-red-500 border border-[#E8E3DB] hover:border-red-200 px-3 py-2 transition-all"
                >
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Avatar error */}
        {avatarError && (
          <div className="max-w-5xl mx-auto px-6 pt-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs">
              <AlertTriangle size={12} className="shrink-0" />{avatarError}
              <button onClick={() => setAvatarError('')} className="ml-auto"><X size={12} /></button>
            </div>
          </div>
        )}

        {/* Main content — 2-column on desktop */}
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left column — Account + Loyalty */}
            <div className="lg:col-span-3 space-y-6">

              {/* Account Info */}
              <Card>
                <CardTitle
                  icon={User}
                  action={
                    !editingProfile ? (
                      <button
                        onClick={() => setEditingProfile(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] px-2.5 py-1.5 transition-all"
                      >
                        <Edit2 size={11} />Edit
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
                      <p className="text-xs font-semibold text-[#A8A29E] uppercase tracking-wider mb-1">Email</p>
                      <p className="text-sm text-[#78716C]">{user.email} <span className="text-[#A8A29E] text-xs">(cannot be changed)</span></p>
                    </div>
                    {profileError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-sm">
                        <AlertTriangle size={13} className="shrink-0" />{profileError}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={profileLoading} className="inline-flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50">
                        <Save size={13} />{profileLoading ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button type="button" onClick={handleProfileCancel} className="inline-flex items-center gap-2 text-sm font-medium text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] px-4 py-2 transition-all">
                        <X size={13} />Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {profileSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 text-green-600 text-sm mb-4">
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
                          <p className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wider mb-0.5">{label}</p>
                          <p className="text-sm text-[#1C1917] break-all">{value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>

              {/* Loyalty */}
              {loyaltyLoading
                ? <div className="bg-white border border-[#E8E3DB] p-6 h-[200px] animate-pulse" />
                : <LoyaltyWidget loyalty={loyalty} />
              }
            </div>

            {/* Right column — Notifications + Password */}
            <div className="lg:col-span-2 space-y-6">

              {/* Notifications */}
              <Card>
                <CardTitle
                  icon={Bell}
                  action={notifUnread > 0 ? (
                    <button onClick={markAllRead} className="text-xs text-[#78716C] hover:text-[#1C1917] transition-colors">
                      Mark all read
                    </button>
                  ) : null}
                >
                  Notifications
                  {notifUnread > 0 && (
                    <span className="ml-1.5 bg-[#4ECDC4] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {notifUnread}
                    </span>
                  )}
                </CardTitle>

                {notifLoading ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-12 bg-[#F9F7F4] animate-pulse" />)}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[#A8A29E]">No notifications yet.</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => !n.read && markRead(n.id)}
                        className={`p-3 border transition-all cursor-pointer ${
                          n.read ? 'border-[#F0EDE8] bg-[#FAFAF9]' : 'border-[#4ECDC4]/20 bg-[#4ECDC4]/5 hover:bg-[#4ECDC4]/8'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-snug ${n.read ? 'text-[#78716C]' : 'text-[#1C1917] font-semibold'}`}>{n.title}</p>
                            {n.message && <p className="text-[10px] text-[#A8A29E] mt-0.5 leading-relaxed">{n.message}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" />}
                            <time className="text-[9px] text-[#A8A29E] whitespace-nowrap">
                              {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </time>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Change Password */}
              <Card>
                <CardTitle icon={Lock}>Change Password</CardTitle>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <PasswordField label="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" placeholder="Your current password" />
                  <PasswordField label="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 chars" />
                  <PasswordField label="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" placeholder="Repeat your new password" />
                  {pwError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs">
                      <AlertTriangle size={12} className="shrink-0" />{pwError}
                    </div>
                  )}
                  {pwSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 text-green-600 text-xs">
                      <CheckCircle size={12} className="shrink-0" />Password updated successfully.
                    </div>
                  )}
                  <button type="submit" disabled={pwLoading} className="w-full bg-[#1C1917] hover:bg-[#2D2926] text-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
                    {pwLoading ? 'Saving…' : 'Update Password'}
                  </button>
                </form>
              </Card>

            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Profile;
