import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Save, Loader2 } from 'lucide-react';
import axios from 'axios';
import { SavedFlash, useSavedFlash } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const NAME_COOLDOWN_DAYS = 30;
const PSEUDO_COOLDOWN_DAYS = 7;

const cooldownDaysLeft = (changedAt, cooldownDays) => {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  const remaining = cooldownDays - Math.floor(elapsedMs / 86400000);
  return Math.max(0, remaining);
};

export const AccountSettings = () => {
  const { user, token, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || user?.firstName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [success, flashSuccess] = useSavedFlash(3000);
  const [error, setError] = useState('');
  const nameDaysLeft = cooldownDaysLeft(user?.nameChangedAt || user?.firstNameChangedAt, NAME_COOLDOWN_DAYS);
  const pseudoDaysLeft = cooldownDaysLeft(user?.usernameChangedAt, PSEUDO_COOLDOWN_DAYS);

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
      refreshUser();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = ((user?.name?.[0] || user?.firstName?.[0] || user?.username?.[0] || '?')).toUpperCase();

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1">MY ACCOUNT</h2>
      <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] mb-8">Update your display name and pseudo.</p>

      <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6">
        <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
          <div className="rounded-lg w-10 h-10 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#6E6E73] dark:text-[#a1a1aa]">
              {initials}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{user?.name || user?.firstName || user?.username}</p>
            <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">@{user?.username} · {user?.email}</p>
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

      <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] mt-4">
        To change your email or password, go to your{' '}
        <a href="/profile" className="underline hover:text-[#1D1D1F] dark:hover:text-white transition-colors">public profile</a>.
      </p>
    </div>
  );
};
