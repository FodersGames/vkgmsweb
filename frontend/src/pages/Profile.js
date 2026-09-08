import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import {
  User, Lock, SignOut, Bell, Eye, EyeSlash,
  CheckCircle, Warning, PencilSimple, X,
  FloppyDisk, SquaresFour, Camera, CircleNotch,
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';
const FIRSTNAME_COOLDOWN_DAYS = 30;

/* ─── Style helpers ────────────────────────────────────────────────────── */
const inputDark = {
  backgroundColor: '#0A0A0A',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF',
  borderRadius: 0,
  outline: 'none',
  width: '100%',
  padding: '0.6rem 0.75rem',
  fontSize: '0.875rem',
};
const inputFocusDark = { borderColor: '#4ECDC4' };

const cardDark = {
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.06)',
  padding: '1.5rem',
};

/* ─── Sub-components ─────────────────────────────────────────────────── */
const PasswordField = ({ label, value, onChange, autoComplete, placeholder }) => {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '0.4rem' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Lock size={12} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...inputDark, paddingLeft: '2.25rem', paddingRight: '2.5rem', ...(focused ? inputFocusDark : {}) }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {show ? <EyeSlash size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );
};

const TextField = ({ label, value, onChange, placeholder, autoComplete, required = true, disabled = false, hint }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '0.4rem' }}>
        {label} {!required && <span style={{ color: 'rgba(255,255,255,0.2)', textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(optional)</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...inputDark, ...(focused && !disabled ? inputFocusDark : {}), opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'text' }}
      />
      {hint && <p style={{ marginTop: '0.25rem', fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>{hint}</p>}
    </div>
  );
};

const cooldownDaysLeft = (changedAt, cooldownDays) => {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  const remaining = cooldownDays - Math.floor(elapsedMs / 86400000);
  return Math.max(0, remaining);
};

const TABS = [
  { id: 'account',       label: 'Account',       icon: User },
  { id: 'security',      label: 'Security',      icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

/* ─── Main Profile component ─────────────────────────────────────────── */
const Profile = () => {
  const { user, logout, updateProfile, changePassword, token, isAdmin, refreshUser, loading: authLoading } = useAuth();
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('account');

  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', username: '' });
  const firstNameDaysLeft = user ? cooldownDaysLeft(user.firstNameChangedAt, FIRSTNAME_COOLDOWN_DAYS) : 0;
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

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav />

      <div style={{ flex: 1, paddingTop: '60px' }}>

        {/* ── Hero header ─────────────────────────────────────────── */}
        <div style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '3.5rem 1.5rem 2.5rem' }}>
          <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

            {/* Avatar */}
            <div
              style={{ position: 'relative', cursor: 'pointer', marginBottom: '1.25rem' }}
              onClick={() => avatarInputRef.current?.click()}
              title="Change avatar"
            >
              <div style={{
                width: '80px', height: '80px',
                border: '2px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 900, color: '#4ECDC4',
                backgroundColor: '#1A1A1A', overflow: 'hidden',
              }}>
                {avatarPreview || user.avatar_url ? (
                  <img
                    src={avatarPreview || (user.avatar_url?.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url)}
                    alt="avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : initials}
              </div>
              {/* Hover overlay */}
              <div className="avatar-overlay" style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                {avatarUploading
                  ? <CircleNotch size={16} className="animate-spin" style={{ color: '#FFFFFF' }} />
                  : <Camera size={16} style={{ color: '#FFFFFF' }} />
                }
              </div>
              <input ref={avatarInputRef} type="file" accept=".jpg,.jpeg,.png,.svg" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>

            {/* Name + badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '0.25rem' }}>
              <h1 style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', fontSize: '1.5rem', color: '#FFFFFF', margin: 0 }}>
                {displayName}
              </h1>
              {user.is_super_admin && (
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)', padding: '0.1rem 0.5rem' }}>
                  Super Admin
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{user.email}</p>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)', padding: '0.45rem 0.85rem', textDecoration: 'none', transition: 'color 0.2s, border-color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                >
                  <SquaresFour size={12} /> Dashboard
                </Link>
              )}
              <button
                onClick={handleLogout}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,100,100,0.6)', border: '1px solid rgba(255,100,100,0.2)', padding: '0.45rem 0.85rem', background: 'none', cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#FF6464'; e.currentTarget.style.borderColor = 'rgba(255,100,100,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,100,100,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,100,100,0.2)'; }}
              >
                <SignOut size={12} /> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Avatar error */}
        {avatarError && (
          <div style={{ maxWidth: '520px', margin: '1rem auto', padding: '0 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF6464', fontSize: '0.75rem' }}>
              <Warning size={12} style={{ flexShrink: 0 }} />{avatarError}
              <button onClick={() => setAvatarError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={12} /></button>
            </div>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.75rem 0.5rem',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: activeTab === id ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                  borderBottom: activeTab === id ? '2px solid #4ECDC4' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'color 0.2s',
                }}
              >
                <Icon size={12} />
                {label}
                {id === 'notifications' && notifUnread > 0 && (
                  <span style={{ position: 'absolute', top: '8px', right: '8px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#4ECDC4', color: '#000', fontSize: '8px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ─────────────────────────────────────────── */}
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '1.5rem' }}>

          {/* ACCOUNT TAB */}
          {activeTab === 'account' && (
            <div style={cardDark}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={14} style={{ color: '#4ECDC4' }} />
                  <h2 style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#FFFFFF', margin: 0 }}>Account Details</h2>
                </div>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.3rem 0.7rem', background: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  >
                    <PencilSimple size={10} /> Edit
                  </button>
                )}
              </div>

              {editingProfile ? (
                <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <TextField
                      label="First Name" value={profileForm.firstName}
                      onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                      placeholder="Jane" autoComplete="given-name"
                      disabled={firstNameDaysLeft > 0}
                      hint={firstNameDaysLeft > 0 ? `Changeable again in ${firstNameDaysLeft} day${firstNameDaysLeft !== 1 ? 's' : ''}.` : null}
                    />
                    <TextField
                      label="Last Name" value={profileForm.lastName}
                      onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                      placeholder="Doe" autoComplete="family-name" required={false}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '0.25rem' }}>Email</p>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{user.email} <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>(cannot be changed)</span></p>
                  </div>
                  {profileError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF6464', fontSize: '0.75rem' }}>
                      <Warning size={12} style={{ flexShrink: 0 }} />{profileError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="btn-kefir"
                      style={{ opacity: profileLoading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <FloppyDisk size={12} />
                      {profileLoading ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={handleProfileCancel}
                      className="btn-kefir-outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {profileSuccess && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.2)', color: '#4ECDC4', fontSize: '0.75rem', marginBottom: '1rem' }}>
                      <CheckCircle size={12} style={{ flexShrink: 0 }} /> Profile updated.
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {[
                      { label: 'First Name', value: user.firstName || '—' },
                      { label: 'Last Name',  value: user.lastName  || '—' },
                      { label: 'Username',   value: user.username  || '—' },
                      { label: 'Email',      value: user.email },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '0.2rem' }}>{label}</p>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', wordBreak: 'break-all' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div style={cardDark}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Lock size={14} style={{ color: '#4ECDC4' }} />
                <h2 style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#FFFFFF', margin: 0 }}>Change Password</h2>
              </div>
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <PasswordField label="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" placeholder="Your current password" />
                <PasswordField label="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 chars" />
                <PasswordField label="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" placeholder="Repeat your new password" />
                {pwError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF6464', fontSize: '0.75rem' }}>
                    <Warning size={12} style={{ flexShrink: 0 }} />{pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.2)', color: '#4ECDC4', fontSize: '0.75rem' }}>
                    <CheckCircle size={12} style={{ flexShrink: 0 }} /> Password updated.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="btn-kefir"
                  style={{ opacity: pwLoading ? 0.6 : 1, marginTop: '0.25rem', width: '100%', justifyContent: 'center' }}
                >
                  {pwLoading ? 'Saving…' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div style={cardDark}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bell size={14} style={{ color: '#4ECDC4' }} />
                  <h2 style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#FFFFFF', margin: 0 }}>Notifications</h2>
                </div>
                {notifUnread > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ height: '48px', backgroundColor: '#1A1A1A', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '2.5rem 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
                  No notifications yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '400px', overflowY: 'auto' }}>
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.read) markRead(n.id); if (n.link) navigate(n.link); }}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: n.read ? '#0D0D0D' : 'rgba(78,205,196,0.05)',
                        border: `1px solid ${n.read ? 'rgba(255,255,255,0.05)' : 'rgba(78,205,196,0.15)'}`,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1A1A1A'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = n.read ? '#0D0D0D' : 'rgba(78,205,196,0.05)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.8rem', lineHeight: '1.4', color: n.read ? 'rgba(255,255,255,0.4)' : '#FFFFFF', fontWeight: n.read ? 400 : 600, margin: 0 }}>{n.title}</p>
                          {n.message && <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.2rem', lineHeight: '1.4' }}>{n.message}</p>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {!n.read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ECDC4' }} />}
                          <time style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
                            {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </time>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Profile;
