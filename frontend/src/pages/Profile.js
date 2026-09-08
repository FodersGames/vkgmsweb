import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import {
  User, Lock, SignOut, Ticket, Eye, EyeSlash,
  CheckCircle, Warning, PencilSimple, X,
  FloppyDisk, SquaresFour, Camera, CircleNotch,
  PaperPlaneTilt, CaretDown, CaretUp, ArrowSquareOut,
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

const TABS = [
  { id: 'account',  label: 'Account',  icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'tickets',  label: 'Tickets',  icon: Ticket },
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

  const [tickets, setTickets] = useState([]);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [ticketReply, setTicketReply] = useState('');
  const [sendingTicketReply, setSendingTicketReply] = useState(false);
  const [ticketReplyError, setTicketReplyError] = useState('');

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

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setTicketsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/tickets/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.data.tickets || [];
      setTickets(list);
      setOpenTicketsCount(res.data.open_count ?? list.filter(t => t.status !== 'closed').length);
    } catch {
      // silent
    } finally {
      setTicketsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    document.title = 'My Account — Vakar Games';
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    setProfileForm({ firstName: user.firstName || '', lastName: user.lastName || '', username: user.username || '' });
    fetchTickets();
  }, [user, authLoading, fetchTickets]);

  const handleTicketReply = async (e, ticketNumber) => {
    e.preventDefault();
    if (!ticketReply.trim() || !token) return;
    setSendingTicketReply(true);
    setTicketReplyError('');
    try {
      await axios.post(`${API_URL}/api/tickets/${ticketNumber}/reply`, { content: ticketReply }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTicketReply('');
      const r = await axios.get(`${API_URL}/api/tickets/${ticketNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExpandedTicket(r.data.ticket);
      fetchTickets();
    } catch (err) {
      setTicketReplyError(err.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSendingTicketReply(false);
    }
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
                {id === 'tickets' && openTicketsCount > 0 && (
                  <span style={{ position: 'absolute', top: '8px', right: '6px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#4ECDC4', color: '#000', fontSize: '8px', fontWeight: 900 }}>
                    {openTicketsCount}/5
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

          {/* TICKETS TAB */}
          {activeTab === 'tickets' && (
            <div style={cardDark}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Ticket size={14} style={{ color: '#4ECDC4' }} />
                  <h2 style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#FFFFFF', margin: 0 }}>
                    Mes Tickets ({openTicketsCount}/5 ouverts)
                  </h2>
                </div>
                <Link
                  to="/contact"
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: openTicketsCount >= 5 ? 'rgba(255,255,255,0.25)' : '#4ECDC4',
                    pointerEvents: openTicketsCount >= 5 ? 'none' : 'auto',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <PaperPlaneTilt size={11} />
                  Nouveau ticket
                </Link>
              </div>

              {openTicketsCount >= 5 && (
                <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#F87171', fontSize: '0.75rem', fontWeight: 600 }}>
                  Ticket ouvert maximum atteint (5/5). Vous avez atteint la limite de 5 tickets ouverts simultanés.
                </div>
              )}

              {ticketsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ height: '48px', backgroundColor: '#1A1A1A', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ padding: '2.5rem 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                  <p style={{ margin: '0 0 1rem' }}>Vous n'avez aucun ticket de support pour le moment.</p>
                  <Link to="/contact" className="btn-kefir" style={{ display: 'inline-flex', fontSize: '0.7rem', padding: '0.5rem 1rem' }}>
                    Ouvrir un ticket
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tickets.map(t => {
                    const isOpen = expandedTicket?.ticket_number === t.ticket_number;
                    const isClosed = t.status === 'closed';
                    const activeTicketObj = isOpen ? (expandedTicket || t) : t;
                    const statusColor = t.status === 'open' ? '#4ECDC4' : t.status === 'in_progress' ? '#F59E0B' : '#6E6E73';
                    const statusLabel = t.status === 'open' ? 'Ouvert' : t.status === 'in_progress' ? 'En cours' : 'Fermé';

                    return (
                      <div
                        key={t.id || t.ticket_number}
                        style={{
                          backgroundColor: '#0D0D0D',
                          border: `1px solid ${isOpen ? 'rgba(78,205,196,0.3)' : 'rgba(255,255,255,0.06)'}`,
                          transition: 'border-color 0.2s',
                        }}
                      >
                        <div
                          onClick={() => {
                            if (isOpen) {
                              setExpandedTicket(null);
                            } else {
                              setExpandedTicket(t);
                            }
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700, color: '#4ECDC4' }}>{t.ticket_number}</span>
                              <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>• {t.category}</span>
                              <span style={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: `${statusColor}18`,
                                color: statusColor,
                                marginLeft: 'auto',
                                marginRight: '0.5rem',
                              }}>
                                {statusLabel}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.subject}
                            </p>
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.3)', paddingLeft: '0.5rem' }}>
                            {isOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
                          </div>
                        </div>

                        {isOpen && (
                          <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.25rem', paddingTop: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '240px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                              {(activeTicketObj.messages || []).map((m, i) => {
                                const isUser = m.sender === 'user';
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      padding: '0.6rem 0.8rem',
                                      backgroundColor: isUser ? '#141414' : 'rgba(78,205,196,0.08)',
                                      border: `1px solid ${isUser ? 'rgba(255,255,255,0.06)' : 'rgba(78,205,196,0.2)'}`,
                                      alignSelf: isUser ? 'flex-start' : 'flex-end',
                                      maxWidth: '90%',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isUser ? '#FFFFFF' : '#4ECDC4' }}>
                                        {m.author_name || (isUser ? 'Vous' : 'Support')}
                                      </span>
                                      <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)' }}>
                                        {m.timestamp ? new Date(m.timestamp).toLocaleDateString() : ''}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                      {m.content}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>

                            {!isClosed ? (
                              <form onSubmit={(e) => handleTicketReply(e, t.ticket_number)} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <textarea
                                  rows={2}
                                  value={ticketReply}
                                  onChange={e => setTicketReply(e.target.value)}
                                  placeholder="Répondre à ce ticket..."
                                  style={{ ...inputDark, fontSize: '0.75rem', resize: 'none' }}
                                />
                                {ticketReplyError && <p style={{ fontSize: '0.65rem', color: '#F87171', margin: 0 }}>{ticketReplyError}</p>}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    type="submit"
                                    disabled={sendingTicketReply || !ticketReply.trim()}
                                    className="btn-kefir"
                                    style={{ fontSize: '0.65rem', padding: '0.4rem 0.8rem', opacity: (sendingTicketReply || !ticketReply.trim()) ? 0.5 : 1 }}
                                  >
                                    {sendingTicketReply ? 'Envoi...' : 'Envoyer la réponse'}
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', margin: 0, textAlign: 'center', fontStyle: 'italic' }}>
                                Ce ticket est résolu / fermé.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
