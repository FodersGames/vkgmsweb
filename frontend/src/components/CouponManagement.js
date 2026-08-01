import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Tag, Plus, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, Users, Gamepad2, ShoppingBag } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TIERS = ['bronze', 'silver', 'gold', 'diamond'];
const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond' };

const initialForm = {
  name: '',
  target_type: 'tier',
  target_tiers: [],
  target_user_ids: [],
  discount_pct: 10,
  valid_days: 30,
  scope: 'all',
  scope_id: '',
  scope_name: '',
};

export const CouponManagement = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [createError, setCreateError] = useState('');
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // For user targeting
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  // For scope selectors
  const [games, setGames] = useState([]);
  const [products, setProducts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/admin/coupons/campaigns`, { headers });
      setCampaigns(r.data.campaigns || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showCreate) return;
    axios.get(`${API_URL}/api/website/games`, { headers }).then(r => setGames(r.data.games || [])).catch(() => {});
    axios.get(`${API_URL}/api/shop/products`, { headers }).then(r => setProducts(r.data.products || [])).catch(() => {});
    axios.get(`${API_URL}/api/admin/users`, { headers }).then(r => setUsers(r.data.users || [])).catch(() => {});
  }, [showCreate, token]);

  const toggleTier = (tier) => {
    setForm(f => ({
      ...f,
      target_tiers: f.target_tiers.includes(tier)
        ? f.target_tiers.filter(t => t !== tier)
        : [...f.target_tiers, tier],
    }));
  };

  const toggleUser = (id) => {
    setForm(f => ({
      ...f,
      target_user_ids: f.target_user_ids.includes(id)
        ? f.target_user_ids.filter(u => u !== id)
        : [...f.target_user_ids, id],
    }));
  };

  const filteredUsers = users.filter(u =>
    !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleScopeChange = (scope) => {
    setForm(f => ({ ...f, scope, scope_id: '', scope_name: '' }));
  };

  const handleCreate = async () => {
    setCreateError('');
    setCreateResult(null);
    if (!form.name.trim()) { setCreateError('Campaign name is required.'); return; }
    if (form.target_type === 'tier' && form.target_tiers.length === 0) { setCreateError('Select at least one tier.'); return; }
    if (form.target_type === 'users' && form.target_user_ids.length === 0) { setCreateError('Select at least one user.'); return; }
    if (form.scope !== 'all' && !form.scope_id) { setCreateError('Select a specific product or game for the scope.'); return; }

    setCreating(true);
    try {
      const r = await axios.post(`${API_URL}/api/admin/coupons/campaign`, form, { headers });
      setCreateResult(r.data);
      setForm(initialForm);
      load();
    } catch (e) {
      setCreateError(e.response?.data?.detail || 'Failed to create campaign.');
    } finally {
      setCreating(false);
    }
  };

  const loadDetail = async (campaignId) => {
    if (expandedCampaign === campaignId) { setExpandedCampaign(null); setCampaignDetail(null); return; }
    setExpandedCampaign(campaignId);
    setCampaignDetail(null);
    setDetailLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/admin/coupons/campaign/${campaignId}`, { headers });
      setCampaignDetail(r.data);
    } catch { /* silent */ } finally {
      setDetailLoading(false);
    }
  };

  const scopeIcon = (scope) => {
    if (scope === 'game') return <Gamepad2 size={12} className="inline mr-1" />;
    if (scope === 'product') return <ShoppingBag size={12} className="inline mr-1" />;
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg w-8 h-8 bg-[#4ECDC4]/10 flex items-center justify-center">
            <Tag size={16} className="text-[#4ECDC4]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1D1D1F]">
              Promo Coupons
            </h2>
            <p className="text-xs text-[#6E6E73]">Send unique discount codes to users or tiers</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setCreateResult(null); setCreateError(''); }}
          className="rounded-full flex items-center gap-1.5 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white text-xs font-semibold px-3 py-2 transition-colors"
        >
          <Plus size={13} /> New campaign
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl bg-white border border-[#D2D2D7] p-6 space-y-5">
          <h3 className="text-sm font-bold text-[#1D1D1F] border-b border-[#D2D2D7] pb-3">Create coupon campaign</h3>

          {createResult ? (
            <div className="text-center py-6 space-y-2">
              <CheckCircle size={32} className="text-[#4ECDC4] mx-auto" />
              <p className="text-sm font-bold text-[#1D1D1F]">Campaign created!</p>
              <p className="text-xs text-[#6E6E73]"><strong>{createResult.codes_sent}</strong> unique codes sent to users' inboxes.</p>
              <button onClick={() => { setShowCreate(false); setCreateResult(null); }} className="text-xs text-[#4ECDC4] hover:underline mt-2">Close</button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] mb-1">Campaign name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Summer promo, Gold exclusive…"
                  className="w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                />
              </div>

              {/* Discount & validity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[#A1A1A6] mb-1">Discount %</label>
                  <input
                    type="number" min={1} max={99}
                    value={form.discount_pct}
                    onChange={e => setForm(f => ({ ...f, discount_pct: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#A1A1A6] mb-1">Valid for (days)</label>
                  <input
                    type="number" min={1}
                    value={form.valid_days}
                    onChange={e => setForm(f => ({ ...f, valid_days: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                  />
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] mb-2">Applicable to</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'all', label: 'All purchases' },
                    { value: 'product', label: 'Specific product' },
                    { value: 'game', label: 'Specific game' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleScopeChange(opt.value)}
                      className={`text-xs px-3 py-1.5 border font-semibold transition-colors ${form.scope === opt.value ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#1D1D1F]' : 'border-[#D2D2D7] text-[#6E6E73] hover:border-[#BFBFC4]'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.scope === 'product' && (
                  <select
                    className="mt-2 w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                    value={form.scope_id}
                    onChange={e => {
                      const p = products.find(x => x.id === e.target.value);
                      setForm(f => ({ ...f, scope_id: e.target.value, scope_name: p?.name || '' }));
                    }}
                  >
                    <option value="">— Select a product —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                {form.scope === 'game' && (
                  <select
                    className="mt-2 w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                    value={form.scope_id}
                    onChange={e => {
                      const g = games.find(x => x.slug === e.target.value);
                      setForm(f => ({ ...f, scope_id: e.target.value, scope_name: g?.name || '' }));
                    }}
                  >
                    <option value="">— Select a game —</option>
                    {games.map(g => (
                      <option key={g.slug} value={g.slug}>{g.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target */}
              <div>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] mb-2">Target</label>
                <div className="flex gap-2 mb-3">
                  {[
                    { value: 'tier', label: 'By loyalty tier', icon: <Tag size={12} /> },
                    { value: 'users', label: 'Specific users', icon: <Users size={12} /> },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, target_type: opt.value, target_tiers: [], target_user_ids: [] }))}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border font-semibold transition-colors ${form.target_type === opt.value ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#1D1D1F]' : 'border-[#D2D2D7] text-[#6E6E73] hover:border-[#BFBFC4]'}`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>

                {form.target_type === 'tier' && (
                  <div className="flex gap-2 flex-wrap">
                    {TIERS.map(tier => (
                      <button
                        key={tier}
                        onClick={() => toggleTier(tier)}
                        className={`text-xs px-3 py-1.5 border font-semibold capitalize transition-colors ${form.target_tiers.includes(tier) ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#1D1D1F]' : 'border-[#D2D2D7] text-[#6E6E73] hover:border-[#BFBFC4]'}`}
                      >
                        {TIER_LABELS[tier]}
                        {form.target_tiers.includes(tier) && <CheckCircle size={10} className="inline ml-1 text-[#4ECDC4]" />}
                      </button>
                    ))}
                  </div>
                )}

                {form.target_type === 'users' && (
                  <div className="space-y-2">
                    <input
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search by email or username…"
                      className="w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                    />
                    <div className="max-h-40 overflow-y-auto border border-[#D2D2D7] divide-y divide-[#F3F0EC]">
                      {filteredUsers.slice(0, 50).map(u => (
                        <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#F5F5F7] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.target_user_ids.includes(u.id)}
                            onChange={() => toggleUser(u.id)}
                            className="accent-[#4ECDC4]"
                          />
                          <span className="text-xs text-[#1D1D1F] truncate">{u.email}</span>
                          {u.username && <span className="text-[10px] text-[#A1A1A6]">@{u.username}</span>}
                        </label>
                      ))}
                      {filteredUsers.length === 0 && <p className="text-xs text-[#A1A1A6] p-3">No users found</p>}
                    </div>
                    {form.target_user_ids.length > 0 && (
                      <p className="text-xs text-[#4ECDC4] font-semibold">{form.target_user_ids.length} user(s) selected</p>
                    )}
                  </div>
                )}
              </div>

              {createError && <p className="text-xs text-red-500">{createError}</p>}

              <div className="flex gap-2 pt-2 border-t border-[#D2D2D7]">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="rounded-full flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white text-sm font-semibold px-5 py-2.5 transition-colors disabled:opacity-50"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
                  {creating ? 'Creating…' : 'Send coupons'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-sm text-[#6E6E73] hover:text-[#1D1D1F] px-4 py-2.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className="text-center py-10 text-[#A1A1A6] text-sm">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[#D2D2D7] text-[#A1A1A6] text-sm">
          No campaigns yet. Create one to start sending promo codes.
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => (
            <div key={c.id} className="rounded-xl bg-white border border-[#D2D2D7]">
              <button
                onClick={() => loadDetail(c.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F5F5F7] transition-colors text-left"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Tag size={16} className="text-[#4ECDC4] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1D1D1F] truncate">{c.name}</p>
                    <p className="text-xs text-[#6E6E73]">
                      {c.discount_pct}% off ·{' '}
                      {c.target_type === 'tier'
                        ? (c.target_tiers || []).map(t => TIER_LABELS[t]).join(', ')
                        : 'Specific users'
                      }
                      {' · '}
                      {scopeIcon(c.scope)}
                      {c.scope === 'all' ? 'All purchases' : c.scope_name || c.scope}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-[#1D1D1F]">{c.codes_count} codes</p>
                    <p className="text-[10px] text-[#A1A1A6]">until {new Date(c.valid_until).toLocaleDateString()}</p>
                  </div>
                  {expandedCampaign === c.id ? <ChevronUp size={14} className="text-[#A1A1A6]" /> : <ChevronDown size={14} className="text-[#A1A1A6]" />}
                </div>
              </button>

              {expandedCampaign === c.id && (
                <div className="border-t border-[#D2D2D7] px-5 pb-5">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-[#A1A1A6]">
                      <Loader2 size={12} className="animate-spin" /> Loading codes…
                    </div>
                  ) : campaignDetail ? (
                    <div className="mt-4">
                      <div className="grid grid-cols-3 gap-4 text-center mb-4">
                        <div className="bg-[#F5F5F7] px-3 py-2">
                          <p className="text-lg font-bold text-[#1D1D1F]">{campaignDetail.codes.length}</p>
                          <p className="text-[10px] text-[#A1A1A6]">Total codes</p>
                        </div>
                        <div className="bg-[#F5F5F7] px-3 py-2">
                          <p className="text-lg font-bold text-[#4ECDC4]">{campaignDetail.codes.filter(x => x.used).length}</p>
                          <p className="text-[10px] text-[#A1A1A6]">Used</p>
                        </div>
                        <div className="bg-[#F5F5F7] px-3 py-2">
                          <p className="text-lg font-bold text-[#1D1D1F]">{campaignDetail.codes.filter(x => !x.used).length}</p>
                          <p className="text-[10px] text-[#A1A1A6]">Remaining</p>
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto border border-[#D2D2D7] divide-y divide-[#F3F0EC]">
                        {campaignDetail.codes.map(code => (
                          <div key={code.id} className="flex items-center justify-between px-3 py-2 text-xs">
                            <span className="font-mono font-semibold text-[#1D1D1F]">{code.code}</span>
                            <span className="text-[#6E6E73] truncate mx-4 hidden sm:block">{code.assigned_to_email}</span>
                            {code.used
                              ? <span className="flex items-center gap-1 text-[#A1A1A6] shrink-0"><XCircle size={11} /> Used</span>
                              : <span className="flex items-center gap-1 text-[#4ECDC4] shrink-0"><CheckCircle size={11} /> Available</span>
                            }
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
