import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Save,
  Loader2,
  Lock,
  Camera,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  ArrowUpRight,
  Upload,
} from 'lucide-react';
import axios from 'axios';
import { SavedFlash, useSavedFlash } from '../ui';
import { API_URL } from '../utils/api';

const NAME_COOLDOWN_DAYS = 30;
const PSEUDO_COOLDOWN_DAYS = 7;

const cooldownDaysLeft = (changedAt, cooldownDays) => {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  const remaining = cooldownDays - Math.floor(elapsedMs / 86400000);
  return Math.max(0, remaining);
};

export const AccountSettings = () => {
  const { user, token, refreshUser, changePassword } = useAuth();
  const [name, setName] = useState(user?.name || user?.firstName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [success, flashSuccess] = useSavedFlash(3000);
  const [error, setError] = useState('');
  const nameDaysLeft = cooldownDaysLeft(user?.nameChangedAt || user?.firstNameChangedAt, NAME_COOLDOWN_DAYS);
  const pseudoDaysLeft = cooldownDaysLeft(user?.usernameChangedAt, PSEUDO_COOLDOWN_DAYS);

  // Avatar upload
  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await axios.patch(
        `${API_URL}/api/auth/profile`,
        { name, username },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      flashSuccess();
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    setAvatarSuccess(false);
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (!ALLOWED.includes(file.type)) {
      setAvatarError('Only JPG, PNG or SVG files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('File too large. Maximum size is 5 MB.');
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API_URL}/api/user/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      await refreshUser();
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (err) {
      setAvatarError(err.response?.data?.detail || 'Avatar upload failed.');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (!newPassword || newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    const res = await changePassword({ currentPassword, newPassword });
    setPwSaving(false);
    if (res.success) {
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPwSuccess(false);
        setShowPasswordChange(false);
      }, 3000);
    } else {
      setPwError(res.error || 'Failed to change password.');
    }
  };

  const initials = ((user?.name?.[0] || user?.firstName?.[0] || user?.username?.[0] || '?')).toUpperCase();

  return (
    <div className="max-w-2xl space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] text-[11px] font-semibold uppercase tracking-wider mb-2.5">
          <ShieldCheck size={13} />
          <span>Security & Identity</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
          Account Details
        </h1>
        <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-1">
          Manage your personal identity, studio credentials, and authentication security.
        </p>
      </div>

      {/* Hero Profile Summary Card */}
      <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left">
          {/* Avatar with hover upload trigger */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-[#F5F5F7] dark:bg-[#111118] border-2 border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-center overflow-hidden shadow-xs">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-[#FF6600]">{initials}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              title="Upload new avatar"
              className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {avatarUploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Camera size={20} />
                  <span className="text-[10px] font-medium mt-1">Change</span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.svg"
              className="hidden"
              onChange={handleAvatarFile}
            />
          </div>

          {/* User details */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-[#1D1D1F] dark:text-white truncate">
                {user?.name || user?.firstName || user?.username}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/25">
                {user?.is_super_admin ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Staff'}
              </span>
            </div>

            <p className="text-xs text-[#86868B] dark:text-[#a1a1aa] font-mono">
              @{user?.username}
            </p>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">
              {user?.email}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#F5F5F7] dark:bg-[#1f1f2e] text-[#1D1D1F] dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#28283c] transition-colors"
              >
                <Upload size={12} />
                <span>Upload Photo</span>
              </button>

              {avatarSuccess && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check size={13} />
                  <span>Avatar updated!</span>
                </span>
              )}

              {avatarError && (
                <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
                  <AlertCircle size={13} />
                  <span>{avatarError}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form Card */}
      <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 pb-5 mb-6 border-b border-[#E5E5EA] dark:border-[#2a2a3c]">
          <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] dark:bg-[#111118] text-[#1D1D1F] dark:text-white flex items-center justify-center">
            <User size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white">
              Personal Information
            </h3>
            <p className="text-xs text-[#86868B] dark:text-[#a1a1aa]">
              Update your public display name and studio nickname.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Display Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">
                Display Name
              </label>
              {nameDaysLeft > 0 && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Locked for {nameDaysLeft} day{nameDaysLeft !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              maxLength={70}
              value={name}
              disabled={nameDaysLeft > 0}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#111118] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              placeholder="Your display name"
            />
            <p className="text-[11px] text-[#86868B] dark:text-[#71717a] mt-1.5">
              Your publicly visible identity across game chats and the studio board.
            </p>
          </div>

          {/* Username / Pseudo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">
                Username (Handle)
              </label>
              {pseudoDaysLeft > 0 && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Locked for {pseudoDaysLeft} day{pseudoDaysLeft !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#86868B]">
                @
              </span>
              <input
                type="text"
                required
                minLength={5}
                maxLength={14}
                pattern="[a-zA-Z0-9_]+"
                value={username}
                disabled={pseudoDaysLeft > 0}
                onChange={e => setUsername(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#111118] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono"
              />
            </div>
            <p className="text-[11px] text-[#86868B] dark:text-[#71717a] mt-1.5">
              5 to 14 alphanumeric characters and underscores only.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#1D1D1F] dark:bg-white hover:bg-[#3A3A3C] dark:hover:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Saving changes…' : 'Save changes'}</span>
            </button>
            <SavedFlash show={success} label="Saved successfully!" />
          </div>
        </form>
      </div>

      {/* Password & Security Card */}
      <div className="rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center text-[#FF6600]">
              <Lock size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white">
                Password & Security
              </h3>
              <p className="text-xs text-[#86868B] dark:text-[#a1a1aa]">
                Update your administrative account login credentials.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowPasswordChange(s => !s); setPwError(''); }}
            className="self-start sm:self-auto text-xs font-semibold px-4 py-2 rounded-full border border-[#E5E5EA] dark:border-[#2a2a3c] hover:border-[#FF6600] text-[#1D1D1F] dark:text-white hover:text-[#FF6600] transition-colors"
          >
            {showPasswordChange ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {showPasswordChange && (
          <form onSubmit={handlePasswordSubmit} className="mt-6 pt-6 border-t border-[#E5E5EA] dark:border-[#2a2a3c] space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 text-sm rounded-xl border border-[#E5E5EA] dark:border-[#2a2a3c] focus:outline-none focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 bg-[#F5F5F7] dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7] transition-all"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                >
                  {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 text-sm rounded-xl border border-[#E5E5EA] dark:border-[#2a2a3c] focus:outline-none focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 bg-[#F5F5F7] dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7] transition-all"
                  placeholder="Minimum 8 characters"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNewPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                >
                  {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#E5E5EA] dark:border-[#2a2a3c] focus:outline-none focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 bg-[#F5F5F7] dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7] transition-all"
                placeholder="Repeat new password"
              />
            </div>

            {pwError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                <AlertCircle size={14} className="shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <Check size={14} className="shrink-0" />
                <span>Password updated successfully!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwSaving}
              className="inline-flex items-center justify-center gap-2 bg-[#FF6600] hover:bg-[#E05A00] text-white font-semibold px-5 py-2.5 rounded-full text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              {pwSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{pwSaving ? 'Updating password…' : 'Update Password'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Public Profile Link Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-between gap-4 text-xs text-[#6E6E73] dark:text-[#a1a1aa] shadow-xs">
        <div>
          <span className="font-medium text-[#1D1D1F] dark:text-white">Public Player Profile</span>
          <p className="text-[11px] text-[#86868B] dark:text-[#71717a] mt-0.5">
            Preview how your avatar, stats, and achievements appear to visitors.
          </p>
        </div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#1f1f2e] text-[#1D1D1F] dark:text-white hover:bg-[#FF6600] hover:text-white text-xs font-medium transition-all shrink-0"
        >
          <span>Open Profile</span>
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
};
