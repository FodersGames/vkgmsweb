import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { User, Mail, Lock, LogOut, Bell, Eye, EyeOff, CheckCircle, AlertTriangle, Edit2, X, Save, Shield, Star, Trophy, Gem } from 'lucide-react';

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
          className="w-full pl-9 pr-9 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]"
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
        className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 bg-[#F9F7F4] border border-[#E8E3DB] text-[#1C1917] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4] transition-all placeholder:text-[#A8A29E]`}
      />
    </div>
  </div>
);

// ── Grade system ──────────────────────────────────────────────────────────────
const TIERS = {
  bronze:  { label: 'Bronze',  color: '#CD7F32', bg: '#CD7F3215', icon: Shield,  discount: 0,  min: 0,    next: 2500  },
  silver:  { label: 'Silver',  color: '#94A3B8', bg: '#94A3B815', icon: Star,    discount: 5,  min: 2500,  next: 10000 },
  gold:    { label: 'Gold',    color: '#F59E0B', bg: '#F59E0B15', icon: Trophy,  discount: 10, min: 10000, next: 25000 },
  diamond: { label: 'Diamond', color: '#22D3EE', bg: '#22D3EE15', icon: Gem,     discount: 15, min: 25000, next: null  },
};
const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond'];

const LoyaltyWidget = ({ loyalty }) => {
  if (!loyalty) return null;
  const { total_spent_cents, tier, next_tier, next_threshold_cents } = loyalty;
  const cfg = TIERS[tier] || TIERS.bronze;
  const Icon = cfg.icon;
  const tierIdx = TIER_ORDER.indexOf(tier);
  const progressPct = next_threshold_cents
    ? Math.min(100, ((total_spent_cents - cfg.min) / (next_threshold_cents - cfg.min)) * 100)
    : 100;

  return (
    <div className="bg-white border border-[#E8E3DB] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider flex items-center gap-2">
          <Icon size={14} style={{ color: cfg.color }} />Loyalty Grade
        </h2>
        <span className="text-xs font-bold px-2.5 py-1 rounded" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
          {cfg.label}{cfg.discount > 0 ? ` · −${cfg.discount}% off` : ''}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-[#A8A29E] mb-1.5">
          <span>${(total_spent_cents / 100).toFixed(2)} spent</span>
          {next_threshold_cents && <span>Next: {TIERS[next_tier]?.label} at ${(next_threshold_cents / 100).toFixed(0)}</span>}
        </div>
        <div className="relative h-2.5 bg-[#F0EDE8] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, backgroundColor: cfg.color }} />
          {TIER_ORDER.map((t, i) => {
            if (i === 0) return null;
            const pct = (TIERS[t].min / 25000) * 100;
            return (
              <div key={t} className="absolute top-0 bottom-0 w-0.5 rounded-full" style={{ left: `${pct}%`, backgroundColor: TIER_ORDER.indexOf(t) <= tierIdx ? TIERS[t].color : '#E8E3DB' }} />
            );
          })}
        </div>
      </div>

      <div className="flex justify-between">
        {TIER_ORDER.map(t => {
          const tc = TIERS[t];
          const TIcon = tc.icon;
          const reached = TIER_ORDER.indexOf(t) <= tierIdx;
          return (
            <div key={t} className="flex flex-col items-center gap-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: reached ? tc.bg : '#F9F7F4' }}>
                <TIcon size={13} style={{ color: reached ? tc.color : '#C9C3BB' }} />
              </div>
              <span className="text-[9px] font-bold" style={{ color: reached ? tc.color : '#C9C3BB' }}>{tc.label}</span>
              {tc.discount > 0 && <span className="text-[8px] text-[#A8A29E]">−{tc.discount}%</span>}
            </div>
          );
        })}
      </div>

      {cfg.discount > 0 && (
        <p className="text-xs text-[#4ECDC4] mt-4 font-medium text-center">
          Your {cfg.label} grade gives you {cfg.discount}% off all in-app purchases
        </p>
      )}
      {!cfg.discount && next_tier && (
        <p className="text-xs text-[#A8A29E] mt-4 text-center">
          Spend ${((next_threshold_cents - total_spent_cents) / 100).toFixed(2)} more to unlock {TIERS[next_tier]?.discount}% off with {TIERS[next_tier]?.label}
        </p>
      )}
    </div>
  );
};

const SectionCard = ({ children, className = '' }) => (
  <div className={`bg-white border border-[#E8E3DB] rounded-xl p-6 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ icon: Icon, children, action }) => (
  <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider flex items-center gap-2">
      <Icon size={14} className="text-[#4ECDC4]" />
      {children}
    </h2>
    {action}
  </div>
);

const Profile = () => {
  const { user, logout, updateProfile, changePassword, token } = useAuth();
  const navigate = useNavigate();

  // Loyalty
  const DEFAULT_LOYALTY = { total_spent_cents: 0, tier: 'bronze', discount_pct: 0, next_tier: 'silver', next_threshold_cents: 2500 };
  const [loyalty, setLoyalty] = useState(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', username: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password change
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

  const handleLogout = () => { logout(); navigate('/'); };

  if (!user) return null;

  const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="bg-[#F9F7F4] min-h-screen">
      <PublicNav />

      <div className="pt-16">
        {/* Header */}
        <div className="bg-white border-b border-[#E8E3DB] py-12 px-6">
          <div className="max-w-3xl mx-auto flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-xl font-bold text-[#4ECDC4] shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#1C1917]">
                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
              </h1>
              <p className="text-sm text-[#78716C]">{user.email}</p>
              {user.is_super_admin && (
                <span className="inline-block mt-1 text-xs font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-2 py-0.5 rounded">
                  Super Admin
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#78716C] hover:text-red-600 border border-[#E8E3DB] hover:border-red-200 rounded-lg transition-all shrink-0"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">

          {/* Account Info */}
          <SectionCard>
            <SectionTitle
              icon={User}
              action={
                !editingProfile ? (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] rounded px-2.5 py-1.5 transition-all"
                  >
                    <Edit2 size={11} />
                    Edit
                  </button>
                ) : null
              }
            >
              Account Details
            </SectionTitle>

            {editingProfile ? (
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <TextField label="First Name" value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jane" icon={User} autoComplete="given-name" />
                  <TextField label="Last Name" value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" icon={User} autoComplete="family-name" />
                </div>
                <TextField label="Username" value={profileForm.username} onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} placeholder="jane_doe" autoComplete="username" />
                <div>
                  <p className="text-xs font-semibold text-[#A8A29E] uppercase tracking-wider mb-1.5">Email</p>
                  <p className="text-sm text-[#78716C]">{user.email} <span className="text-[#A8A29E]">(cannot be changed)</span></p>
                </div>
                {profileError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                    <AlertTriangle size={13} className="shrink-0" />{profileError}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={profileLoading} className="inline-flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50">
                    <Save size={13} />{profileLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={handleProfileCancel} className="inline-flex items-center gap-2 text-sm font-medium text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] rounded-lg px-4 py-2 transition-all">
                    <X size={13} />Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {profileSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-lg mb-4">
                    <CheckCircle size={13} className="shrink-0" />Profile updated successfully.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[
                    { label: 'First Name', value: user.firstName || '—' },
                    { label: 'Last Name',  value: user.lastName  || '—' },
                    { label: 'Username',   value: '@' + user.username  },
                    { label: 'Email',      value: user.email           },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-[#A8A29E] uppercase tracking-wider mb-0.5">{label}</p>
                      <p className="text-sm text-[#1C1917]">{value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          {/* Loyalty */}
          {loyaltyLoading
            ? <div className="bg-white border border-[#E8E3DB] rounded-xl p-6 h-[150px] animate-pulse" />
            : <LoyaltyWidget loyalty={loyalty} />
          }

          {/* Notifications */}
          <SectionCard>
            <SectionTitle
              icon={Bell}
              action={notifUnread > 0 ? (
                <button onClick={markAllRead} className="text-xs text-[#78716C] hover:text-[#1C1917] transition-colors">
                  Mark all read
                </button>
              ) : null}
            >
              Notifications
              {notifUnread > 0 && (
                <span className="ml-1.5 bg-[#4ECDC4] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {notifUnread}
                </span>
              )}
            </SectionTitle>

            {notifLoading ? (
              <div className="py-6 text-center text-sm text-[#A8A29E]">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#A8A29E]">No notifications yet.</div>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      n.read ? 'border-[#F0EDE8] bg-[#FAFAF9]' : 'border-[#4ECDC4]/20 bg-[#4ECDC4]/5 hover:bg-[#4ECDC4]/8'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${n.read ? 'text-[#78716C]' : 'text-[#1C1917] font-semibold'}`}>{n.title}</p>
                        {n.message && <p className="text-xs text-[#A8A29E] mt-0.5 leading-relaxed">{n.message}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && <div className="w-2 h-2 rounded-full bg-[#4ECDC4]" />}
                        <time className="text-[10px] text-[#A8A29E]">
                          {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Change Password */}
          <SectionCard>
            <SectionTitle icon={Lock}>Change Password</SectionTitle>
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
              <PasswordField label="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" placeholder="Your current password" />
              <PasswordField label="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 chars, 1 letter, 1 number" />
              <PasswordField label="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" placeholder="Repeat your new password" />
              {pwError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                  <AlertTriangle size={13} className="shrink-0" />{pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-lg">
                  <CheckCircle size={13} className="shrink-0" />Password updated successfully.
                </div>
              )}
              <button type="submit" disabled={pwLoading} className="bg-[#1C1917] hover:bg-[#2D2926] text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
                {pwLoading ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          </SectionCard>

        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Profile;
