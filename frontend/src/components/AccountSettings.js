import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Save, CheckCircle, Trophy } from 'lucide-react';
import axios from 'axios';
import { Button, Card, CardHeader, CardBody, Input } from '../ui';

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
        { adjust_dollars: parseFloat(loyaltyAmt), reason: loyaltyReason || 'Manual adjustment' },
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
    <div className="max-w-lg space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 border border-brand-400/20 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-brand-400">
                {(user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400">@{user?.username} · {user?.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="First name" type="text" required maxLength={50} value={firstName} onChange={e => setFirstName(e.target.value)} />
              <Input label="Last name" type="text" required maxLength={50} value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div>
              <Input
                label="Username"
                type="text"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_]+"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-1">3–32 characters, letters, numbers and underscores only.</p>
            </div>
            {error && <p className="text-xs text-error-500">{error}</p>}
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" icon={Save} loading={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {success && (
                <span className="flex items-center gap-1.5 text-xs text-success-500 font-semibold">
                  <CheckCircle size={13} /> Saved!
                </span>
              )}
            </div>
          </form>
          <p className="text-xs text-gray-400 mt-5 pt-4 border-t border-gray-100">
            To change your email or password, go to your{' '}
            <a href="/profile" className="underline hover:text-gray-900 transition-colors">public profile</a>.
          </p>
        </CardBody>
      </Card>

      {canAdjustLoyalty && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F59E0B18' }}>
                <Trophy size={16} style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Loyalty Balance</h3>
                <p className="text-xs text-gray-400">Add or subtract loyalty spend from your account</p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleLoyalty} className="space-y-3">
              <div>
                <Input
                  label="Amount ($)"
                  type="number"
                  step="0.01"
                  required
                  value={loyaltyAmt}
                  onChange={e => setLoyaltyAmt(e.target.value)}
                  placeholder="e.g. 50 or -10"
                />
                <p className="text-[10px] text-gray-400 mt-1">Positive to add, negative to remove. Tiers: Bronze $0 · Silver $25 · Gold $100 · Diamond $250</p>
              </div>
              <Input
                label="Reason (optional)"
                type="text"
                maxLength={100}
                value={loyaltyReason}
                onChange={e => setLoyaltyReason(e.target.value)}
                placeholder="Test, correction, bonus…"
              />
              {loyaltyResult && (
                loyaltyResult.success ? (
                  <p className="text-xs font-semibold text-success-500">
                    ✓ Applied — {TIER_LABELS[loyaltyResult.previous_tier]} → {TIER_LABELS[loyaltyResult.new_tier]} (${(loyaltyResult.new_total_cents / 100).toFixed(2)} total)
                  </p>
                ) : (
                  <p className="text-xs text-error-500">{loyaltyResult.error}</p>
                )
              )}
              <Button type="submit" loading={loyaltySaving} disabled={!loyaltyAmt}>
                Apply adjustment
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
