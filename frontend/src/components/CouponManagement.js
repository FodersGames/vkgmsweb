import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Tag, Plus, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, Users, Gamepad2, ShoppingBag, X } from 'lucide-react';
import { Button, Card, CardHeader, CardBody, Input } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TIERS       = ['bronze', 'silver', 'gold', 'diamond'];
const TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond' };

const IN = 'w-full bg-gray-50 border border-gray-200 rounded-lg text-sm px-3 h-9 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 text-gray-900 transition-colors placeholder:text-gray-400';

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

  const [campaigns,       setCampaigns]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showCreate,      setShowCreate]      = useState(false);
  const [form,            setForm]            = useState(initialForm);
  const [creating,        setCreating]        = useState(false);
  const [createResult,    setCreateResult]    = useState(null);
  const [createError,     setCreateError]     = useState('');
  const [expandedCampaign,setExpandedCampaign]= useState(null);
  const [campaignDetail,  setCampaignDetail]  = useState(null);
  const [detailLoading,   setDetailLoading]   = useState(false);

  const [users,      setUsers]      = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [games,      setGames]      = useState([]);
  const [products,   setProducts]   = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/admin/coupons/campaigns`, { headers });
      setCampaigns(r.data.campaigns || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showCreate) return;
    axios.get(`${API_URL}/api/website/games`,  { headers }).then(r => setGames(r.data.games    || [])).catch(() => {});
    axios.get(`${API_URL}/api/shop/products`,  { headers }).then(r => setProducts(r.data.products || [])).catch(() => {});
    axios.get(`${API_URL}/api/admin/users`,    { headers }).then(r => setUsers(r.data.users    || [])).catch(() => {});
  }, [showCreate, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTier = (tier) => setForm(f => ({
    ...f,
    target_tiers: f.target_tiers.includes(tier)
      ? f.target_tiers.filter(t => t !== tier)
      : [...f.target_tiers, tier],
  }));

  const toggleUser = (id) => setForm(f => ({
    ...f,
    target_user_ids: f.target_user_ids.includes(id)
      ? f.target_user_ids.filter(u => u !== id)
      : [...f.target_user_ids, id],
  }));

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleScopeChange = (scope) => setForm(f => ({ ...f, scope, scope_id: '', scope_name: '' }));

  const handleCreate = async () => {
    setCreateError('');
    setCreateResult(null);
    if (!form.name.trim())                                     { setCreateError('Campaign name is required.'); return; }
    if (form.target_type === 'tier'  && !form.target_tiers.length)    { setCreateError('Select at least one tier.'); return; }
    if (form.target_type === 'users' && !form.target_user_ids.length) { setCreateError('Select at least one user.'); return; }
    if (form.scope !== 'all' && !form.scope_id)               { setCreateError('Select a specific product or game for the scope.'); return; }
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
    if (scope === 'game')    return <Gamepad2  size={12} className="inline mr-1" />;
    if (scope === 'product') return <ShoppingBag size={12} className="inline mr-1" />;
    return null;
  };

  const TOGGLE_BTN = (active) =>
    `text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
      active ? 'border-brand-400 bg-brand-50 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
    }`;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-400/20 flex items-center justify-center">
              <Tag size={16} className="text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Promo Coupons</h3>
              <p className="text-xs text-gray-400">Send unique discount codes to users or tiers</p>
            </div>
          </div>
          <Button
            variant="accent"
            icon={Plus}
            onClick={() => { setShowCreate(v => !v); setCreateResult(null); setCreateError(''); }}
          >
            New campaign
          </Button>
        </CardHeader>

        {/* Create form */}
        {showCreate && (
          <div className="border-b border-gray-100">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Create coupon campaign</h3>
                <button
                  onClick={() => { setShowCreate(false); setCreateResult(null); }}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {createResult ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-brand-50 border border-brand-400/20 flex items-center justify-center mx-auto">
                    <CheckCircle size={22} className="text-brand-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Campaign created!</p>
                  <p className="text-xs text-gray-500"><strong>{createResult.codes_sent}</strong> unique codes sent to users' inboxes.</p>
                  <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateResult(null); }}>Close</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    label="Campaign name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Summer promo, Gold exclusive…"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Discount %"
                      type="number" min={1} max={99}
                      value={form.discount_pct}
                      onChange={e => setForm(f => ({ ...f, discount_pct: parseInt(e.target.value) || 1 }))}
                    />
                    <Input
                      label="Valid for (days)"
                      type="number" min={1}
                      value={form.valid_days}
                      onChange={e => setForm(f => ({ ...f, valid_days: parseInt(e.target.value) || 1 }))}
                    />
                  </div>

                  {/* Scope */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Applicable to</label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: 'all',     label: 'All purchases' },
                        { value: 'product', label: 'Specific product' },
                        { value: 'game',    label: 'Specific game' },
                      ].map(opt => (
                        <button key={opt.value} onClick={() => handleScopeChange(opt.value)} className={TOGGLE_BTN(form.scope === opt.value)}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {form.scope === 'product' && (
                      <select
                        className={`${IN} mt-2`}
                        value={form.scope_id}
                        onChange={e => {
                          const p = products.find(x => x.id === e.target.value);
                          setForm(f => ({ ...f, scope_id: e.target.value, scope_name: p?.name || '' }));
                        }}
                      >
                        <option value="">— Select a product —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    {form.scope === 'game' && (
                      <select
                        className={`${IN} mt-2`}
                        value={form.scope_id}
                        onChange={e => {
                          const g = games.find(x => x.slug === e.target.value);
                          setForm(f => ({ ...f, scope_id: e.target.value, scope_name: g?.name || '' }));
                        }}
                      >
                        <option value="">— Select a game —</option>
                        {games.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
                      </select>
                    )}
                  </div>

                  {/* Target */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Target</label>
                    <div className="flex gap-2 mb-3">
                      {[
                        { value: 'tier',  label: 'By loyalty tier',  icon: <Tag   size={12} /> },
                        { value: 'users', label: 'Specific users',   icon: <Users size={12} /> },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm(f => ({ ...f, target_type: opt.value, target_tiers: [], target_user_ids: [] }))}
                          className={TOGGLE_BTN(form.target_type === opt.value)}
                        >
                          <span className="flex items-center gap-1.5">{opt.icon} {opt.label}</span>
                        </button>
                      ))}
                    </div>

                    {form.target_type === 'tier' && (
                      <div className="flex gap-2 flex-wrap">
                        {TIERS.map(tier => (
                          <button key={tier} onClick={() => toggleTier(tier)} className={TOGGLE_BTN(form.target_tiers.includes(tier))}>
                            <span className="flex items-center gap-1">
                              {TIER_LABELS[tier]}
                              {form.target_tiers.includes(tier) && <CheckCircle size={10} className="text-brand-400" />}
                            </span>
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
                          className={IN}
                        />
                        <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                          {filteredUsers.slice(0, 50).map(u => (
                            <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.target_user_ids.includes(u.id)}
                                onChange={() => toggleUser(u.id)}
                                className="accent-brand-400 rounded"
                              />
                              <span className="text-xs text-gray-900 truncate">{u.email}</span>
                              {u.username && <span className="text-[10px] text-gray-400">@{u.username}</span>}
                            </label>
                          ))}
                          {filteredUsers.length === 0 && <p className="text-xs text-gray-400 p-3">No users found</p>}
                        </div>
                        {form.target_user_ids.length > 0 && (
                          <p className="text-xs text-brand-400 font-semibold">{form.target_user_ids.length} user(s) selected</p>
                        )}
                      </div>
                    )}
                  </div>

                  {createError && <p className="text-xs text-error-500">{createError}</p>}

                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Button icon={Tag} loading={creating} onClick={handleCreate}>
                      {creating ? 'Creating…' : 'Send coupons'}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <CardBody className="space-y-2">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <Loader2 size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
              Loading…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
              No campaigns yet. Create one to start sending promo codes.
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map(c => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => loadDetail(c.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-400/20 flex items-center justify-center shrink-0">
                        <Tag size={13} className="text-brand-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">
                          {c.discount_pct}% off ·{' '}
                          {c.target_type === 'tier'
                            ? (c.target_tiers || []).map(t => TIER_LABELS[t]).join(', ')
                            : 'Specific users'}
                          {' · '}
                          {scopeIcon(c.scope)}
                          {c.scope === 'all' ? 'All purchases' : c.scope_name || c.scope}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-semibold text-gray-900">{c.codes_count} codes</p>
                        <p className="text-[10px] text-gray-400">until {new Date(c.valid_until).toLocaleDateString()}</p>
                      </div>
                      {expandedCampaign === c.id
                        ? <ChevronUp  size={14} className="text-gray-400" />
                        : <ChevronDown size={14} className="text-gray-400" />
                      }
                    </div>
                  </button>

                  {expandedCampaign === c.id && (
                    <div className="border-t border-gray-100 px-4 pb-4">
                      {detailLoading ? (
                        <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
                          <Loader2 size={12} className="animate-spin" /> Loading codes…
                        </div>
                      ) : campaignDetail ? (
                        <div className="mt-4 space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'Total codes',  val: campaignDetail.codes.length,                        cls: 'text-gray-900' },
                              { label: 'Used',         val: campaignDetail.codes.filter(x => x.used).length,    cls: 'text-brand-400' },
                              { label: 'Remaining',    val: campaignDetail.codes.filter(x => !x.used).length,   cls: 'text-gray-900' },
                            ].map(({ label, val, cls }) => (
                              <div key={label} className="bg-gray-50 rounded-xl px-3 py-3 text-center">
                                <p className={`text-lg font-bold ${cls}`}>{val}</p>
                                <p className="text-[10px] text-gray-400">{label}</p>
                              </div>
                            ))}
                          </div>
                          <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                            {campaignDetail.codes.map(code => (
                              <div key={code.id} className="flex items-center justify-between px-3 py-2 text-xs">
                                <span className="font-mono font-semibold text-gray-900">{code.code}</span>
                                <span className="text-gray-400 truncate mx-4 hidden sm:block">{code.assigned_to_email}</span>
                                {code.used
                                  ? <span className="flex items-center gap-1 text-gray-400 shrink-0"><XCircle  size={11} /> Used</span>
                                  : <span className="flex items-center gap-1 text-brand-400 shrink-0"><CheckCircle size={11} /> Available</span>
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
        </CardBody>
      </Card>
    </div>
  );
};

export default CouponManagement;
