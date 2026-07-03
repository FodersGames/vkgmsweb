import React, { useState, useEffect, useCallback } from 'react';
import { Ticket, ChevronLeft, Send, Loader2, RefreshCw, Filter } from 'lucide-react';
import axios from 'axios';
import { Button, Card, CardHeader, CardBody } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const STATUS_COLORS = {
  open:        'bg-brand-50 text-brand-400 border-brand-400/30',
  in_progress: 'bg-amber-50 text-amber-500 border-amber-300/40',
  resolved:    'bg-green-50 text-green-600 border-green-300/40',
  closed:      'bg-gray-100 text-gray-400 border-gray-300/40',
};
const STATUS_LABELS    = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
const PRIORITY_COLORS  = { normal: 'text-gray-400', high: 'text-amber-500', urgent: 'text-error-500' };
const CATEGORY_LABELS  = { general: 'General', technical: 'Technical', billing: 'Billing', account: 'Account' };

const SELECT_CLS = 'text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:border-brand-400';

const TicketManagement = () => {
  const [tickets,       setTickets]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterPriority,setFilterPriority]= useState('');
  const [activeTicket,  setActiveTicket]  = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [reply,         setReply]         = useState('');
  const [sendingReply,  setSendingReply]  = useState(false);
  const [replyError,    setReplyError]    = useState('');
  const [updatingStatus,setUpdatingStatus]= useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterStatus)   params.status   = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const r = await api.get('/api/admin/tickets', { params });
      setTickets(r.data.tickets || []);
      setTotal(r.data.total   || 0);
      setPages(r.data.pages   || 1);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterPriority]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openTicket = async (t) => {
    setLoadingTicket(true);
    try {
      const r = await api.get(`/api/tickets/${t.ticket_number}`);
      setActiveTicket(r.data.ticket);
    } catch {
      setActiveTicket(t);
    } finally {
      setLoadingTicket(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !activeTicket) return;
    setSendingReply(true);
    setReplyError('');
    try {
      await api.post(`/api/admin/tickets/${activeTicket.ticket_number}/reply`, { content: reply });
      setReply('');
      const r = await api.get(`/api/tickets/${activeTicket.ticket_number}`);
      setActiveTicket(r.data.ticket);
      fetchTickets();
    } catch (err) {
      setReplyError(err.response?.data?.detail || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const updateTicket = async (field, value) => {
    if (!activeTicket) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/api/admin/tickets/${activeTicket.ticket_number}`, { [field]: value });
      const r = await api.get(`/api/tickets/${activeTicket.ticket_number}`);
      setActiveTicket(r.data.ticket);
      fetchTickets();
    } catch { /* silent */ } finally {
      setUpdatingStatus(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (activeTicket) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setActiveTicket(null); fetchTickets(); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={14} /> Back to tickets
        </button>

        <Card className="overflow-hidden">
          <CardBody>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-brand-400 tracking-widest uppercase mb-1">{activeTicket.ticket_number}</p>
                <h2 className="text-lg font-bold text-gray-900">{activeTicket.subject}</h2>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs text-gray-400">From: <strong className="text-gray-600">{activeTicket.username}</strong> ({activeTicket.user_email})</span>
                  <span className="text-xs text-gray-400">{CATEGORY_LABELS[activeTicket.category] || activeTicket.category}</span>
                  <span className="text-xs text-gray-400">{fmtDate(activeTicket.created_at)}</span>
                </div>
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Status</label>
                  <select
                    value={activeTicket.status}
                    onChange={e => updateTicket('status', e.target.value)}
                    disabled={updatingStatus}
                    className={SELECT_CLS}
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Priority</label>
                  <select
                    value={activeTicket.priority || 'normal'}
                    onChange={e => updateTicket('priority', e.target.value)}
                    disabled={updatingStatus}
                    className={SELECT_CLS}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardBody>
            <div className="space-y-3 mb-4" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {(activeTicket.messages || []).map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed rounded-xl ${
                    msg.sender === 'user'
                      ? 'bg-gray-50 border border-gray-200 text-gray-900'
                      : 'bg-gray-900 text-white'
                  }`}>
                    <p className={`text-[10px] font-bold mb-1 ${msg.sender === 'user' ? 'text-gray-400' : 'text-brand-400'}`}>
                      {msg.sender === 'support' ? `⚡ ${msg.author_name} (Support)` : msg.author_name}
                      <span className="ml-2 font-normal opacity-60">{fmtDate(msg.timestamp)}</span>
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {loadingTicket && (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-gray-400" size={18} />
              </div>
            )}

            {activeTicket.status !== 'closed' ? (
              <form onSubmit={sendReply} className="border-t border-gray-100 pt-4 space-y-2">
                <label className="block text-xs font-semibold text-gray-700">Reply as support</label>
                <textarea
                  rows={3}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 bg-gray-50 text-gray-900 resize-none transition-colors placeholder:text-gray-400"
                  placeholder="Type your reply…"
                />
                {replyError && <p className="text-xs text-error-500">{replyError}</p>}
                <Button type="submit" icon={Send} loading={sendingReply} disabled={!reply.trim()}>
                  Send reply
                </Button>
              </form>
            ) : (
              <p className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">This ticket is closed.</p>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-400/20 flex items-center justify-center">
              <Ticket size={16} className="text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Support Tickets</h3>
              <p className="text-xs text-gray-400">{total} ticket{total !== 1 ? 's' : ''} total</p>
            </div>
          </div>
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </CardHeader>

        <CardBody className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-gray-400 mr-1">
              <Filter size={11} /> Filters
            </span>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className={SELECT_CLS}
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={e => { setFilterPriority(e.target.value); setPage(1); }}
              className={SELECT_CLS}
            >
              <option value="">All priorities</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No tickets found.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {tickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t)}
                  className="w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[10px] font-mono text-gray-400">{t.ticket_number}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                        {t.priority && t.priority !== 'normal' && (
                          <span className={`text-[10px] font-bold uppercase ${PRIORITY_COLORS[t.priority]}`}>
                            {t.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.username} · {t.user_email} · {CATEGORY_LABELS[t.category] || t.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400">{fmtDate(t.updated_at)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{(t.messages || []).length} msg</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors">← Prev</button>
              <span className="text-xs text-gray-400">Page {page} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors">Next →</button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default TicketManagement;
