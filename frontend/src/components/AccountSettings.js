import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Save, Loader2, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AccountSettings = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_URL}/api/auth/profile`,
        { firstName, lastName, username },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-black text-[#1C1917] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>MY ACCOUNT</h2>
      <p className="text-xs text-[#A8A29E] mb-8">Update your display name and username.</p>

      <div className="bg-white border border-[#E8E3DB] p-6">
        <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#E8E3DB]">
          <div className="w-10 h-10 bg-[#F9F7F4] border border-[#E8E3DB] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#78716C]">
              {(user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1C1917]">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-[#A8A29E]">@{user?.username} · {user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">First name</label>
              <input
                type="text"
                required
                maxLength={50}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">Last name</label>
              <input
                type="text"
                required
                maxLength={50}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">Username</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_]+"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
            />
            <p className="text-[10px] text-[#A8A29E] mt-1">3–32 characters, letters, numbers and underscores only.</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {success && (
              <span className="flex items-center gap-1.5 text-xs text-[#22C55E] font-semibold">
                <CheckCircle size={13} /> Saved!
              </span>
            )}
          </div>
        </form>
      </div>

      <p className="text-xs text-[#A8A29E] mt-4">
        To change your email or password, go to your{' '}
        <a href="/profile" className="underline hover:text-[#1C1917] transition-colors">public profile</a>.
      </p>
    </div>
  );
};
