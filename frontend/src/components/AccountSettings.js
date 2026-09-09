import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Save, Loader2, Lock, Camera, Check, AlertCircle, Eye, EyeSlash } from 'lucide-react';
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
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1">ACCOUNT DETAILS</h2>
        <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Manage your profile info, profile photo and password.</p>
      </div>

      {/* Profile info card */}
      <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6">
        <div className="flex items-center gap-4 pb-5 mb-6 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
          <div className="relative group">
            <div className="rounded-xl w-14 h-14 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-[#6E6E73] dark:text-[#a1a1aa]">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              title="Change profile photo"
              className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {avatarUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.svg"
              className="hidden"
              onChange={handleAvatarFile}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{user?.name || user?.firstName || user?.username}</p>
            <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] truncate">@{user?.username} · {user?.email}</p>
            {avatarSuccess && <p className="text-xs text-emerald-500 font-medium mt-1">Photo updated!</p>}
            {avatarError && <p className="text-xs text-red-500 font-medium mt-1">{avatarError}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1.5">Name</label>
            <input
              type="text"
              required
              maxLength={70}
              value={name}
              disabled={nameDaysLeft > 0}
              onChange={e => setName(e.target.value)}
              className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7] disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Your display name"
            />
            {nameDaysLeft > 0 && (
              <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-1">Changeable again in {nameDaysLeft} day{nameDaysLeft !== 1 ? 's' : ''}.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1.5">Pseudo</label>
            <input
              type="text"
              required
              minLength={5}
              maxLength={14}
              pattern="[a-zA-Z0-9_]+"
              value={username}
              disabled={pseudoDaysLeft > 0}
              onChange={e => setUsername(e.target.value)}
              className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] mt-1">
              {pseudoDaysLeft > 0 ? `Changeable again in ${pseudoDaysLeft} day${pseudoDaysLeft !== 1 ? 's' : ''}.` : '5–14 characters, letters, numbers and underscores only.'}
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full flex items-center gap-2 bg-[#1D1D1F] dark:bg-[#e4e4e7] hover:bg-[#3A3A3C] dark:hover:bg-white text-white dark:text-[#0e0e15] px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <SavedFlash show={success} label="Saved!" />
          </div>
        </form>
      </div>

      {/* Password & Security Card */}
      <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg w-9 h-9 bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 flex items-center justify-center text-[#4ECDC4]">
              <Lock size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Password & Security</p>
              <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Update your admin account password.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowPasswordChange(s => !s); setPwError(''); }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4] text-[#1D1D1F] dark:text-[#e4e4e7] hover:text-[#4ECDC4] transition-colors"
          >
            {showPasswordChange ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {showPasswordChange && (
          <form onSubmit={handlePasswordSubmit} className="mt-5 pt-5 border-t border-[#D2D2D7] dark:border-[#2a2a3c] space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="rounded-lg w-full pl-3 pr-9 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                  placeholder="Your current password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white"
                >
                  {showCurrentPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="rounded-lg w-full pl-3 pr-9 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNewPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white"
                >
                  {showNewPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#151520] text-[#1D1D1F] dark:text-[#e4e4e7]"
                placeholder="Repeat new password"
              />
            </div>

            {pwError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                <AlertCircle size={14} className="shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium">
                <Check size={14} className="shrink-0" />
                <span>Password updated successfully!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-lg flex items-center justify-center gap-2 bg-[#4ECDC4] hover:bg-[#3db8af] text-[#0D0D0D] font-bold px-4 py-2 text-xs transition-colors disabled:opacity-50"
            >
              {pwSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">
        View your public gaming profile on{' '}
        <Link to="/profile" className="underline hover:text-[#1D1D1F] dark:hover:text-white transition-colors">
          Public Profile
        </Link>.
      </p>
    </div>
  );
};

