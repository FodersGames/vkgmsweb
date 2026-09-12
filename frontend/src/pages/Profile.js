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

const PasswordField = ({ label, value, onChange, autoComplete, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 bg-white border border-[#D2D2D7] rounded-lg text-[#1D1D1F] text-sm focus:outline-none focus:border-[#1D1D1F] transition-colors pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(s => !s)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
        >
          {show ? <EyeSlash size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
};

const TextField = ({ label, value, onChange, placeholder, autoComplete, required = true, disabled = false, hint }) => {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
        {label} {!required && <span className="text-[#86868B] font-normal">(optional)</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 bg-white border border-[#D2D2D7] rounded-lg text-[#1D1D1F] text-sm focus:outline-none focus:border-[#1D1D1F] transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed bg-[#E5E5EA]' : ''
        }`}
      />
      {hint && <p className="mt-1 text-[11px] text-[#86868B]">{hint}</p>}
    </div>
  );
};

const cooldownDaysLeft = (changedAt, cooldownDays) => {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  const remaining = cooldownDays - Math.floor(elapsedMs / 86400000);
  return Math.max(0, remaining);
};

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
    <div className="bg-white text-[#1D1D1F] min-h-screen flex flex-col">
      <PublicNav />

      <div className="flex-1 pt-14">
        {/* Hero Header */}
        <div className="bg-[#F5F5F7] border-b border-[#E5E5EA] py-16 px-6">
          <div className="max-w-xl mx-auto flex flex-col items-center text-center">

            {/* Badges */}
            <div className="flex items-center gap-2 justify-center mb-4 flex-wrap">
              {user.is_super_admin && (
                <div
                  title="Super Admin"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#D2D2D7] text-[#FF6600] shadow-sm"
                >
                  <Crown size={16} weight="bold" />
                </div>
              )}
              {!user.is_super_admin && (user.role === 'admin' || user.permissions?.includes('manage_users')) && (
                <div
                  title="Admin"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#D2D2D7] text-blue-600 shadow-sm"
                >
                  <ShieldCheck size={16} weight="bold" />
                </div>
              )}
              {user.is_vakar_plus && (
                <div
                  title="Vakar+ Member"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#D2D2D7] text-amber-500 shadow-sm"
                >
                  <Sparkle size={16} weight="fill" />
                </div>
              )}
              {customRoles.map(role => {
                const IconComponent = getRoleIcon(role.icon);
                return (
                  <div
                    key={role.id}
                    title={role.name}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#D2D2D7] shadow-sm"
                    style={{ color: role.color }}
                  >
                    <IconComponent size={16} weight="bold" />
                  </div>
                );
              })}
            </div>

            {/* Avatar */}
            <div
              className="relative cursor-pointer mb-4 group"
              onClick={() => avatarInputRef.current?.click()}
              title="Change avatar"
            >
              <div className="w-24 h-24 rounded-full border-2 border-white shadow-md flex items-center justify-center text-2xl font-bold text-[#FF6600] bg-white overflow-hidden">
                {avatarPreview || user.avatar_url ? (
                  <img
                    src={avatarPreview || (user.avatar_url?.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url)}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : initials}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading
                  ? <CircleNotch size={20} className="animate-spin text-white" />
                  : <Camera size={20} className="text-white" />
                }
              </div>
              <input ref={avatarInputRef} type="file" accept=".jpg,.jpeg,.png,.svg" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Display Name */}
            <h1 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">
              {displayName}
            </h1>
            <p className="text-sm text-[#6E6E73] mt-0.5">
              @{user.username} · {user.email}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-5 flex-wrap justify-center">
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D1D1F] bg-white border border-[#D2D2D7] rounded-lg px-3.5 py-1.5 hover:border-[#1D1D1F] transition-colors"
                >
                  <SquaresFour size={13} /> Dashboard
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg px-3.5 py-1.5 hover:border-red-400 transition-colors"
              >
                <SignOut size={13} /> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Avatar error */}
        {avatarError && (
          <div className="max-w-xl mx-auto px-6 mt-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              <Warning size={14} className="shrink-0" />
              <span>{avatarError}</span>
              <button onClick={() => setAvatarError('')} className="ml-auto text-red-700"><X size={14} /></button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-xl mx-auto px-6 py-10 space-y-6">

          {/* Account Details Card */}
          <div className="bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA] p-7">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <User size={18} className="text-[#FF6600]" />
                <h2 className="font-semibold text-base text-[#1D1D1F]">
                  Account Details
                </h2>
              </div>
              {!editingProfile && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6E73] bg-white border border-[#D2D2D7] rounded-md px-3 py-1 hover:text-[#1D1D1F] hover:border-[#1D1D1F] transition-colors"
                >
                  <PencilSimple size={12} /> Edit
                </button>
              )}
            </div>

            {editingProfile ? (
              <form onSubmit={handleProfileSave} className="space-y-4">
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
                  <p className="text-xs font-medium text-[#6E6E73] mb-1">Email</p>
                  <p className="text-sm text-[#1D1D1F]">{user.email} <span className="text-xs text-[#86868B]">(cannot be changed)</span></p>
                </div>
                {profileError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                    <Warning size={14} className="shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="btn-apple text-xs"
                  >
                    <FloppyDisk size={14} className="mr-1.5" />
                    {profileLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleProfileCancel}
                    className="btn-apple-outline text-xs"
                  >
                    <X size={14} className="mr-1.5" /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {profileSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg mb-4">
                    <CheckCircle size={14} className="shrink-0" /> Profile updated successfully.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: 'Name',     value: displayName },
                    { label: 'Username', value: user.username || '—' },
                    { label: 'Email',    value: user.email },
                    { label: 'Status',   value: user.is_super_admin ? 'Super Admin' : (user.role === 'admin' ? 'Admin' : 'Player') },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs font-medium text-[#86868B] mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-[#1D1D1F] break-all">{value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Password & Security Card */}
          <div className="bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA] p-7">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Lock size={18} className="text-[#FF6600]" />
                <div>
                  <h2 className="font-semibold text-base text-[#1D1D1F]">
                    Password & Security
                  </h2>
                  {!showPasswordChange && (
                    <p className="text-xs text-[#6E6E73] mt-0.5">
                      Keep your account secure by updating your password regularly.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowPasswordChange(s => !s); setPwError(''); }}
                className="text-xs font-medium text-[#1D1D1F] bg-white border border-[#D2D2D7] rounded-md px-3 py-1 hover:border-[#1D1D1F] transition-colors shrink-0 ml-4"
              >
                {showPasswordChange ? 'Cancel' : 'Change Password'}
              </button>
            </div>

            {showPasswordChange && (
              <form onSubmit={handlePasswordChange} className="space-y-4 pt-2">
                <PasswordField label="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" placeholder="Your current password" />
                <PasswordField label="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 chars" />
                <PasswordField label="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" placeholder="Repeat your new password" />
                {pwError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                    <Warning size={14} className="shrink-0" />
                    <span>{pwError}</span>
                  </div>
                )}
                {pwSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">
                    <CheckCircle size={14} className="shrink-0" /> Password updated successfully.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="btn-apple w-full text-xs !py-2.5"
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
