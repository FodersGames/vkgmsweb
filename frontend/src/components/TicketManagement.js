import React, { useState, useEffect, useCallback } from 'react';
import { Ticket, ChevronLeft, Send, Loader2, RefreshCw, Filter } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const STATUS_COLORS = {
  open: 'bg-[#4ECDC4]/10 text-[#4ECDC4] border-[#4ECDC4]/30',
  in_progress: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30',
  resolved: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30',
  closed: 'bg-[#A1A1A6]/10 text-[#A1A1A6] border-[#A1A1A6]/30',
};
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

const PRIORITY_COLORS = {
  normal: 'text-[#6E6E73]',
  high: 'text-[#F59E0B]',
  urgent: 'text-red-500',
};

const CATEGORY_LABELS = { general: 'General', technical: 'Technical', billing: 'Billing', account: 'Account' };

const TicketManagement = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const r = await api.get('/api/admin/tickets', { params });
      setTickets(r.data.tickets || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch {
      // silent
    } finally {
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
    } catch {
      // silent
    } finally {
      setUpdatingStatus(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (activeTicket) {
    return (
      <div>
        <button
          onClick={() => { setActiveTicket(null); fetchTickets(); }}
          className="flex items-center gap-2 text-sm text-[#6E6E73] hover:text-[#1D1D1F] mb-6 transition-colors"
        >
          <ChevronLeft size={14} /> Back to tickets
        </button>

        <div className="rounded-xl bg-white border border-[#D2D2D7] p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#4ECDC4] tracking-widest uppercase mb-1">{activeTicket.ticket_number}</p>
              <h2 className="text-xl font-bold text-[#1D1D1F]">{activeTicket.subject}</h2>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-[#A1A1A6]">From: <strong className="text-[#6E6E73]">{activeTicket.username}</strong> ({activeTicket.user_email})</span>
                <span className="text-xs text-[#A1A1A6]">{CATEGORY_LABELS[activeTicket.category] || activeTicket.category}</span>
                <span className="text-xs text-[#A1A1A6]">{fmtDate(activeTicket.created_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] uppercase mb-1">Status</label>
                <select
                  value={activeTicket.status}
                  onChange={e => updateTicket('status', e.target.value)}
                  disabled={updatingStatus}
                  className="text-xs border border-[#D2D2D7] px-2 py-1.5 focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] uppercase mb-1">Priority</label>
                <select
                  value={activeTicket.priority || 'normal'}
                  onChange={e => updateTicket('priority', e.target.value)}
                  disabled={updatingStatus}
                  className="text-xs border border-[#D2D2D7] px-2 py-1.5 focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-[#D2D2D7] p-6 mb-4">
          <div className="space-y-4 mb-6" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {(activeTicket.messages || []).map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F]' : 'bg-[#1D1D1F] text-white'}`}>
                  <p className={`text-[10px] font-bold mb-1 ${msg.sender === 'user' ? 'text-[#A1A1A6]' : 'text-[#4ECDC4]'}`}>
                    {msg.sender === 'support' ? `⚡ ${msg.author_name} (Support)` : msg.author_name}
                    <span className="ml-2 font-normal opacity-60">{fmtDate(msg.timestamp)}</span>
                  </p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          {loadingTicket && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[#A1A1A6]" size={18} /></div>}

          {activeTicket.status !== 'closed' && (
            <form onSubmit={sendReply} className="border-t border-[#D2D2D7] pt-4">
              <label className="block text-xs font-semibold text-[#1D1D1F] mb-2">Reply as support</label>
              <textarea
                rows={3}
                value={reply}
                onChange={e => setReply(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F] resize-none mb-2"
                placeholder="Type your reply…"
              />
              {replyError && <p className="text-xs text-red-500 mb-2">{replyError}</p>}
              <button
                type="submit"
                disabled={sendingReply || !reply.trim()}
                className="rounded-full flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send reply
              </button>
            </form>
          )}
          {activeTicket.status === 'closed' && (
            <p className="text-center text-xs text-[#A1A1A6] pt-4 border-t border-[#D2D2D7]">This ticket is closed.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1D1D1F]">SUPPORT TICKETS</h2>
          <p className="text-xs text-[#A1A1A6] mt-0.5">{total} ticket{total !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={fetchTickets} disabled={loading} className="flex items-center gap-2 text-xs text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-[#6E6E73]"><Filter size={12} /> Filters:</div>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="text-xs border border-[#D2D2D7] px-2 py-1.5 focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => { setFilterPriority(e.target.value); setPage(1); }}
          className="text-xs border border-[#D2D2D7] px-2 py-1.5 focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
        >
          <option value="">All priorities</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#A1A1A6]" size={24} /></div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl bg-white border border-[#D2D2D7] p-16 text-center">
          <Ticket size={32} className="text-[#D2D2D7] mx-auto mb-3" />
          <p className="text-sm text-[#A1A1A6]">No tickets found.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D2D2D7] divide-y divide-[#D2D2D7]">
          {tickets.map(t => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className="w-full px-6 py-4 text-left hover:bg-[#F5F5F7] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-[#A1A1A6]">{t.ticket_number}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                    {t.priority && t.priority !== 'normal' && (
                      <span className={`text-[10px] font-bold uppercase ${PRIORITY_COLORS[t.priority]}`}>
                        {t.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#1D1D1F] truncate">{t.subject}</p>
                  <p className="text-xs text-[#A1A1A6] mt-0.5">{t.username} · {t.user_email} · {CATEGORY_LABELS[t.category] || t.category}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-[#A1A1A6]">{fmtDate(t.updated_at)}</p>
                  <p className="text-[10px] text-[#A1A1A6] mt-0.5">{(t.messages || []).length} message{(t.messages || []).length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-[#6E6E73] hover:text-[#1D1D1F] disabled:opacity-40 transition-colors">← Prev</button>
          <span className="text-xs text-[#A1A1A6]">Page {page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="text-xs text-[#6E6E73] hover:text-[#1D1D1F] disabled:opacity-40 transition-colors">Next →</button>
        </div>
      )}
    </div>
  );
};

export default TicketManagement;
