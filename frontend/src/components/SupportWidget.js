import React, { useState, useCallback, useEffect } from 'react';
import { ChatCircle, X, PaperPlaneTilt, CaretLeft, ArrowSquareOut, CircleNotch, CheckCircle } from '@phosphor-icons/react';
import axios from 'axios';
import { Select } from '../ui';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing / Purchase' },
  { value: 'account', label: 'Account' },
];

const STATUS_COLORS = {
  open: 'bg-[#4ECDC4]/10 text-[#4ECDC4]',
  in_progress: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  resolved: 'bg-[#22C55E]/10 text-[#22C55E]',
  closed: 'bg-[#A1A1A6]/10 text-[#A1A1A6]',
};

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const SupportWidget = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu'); // menu | new | mytickets | thread
  const [form, setForm] = useState({ subject: '', category: 'general', message: '', email: user?.email || '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Check for unread ticket reply notifications on mount
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) return;
    axios.get(`${API_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${t}` },
      params: { notif_type: 'ticket_reply', limit: 1 },
    }).then(r => setHasUnread((r.data.unread || 0) > 0)).catch(() => {});
  }, []); // eslint-disable-line

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setLoadingTickets(true);
    try {
      const r = await axios.get(`${API_URL}/api/tickets/mine`, { headers });
      setTickets(r.data.tickets || []);
    } catch {
      // silent
    } finally {
      setLoadingTickets(false);
    }
  }, [token]); // eslint-disable-line

  useEffect(() => {
    if (view === 'mytickets') {
      fetchTickets();
      if (token && hasUnread) {
        axios.patch(`${API_URL}/api/notifications/read-all`, {}, {
          headers,
          params: { notif_type: 'ticket_reply' },
        }).then(() => setHasUnread(false)).catch(() => {});
      }
    }
  }, [view, fetchTickets]); // eslint-disable-line

  const openThread = async (ticket) => {
    try {
      const r = await axios.get(`${API_URL}/api/tickets/${ticket.ticket_number}`, { headers });
      setActiveTicket(r.data.ticket);
      setView('thread');
    } catch {
      setActiveTicket(ticket);
      setView('thread');
    }
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const r = await axios.post(`${API_URL}/api/tickets`, form, { headers });
      setSuccess(r.data.ticket_number);
      setForm({ subject: '', category: 'general', message: '', email: user?.email || '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit ticket.');
    } finally {
      setSending(false);
    }
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !activeTicket) return;
    setSendingReply(true);
    try {
      await axios.post(`${API_URL}/api/tickets/${activeTicket.ticket_number}/reply`, { content: reply }, { headers });
      setReply('');
      const r = await axios.get(`${API_URL}/api/tickets/${activeTicket.ticket_number}`, { headers });
      setActiveTicket(r.data.ticket);
    } catch (err) {
      // silent
    } finally {
      setSendingReply(false);
    }
  };

  const close = () => {
    setOpen(false);
    setView('menu');
    setSuccess('');
    setError('');
    setActiveTicket(null);
    setReply('');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass-sheen fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#1D1D1F] text-white flex items-center justify-center shadow-lg hover:bg-[#3A3A3C] transition-colors"
        aria-label="Support"
      >
        <ChatCircle size={20} />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {open && (
        <div className="animate-appear fixed bottom-24 right-6 z-50 w-80 rounded-2xl overflow-hidden liquid-glass flex flex-col" style={{ maxHeight: '520px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 liquid-glass-dark rounded-none border-x-0 border-t-0">
            <div className="flex items-center gap-2">
              {view !== 'menu' && (
                <button onClick={() => { setView('menu'); setSuccess(''); setError(''); setActiveTicket(null); }} className="hover:text-white/70 transition-colors mr-1">
                  <CaretLeft size={16} />
                </button>
              )}
              <span className="text-sm font-bold tracking-wide">
                {view === 'menu' && 'Support'}
                {view === 'new' && 'New Ticket'}
                {view === 'mytickets' && 'My Tickets'}
                {view === 'thread' && (activeTicket?.ticket_number || 'Ticket')}
              </span>
            </div>
            <button onClick={close} className="hover:text-white/70 transition-colors"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* MENU */}
            {view === 'menu' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-[#6E6E73]">How can we help you today?</p>
                {token ? (
                  <>
                    <button
                      onClick={() => { setView('new'); setSuccess(''); setError(''); }}
                      className="rounded-xl w-full flex items-center gap-3 px-4 py-3 border border-[#D2D2D7] hover:border-[#4ECDC4]/50 hover:bg-[#F5F5F7] transition-all text-left"
                    >
                      <PaperPlaneTilt size={16} className="text-[#4ECDC4] flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-[#1D1D1F]">Open a ticket</p>
                        <p className="text-xs text-[#A1A1A6]">Send us a support request</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setView('mytickets')}
                      className="rounded-xl w-full flex items-center gap-3 px-4 py-3 border border-[#D2D2D7] hover:border-[#4ECDC4]/50 hover:bg-[#F5F5F7] transition-all text-left"
                    >
                      <ArrowSquareOut size={16} className="text-[#6E6E73] flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-[#1D1D1F]">My tickets</p>
                        <p className="text-xs text-[#A1A1A6]">View your past requests</p>
                      </div>
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl px-4 py-4 border border-[#D2D2D7] bg-[#F5F5F7] text-center space-y-2">
                    <p className="text-sm font-semibold text-[#1D1D1F]">Sign in required</p>
                    <p className="text-xs text-[#A1A1A6]">You need an account to open a support ticket.</p>
                    <a href="/login" className="inline-block mt-1 text-xs font-bold text-[#4ECDC4] hover:underline">Sign in or create account →</a>
                  </div>
                )}
                <p className="text-xs text-[#A1A1A6] text-center pt-2">
                  Email: <a href="mailto:support@vakargames.com" className="underline hover:text-[#1D1D1F]">support@vakargames.com</a>
                </p>
              </div>
            )}

            {/* NEW TICKET */}
            {view === 'new' && (
              <div className="p-4">
                {success ? (
                  <div className="text-center py-6">
                    <CheckCircle size={36} className="text-[#4ECDC4] mx-auto mb-3" />
                    <p className="text-sm font-bold text-[#1D1D1F] mb-1">Ticket submitted!</p>
                    <p className="text-xs text-[#6E6E73]">Ticket number: <strong>{success}</strong></p>
                    <p className="text-xs text-[#A1A1A6] mt-2">We'll reply as soon as possible.</p>
                    <button onClick={() => { setSuccess(''); setView('menu'); }} className="mt-4 text-xs text-[#4ECDC4] hover:underline">
                      Back to support
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitTicket} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Category</label>
                      <Select
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      >
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Subject</label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                        placeholder="Brief description"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Message</label>
                      <textarea
                        required
                        maxLength={2000}
                        rows={4}
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F] resize-none"
                        placeholder="Describe your issue in detail…"
                      />
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full flex items-center justify-center gap-2 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {sending ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} />}
                      {sending ? 'Sending…' : 'Submit ticket'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* MY TICKETS */}
            {view === 'mytickets' && (
              <div className="divide-y divide-[#D2D2D7]">
                {loadingTickets ? (
                  <div className="p-6 text-center"><CircleNotch size={18} className="animate-spin text-[#A1A1A6] mx-auto" /></div>
                ) : tickets.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#A1A1A6]">No tickets yet.</div>
                ) : (
                  tickets.map(t => (
                    <button
                      key={t.id}
                      onClick={() => openThread(t)}
                      className="w-full px-4 py-3 text-left hover:bg-[#F5F5F7] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-[#1D1D1F] truncate flex-1">{t.subject}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A1A1A6] mt-0.5">{t.ticket_number}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* THREAD */}
            {view === 'thread' && activeTicket && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[#D2D2D7]">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[activeTicket.status] || STATUS_COLORS.open}`}>
                    {STATUS_LABELS[activeTicket.status] || activeTicket.status}
                  </span>
                  <span className="text-xs text-[#6E6E73] truncate">{activeTicket.subject}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '280px' }}>
                  {(activeTicket.messages || []).map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.sender === 'user' ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F]'}`}>
                        <p className={`text-[10px] font-semibold mb-0.5 ${msg.sender === 'user' ? 'text-white/60' : 'text-[#4ECDC4]'}`}>
                          {msg.sender === 'support' ? '⚡ Support' : msg.author_name}
                        </p>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {activeTicket.status !== 'closed' && (
                  <form onSubmit={submitReply} className="border-t border-[#D2D2D7] p-3 flex gap-2">
                    <input
                      type="text"
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      className="rounded-lg flex-1 px-3 py-1.5 text-xs border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                      placeholder="Reply…"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !reply.trim()}
                      className="rounded-lg flex items-center justify-center w-8 h-8 bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {sendingReply ? <CircleNotch size={12} className="animate-spin" /> : <PaperPlaneTilt size={12} />}
                    </button>
                  </form>
                )}
                {activeTicket.status === 'closed' && (
                  <div className="border-t border-[#D2D2D7] px-4 py-2 text-center text-xs text-[#A1A1A6]">This ticket is closed.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
