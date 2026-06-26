import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Save, Loader2, CheckCircle, Trophy } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond' };

export const AccountSettings = () => {
  const { user, token, hasPermission } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [loyaltyAmt, setLoyaltyAmt] = useState('');
  const [loyaltyReason, setLoyaltyReason] = useState('');
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [loyaltyResult, setLoyaltyResult] = useState(null);

  const canAdjustLoyalty = user?.role === 'super_admin' || hasPermission('manage_users');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');
    try {
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

  const handleLoyalty = async (e) => {
    e.preventDefault();
    if (!loyaltyAmt) return;
    setLoyaltySaving(true);
    setLoyaltyResult(null);
    try {
      const r = await axios.patch(
        `${API_URL}/api/admin/users/${user.id}/loyalty`,
        { adjust_euros: parseFloat(loyaltyAmt), reason: loyaltyReason || 'Manual adjustment' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLoyaltyResult({ success: true, ...r.data });
      setLoyaltyAmt('');
      setLoyaltyReason('');
    } catch (err) {
      setLoyaltyResult({ success: false, error: err.response?.data?.detail || 'Failed.' });
    } finally {
      setLoyaltySaving(false);
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

      {/* Loyalty adjustment — admin only */}
      {canAdjustLoyalty && (
        <div className="bg-white border border-[#E8E3DB] p-6 mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-[#F59E0B]" />
            <h3 className="text-sm font-bold text-[#1C1917]">Loyalty Balance Adjustment</h3>
          </div>
          <p className="text-xs text-[#A8A29E] mb-4">Add or subtract loyalty spend (€) from your own account. Tier recalculates automatically.</p>

          <form onSubmit={handleLoyalty} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">Amount (€)</label>
              <input
                type="number"
                step="0.01"
                required
                value={loyaltyAmt}
                onChange={e => setLoyaltyAmt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                placeholder="e.g. 50 or -10"
              />
              <p className="text-[10px] text-[#A8A29E] mt-0.5">Positive to add, negative to remove. Tiers: Bronze 0€ · Silver 25€ · Gold 100€ · Diamond 250€</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">Reason (optional)</label>
              <input
                type="text"
                maxLength={100}
                value={loyaltyReason}
                onChange={e => setLoyaltyReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E8E3DB] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1C1917]"
                placeholder="Test, correction, bonus…"
              />
            </div>

            {loyaltyResult && (
              loyaltyResult.success ? (
                <p className="text-xs font-semibold text-[#22C55E]">
                  ✓ Applied — {TIER_LABELS[loyaltyResult.previous_tier]} → {TIER_LABELS[loyaltyResult.new_tier]} (€{(loyaltyResult.new_total_cents / 100).toFixed(2)} total)
                </p>
              ) : (
                <p className="text-xs text-red-500">{loyaltyResult.error}</p>
              )
            )}

            <button
              type="submit"
              disabled={loyaltySaving || !loyaltyAmt}
              className="flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loyaltySaving && <Loader2 size={13} className="animate-spin" />}
              Apply adjustment
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
