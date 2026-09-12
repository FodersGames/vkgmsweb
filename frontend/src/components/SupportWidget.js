import React, { useState, useCallback, useEffect } from 'react';
import { ChatCircle, X, PaperPlaneTilt, CaretLeft, ArrowSquareOut, CircleNotch, CheckCircle } from '@phosphor-icons/react';
import axios from 'axios';
import { Select } from '../ui';
import { PublicButton } from '../ui/PublicButton';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing / Purchase' },
  { value: 'account', label: 'Account' },
];

const STATUS_COLORS = {
  open: 'bg-[#FF6600]/10 text-[#FF6600]',
  in_progress: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  resolved: 'bg-[#22C55E]/10 text-[#22C55E]',
  closed: 'bg-[#A1A1A6]/15 text-[#6E6E73]',
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

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

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
    if (open) {
      fetchTickets();
    }
  }, [open, fetchTickets]);

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

  const openCount = tickets.filter(t => t.status !== 'closed').length;
  const limitReached = openCount >= 3;

  const submitTicket = async (e) => {
    e.preventDefault();
    if (limitReached) {
      setError("Ticket ouvert maximum atteint (3/3).");
      return;
    }
    setError('');
    setSending(true);
    try {
      const r = await axios.post(`${API_URL}/api/tickets`, form, { headers });
      setSuccess(r.data.ticket_number);
      setForm({ subject: '', category: 'general', message: '', email: user?.email || '' });
      fetchTickets();
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
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen(true)}
          className="btn-kefir shadow-xl flex items-center gap-2"
          style={{ fontSize: '0.75rem', padding: '0.65rem 1.25rem' }}
          aria-label="Support"
        >
          <ChatCircle size={16} weight="bold" />
          <span>Support</span>
        </button>
      </div>

      {open && (
        <div className="animate-appear fixed bottom-24 right-6 z-50 w-80 bg-white border border-[#E5E7EB] shadow-2xl flex flex-col" style={{ maxHeight: '520px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] text-white">
            <div className="flex items-center gap-2">
              {view !== 'menu' && (
                <button onClick={() => { setView('menu'); setSuccess(''); setError(''); setActiveTicket(null); }} className="text-white/80 hover:text-white transition-colors mr-1">
                  <CaretLeft size={16} />
                </button>
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {view === 'menu' && 'Support'}
                {view === 'new' && 'New Ticket'}
                {view === 'mytickets' && 'My Tickets'}
                {view === 'thread' && (activeTicket?.ticket_number || 'Ticket')}
              </span>
            </div>
            <button onClick={close} className="text-white/80 hover:text-white transition-colors"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {/* MENU */}
            {view === 'menu' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-[#52525B]">How can we help you today?</p>
                {token ? (
                  <>
                    <button
                      onClick={() => { setView('new'); setSuccess(''); setError(''); }}
                      className="w-full flex items-center gap-3 px-4 py-3 border border-[#E5E7EB] hover:border-[#FF6600] hover:bg-[#F8F9FA] transition-all text-left bg-white"
                    >
                      <PaperPlaneTilt size={16} className="text-[#FF6600] flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[#0A0A0A]">Open a ticket</p>
                        <p className="text-xs text-[#71717A]">Send us a support request</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setView('mytickets')}
                      className="w-full flex items-center gap-3 px-4 py-3 border border-[#E5E7EB] hover:border-[#FF6600] hover:bg-[#F8F9FA] transition-all text-left bg-white"
                    >
                      <ArrowSquareOut size={16} className="text-[#71717A] flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[#0A0A0A]">My tickets</p>
                        <p className="text-xs text-[#71717A]">View your past requests</p>
                      </div>
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-4 border border-[#E5E7EB] bg-[#F8F9FA] text-center space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#0A0A0A]">Sign in required</p>
                    <p className="text-xs text-[#71717A]">You need an account to open a support ticket.</p>
                    <a href="/login" className="inline-block mt-1 text-xs font-bold text-[#FF6600] hover:underline">Sign in or create account →</a>
                  </div>
                )}
                <p className="text-xs text-[#71717A] text-center pt-2">
                  Email: <a href="mailto:support@vakargames.com" className="underline hover:text-[#0A0A0A]">support@vakargames.com</a>
                </p>
              </div>
            )}

            {/* NEW TICKET */}
            {view === 'new' && (
              <div className="p-4">
                {success ? (
                  <div className="text-center py-6">
                    <CheckCircle size={36} className="text-[#FF6600] mx-auto mb-3" />
                    <p className="text-sm font-bold text-[#0A0A0A] mb-1">Ticket submitted!</p>
                    <p className="text-xs text-[#52525B]">Ticket number: <strong>{success}</strong></p>
                    <p className="text-xs text-[#71717A] mt-2">We'll reply as soon as possible.</p>
                    <button onClick={() => { setSuccess(''); setView('menu'); }} className="mt-4 text-xs font-bold uppercase text-[#FF6600] hover:underline">
                      Back to support
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitTicket} className="space-y-3">
                    {limitReached && (
                      <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
                        Ticket ouvert maximum atteint ({openCount}/3).
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#D4D4D8] focus:outline-none focus:border-[#FF6600] bg-[#F8F9FA] text-[#0A0A0A]"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-1">Category</label>
                      <Select
                        value={form.category}
                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      >
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-1">Subject</label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#D4D4D8] focus:outline-none focus:border-[#FF6600] bg-[#F8F9FA] text-[#0A0A0A]"
                        placeholder="Brief description"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#52525B] mb-1">Message</label>
                      <textarea
                        required
                        maxLength={2000}
                        rows={4}
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-[#D4D4D8] focus:outline-none focus:border-[#FF6600] bg-[#F8F9FA] text-[#0A0A0A] resize-none"
                        placeholder="Describe your issue in detail…"
                      />
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <button
                      type="submit"
                      disabled={sending || limitReached}
                      className="btn-kefir w-full"
                    >
                      {sending ? <CircleNotch size={14} className="animate-spin mr-1.5" /> : <PaperPlaneTilt size={14} className="mr-1.5" />}
                      {limitReached ? 'Ticket ouvert maximum atteint' : (sending ? 'Sending…' : 'Submit ticket')}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* MY TICKETS */}
            {view === 'mytickets' && (
              <div className="divide-y divide-[#E5E7EB]">
                {loadingTickets ? (
                  <div className="p-6 text-center"><CircleNotch size={18} className="animate-spin text-[#FF6600] mx-auto" /></div>
                ) : tickets.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#71717A]">No tickets yet.</div>
                ) : (
                  tickets.map(t => (
                    <button
                      key={t.id || t.ticket_number}
                      onClick={() => openThread(t)}
                      className="w-full px-4 py-3 text-left hover:bg-[#F8F9FA] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-[#0A0A0A] truncate flex-1">{t.subject}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 flex-shrink-0 ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#71717A] mt-0.5">{t.ticket_number}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* THREAD */}
            {view === 'thread' && activeTicket && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E5E7EB] bg-[#F8F9FA]">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 ${STATUS_COLORS[activeTicket.status] || STATUS_COLORS.open}`}>
                    {STATUS_LABELS[activeTicket.status] || activeTicket.status}
                  </span>
                  <span className="text-xs text-[#52525B] truncate">{activeTicket.subject}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '280px' }}>
                  {(activeTicket.messages || []).map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed ${msg.sender === 'user' ? 'bg-[#0A0A0A] text-white' : 'bg-[#F8F9FA] border border-[#E5E7EB] text-[#0A0A0A]'}`}>
                        <p className={`text-[10px] font-semibold mb-0.5 ${msg.sender === 'user' ? 'text-white/60' : 'text-[#FF6600]'}`}>
                          {msg.sender === 'support' ? '⚡ Support' : msg.author_name}
                        </p>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {activeTicket.status !== 'closed' && (
                  <form onSubmit={submitReply} className="border-t border-[#E5E7EB] p-3 flex gap-2">
                    <input
                      type="text"
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-[#D4D4D8] focus:outline-none focus:border-[#FF6600] bg-[#F8F9FA] text-[#0A0A0A]"
                      placeholder="Reply…"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !reply.trim()}
                      className="flex items-center justify-center w-8 h-8 bg-[#FF6600] hover:bg-[#e05a00] text-white transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {sendingReply ? <CircleNotch size={12} className="animate-spin" /> : <PaperPlaneTilt size={12} />}
                    </button>
                  </form>
                )}
                {activeTicket.status === 'closed' && (
                  <div className="border-t border-[#E5E7EB] px-4 py-2 text-center text-xs text-[#71717A]">This ticket is closed.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
