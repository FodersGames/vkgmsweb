import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import {
  User, Lock, SignOut, Eye, EyeSlash,
  CheckCircle, Warning, PencilSimple, X,
  FloppyDisk, SquaresFour, Camera, CircleNotch,
  Crown, ShieldCheck, Sparkle, GameController, Code,
  Terminal, Heart, Lightning, Flame, Trophy,
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';
const NAME_COOLDOWN_DAYS = 30;

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
const inputFocusDark = { borderColor: '#FF6600' };

const cardDark = {
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.06)',
  padding: '1.5rem',
};

/* ─── Role Icon Resolver ───────────────────────────────────────────────── */
const ROLE_ICON_MAP = {
  Crown,
  Shield: ShieldCheck,
  ShieldCheck,
  Sparkle,
  Sparkles: Sparkle,
  Gamepad2: GameController,
  GameController,
  Code,
  Terminal,
  Heart,
  Zap: Lightning,
  Lightning,
  Flame,
  Fire: Flame,
  Trophy,
  Award: Trophy,
};

const getRoleIcon = (iconName) => {
  return ROLE_ICON_MAP[iconName] || ShieldCheck;
};

/* ─── Sub-components ─────────────────────────────────────────────────── */
const PasswordField = ({ label, value, onChange, autoComplete, placeholder }) => {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <label style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
          {label}
        </label>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          style={{
            ...inputDark,
            paddingRight: '2.5rem',
            ...(focused ? inputFocusDark : {}),
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          style={{
            position: 'absolute', right: '0.75rem', top: '50%',
            transform: 'translateY(-50%)', background: 'none',
            border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', padding: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          {show ? <EyeSlash size={14} /> : <Eye size={14} />}
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

/* ─── Main Profile component ─────────────────────────────────────────── */
const Profile = () => {
  const { user, logout, updateProfile, changePassword, token, isAdmin, refreshUser, loading: authLoading } = useAuth();
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const navigate = useNavigate();

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', username: '' });
  const nameDaysLeft = user ? cooldownDaysLeft(user.nameChangedAt || user.firstNameChangedAt, NAME_COOLDOWN_DAYS) : 0;
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
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
    const currentName = user.name || (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '');
    setProfileForm({ name: currentName, username: user.username || '' });
  }, [user, authLoading, navigate]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);
    setProfileLoading(true);
    const result = await updateProfile({
      name: profileForm.name.trim(),
      username: profileForm.username.trim(),
    });
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
    const currentName = user?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '');
    setProfileForm({ name: currentName, username: user?.username || '' });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (!newPw || newPw.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match');
      return;
    }
    setPwLoading(true);
    const result = await changePassword({ currentPassword: currentPw, newPassword: newPw });
    setPwLoading(false);
    if (result.success) {
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => {
        setPwSuccess(false);
        setShowPasswordChange(false);
      }, 3000);
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
      setAvatarPreview(null);
    } catch {
      setAvatarError('Upload failed. Please try again.');
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  if (authLoading || !user) return null;

  const displayName = user.name || (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '') || user.username;
  const initials = (displayName[0] || user.username?.[0] || '?').toUpperCase();

  const customRoles = (user.roles || []).filter(r => !r.is_system);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav />

      <div style={{ flex: 1, paddingTop: '60px' }}>

        {/* ── Hero header ─────────────────────────────────────────── */}
        <div style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '3.5rem 1.5rem 2.5rem' }}>
          <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

            {/* Roles / Badges DISPLAYED ABOVE THE PROFILE PHOTO */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
              {user.is_super_admin && (
                <div
                  title="Super Admin"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 102, 0,0.12)',
                    border: '1px solid rgba(255, 102, 0,0.3)',
                    color: '#FF6600',
                    cursor: 'default',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Crown size={16} weight="bold" />
                </div>
              )}
              {!user.is_super_admin && (user.role === 'admin' || user.permissions?.includes('manage_users')) && (
                <div
                  title="Admin"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: '#3B82F6',
                    cursor: 'default',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <ShieldCheck size={16} weight="bold" />
                </div>
              )}
              {user.is_vakar_plus && (
                <div
                  title="Vakar+ Member"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    color: '#F59E0B',
                    cursor: 'default',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Sparkle size={16} weight="fill" />
                </div>
              )}
              {/* Custom roles badges: icon only, text on hover */}
              {customRoles.map(role => {
                const IconComponent = getRoleIcon(role.icon);
                return (
                  <div
                    key={role.id}
                    title={role.name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      backgroundColor: `${role.color}15`,
                      border: `1px solid ${role.color}40`,
                      color: role.color,
                      cursor: 'default',
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <IconComponent size={16} weight="bold" />
                  </div>
                );
              })}
            </div>

            {/* Avatar */}
            <div
              style={{ position: 'relative', cursor: 'pointer', marginBottom: '1.25rem' }}
              onClick={() => avatarInputRef.current?.click()}
              title="Change avatar"
            >
              <div style={{
                width: '86px', height: '86px',
                border: '2px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.75rem', fontWeight: 900, color: '#FF6600',
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
                  ? <CircleNotch size={18} className="animate-spin" style={{ color: '#FFFFFF' }} />
                  : <Camera size={18} style={{ color: '#FFFFFF' }} />
                }
              </div>
              <input ref={avatarInputRef} type="file" accept=".jpg,.jpeg,.png,.svg" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>

            {/* Display Name */}
            <h1 style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', fontSize: '1.5rem', color: '#FFFFFF', margin: 0, marginBottom: '0.25rem' }}>
              {displayName}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              @{user.username} • {user.email}
            </p>

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

        {/* ── Main Content ────────────────────────────────────────── */}
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 1. ACCOUNT DETAILS CARD */}
          <div style={cardDark}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={15} style={{ color: '#FF6600' }} />
                <h2 style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#FFFFFF', margin: 0 }}>
                  Account Details
                </h2>
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
                <TextField
                  label="Name"
                  value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your Name"
                  autoComplete="name"
                  disabled={nameDaysLeft > 0}
                  hint={nameDaysLeft > 0 ? `Changeable again in ${nameDaysLeft} day${nameDaysLeft !== 1 ? 's' : ''}.` : null}
                />
                <TextField
                  label="Pseudo (Username)"
                  value={profileForm.username}
                  onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="username"
                  autoComplete="username"
                />
                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '0.25rem' }}>Email</p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{user.email} <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>(cannot be changed)</span></p>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'rgba(255, 102, 0,0.08)', border: '1px solid rgba(255, 102, 0,0.2)', color: '#FF6600', fontSize: '0.75rem', marginBottom: '1rem' }}>
                    <CheckCircle size={12} style={{ flexShrink: 0 }} /> Profile updated.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'Name',     value: displayName },
                    { label: 'Username', value: user.username || '—' },
                    { label: 'Email',    value: user.email },
                    { label: 'Status',   value: user.is_super_admin ? 'Super Admin' : (user.role === 'admin' ? 'Admin' : 'Player') },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '0.2rem' }}>{label}</p>
                      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', wordBreak: 'break-all', margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 2. PASSWORD & SECURITY CARD (IN ACCOUNT DETAILS) */}
          <div style={cardDark}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPasswordChange ? '1.25rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={15} style={{ color: '#FF6600' }} />
                <div>
                  <h2 style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#FFFFFF', margin: 0 }}>
                    Password & Security
                  </h2>
                  {!showPasswordChange && (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', margin: 0, marginTop: '0.2rem' }}>
                      Keep your account secure by updating your password regularly.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowPasswordChange(s => !s); setPwError(''); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: showPasswordChange ? 'rgba(255,255,255,0.5)' : '#FF6600',
                  border: `1px solid ${showPasswordChange ? 'rgba(255,255,255,0.15)' : 'rgba(255, 102, 0,0.3)'}`,
                  padding: '0.35rem 0.75rem',
                  background: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginLeft: '0.75rem',
                }}
              >
                {showPasswordChange ? 'Cancel' : 'Change Password'}
              </button>
            </div>

            {showPasswordChange && (
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
                <PasswordField label="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" placeholder="Your current password" />
                <PasswordField label="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 chars" />
                <PasswordField label="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" placeholder="Repeat your new password" />
                {pwError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF6464', fontSize: '0.75rem' }}>
                    <Warning size={12} style={{ flexShrink: 0 }} />{pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'rgba(255, 102, 0,0.08)', border: '1px solid rgba(255, 102, 0,0.2)', color: '#FF6600', fontSize: '0.75rem' }}>
                    <CheckCircle size={12} style={{ flexShrink: 0 }} /> Password updated successfully.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="btn-kefir"
                  style={{ opacity: pwLoading ? 0.6 : 1, marginTop: '0.25rem', width: '100%', justifyContent: 'center' }}
                >
                  {pwLoading ? 'Updating…' : 'Save New Password'}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Profile;
