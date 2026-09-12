import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChatCircle,
  X,
  PaperPlaneTilt,
  CaretLeft,
  ArrowSquareOut,
  CircleNotch,
  CheckCircle,
  LockKey,
  Ticket,
  EnvelopeSimple,
  Warning,
} from '@phosphor-icons/react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing / Purchase' },
  { value: 'account', label: 'Account Assistance' },
];

const STATUS_COLORS = {
  open: 'border-[#FF6600]/40 text-[#FF6600] bg-[#FF6600]/10',
  in_progress: 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10',
  resolved: 'border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10',
  closed: 'border-white/20 text-white/40 bg-white/5',
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

  const openCount = tickets.filter((t) => t.status !== 'closed').length;
  const limitReached = openCount >= 3;

  const submitTicket = async (e) => {
    e.preventDefault();
    if (limitReached) {
      setError('Ticket ouvert maximum atteint (3/3).');
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
      {/* Floating launcher */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-[#111111] hover:bg-[#161616] text-white border border-white/15 hover:border-[#FF6600]/80 shadow-[0_12px_36px_rgba(0,0,0,0.85)] transition-all active:scale-95"
          style={{ letterSpacing: '0.08em' }}
          aria-label="Support & Tickets"
        >
          <span className="w-2 h-2 rounded-full bg-[#FF6600] group-hover:animate-ping" />
          <ChatCircle size={18} weight="bold" className="text-[#FF6600]" />
          <span className="text-xs font-bold uppercase tracking-wider">Support</span>
        </button>
      </div>

      {/* Popup Window */}
      {open && (
        <div
          className="animate-appear fixed bottom-20 right-6 z-50 w-[350px] max-w-[calc(100vw-2rem)] flex flex-col overflow-hidden bg-[#111111] border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.95)]"
          style={{ maxHeight: '540px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-[#161616] border-b border-white/10 text-white">
            <div className="flex items-center gap-2">
              {view !== 'menu' && (
                <button
                  onClick={() => {
                    setView('menu');
                    setSuccess('');
                    setError('');
                    setActiveTicket(null);
                  }}
                  className="text-white/70 hover:text-[#FF6600] transition-colors mr-1 p-0.5"
                >
                  <CaretLeft size={16} weight="bold" />
                </button>
              )}
              <span className="w-2 h-2 rounded-full bg-[#FF6600] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {view === 'menu' && 'Support / Help'}
                {view === 'new' && 'New Ticket'}
                {view === 'mytickets' && 'My Tickets'}
                {view === 'thread' && (activeTicket?.ticket_number || 'Ticket Thread')}
              </span>
            </div>
            <button
              onClick={close}
              className="text-white/50 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── MENU VIEW ────────────────────────────────────── */}
            {view === 'menu' && (
              <div className="p-4 space-y-4">
                <p className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                  How can we help you today?
                </p>

                {token ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setView('new');
                        setSuccess('');
                        setError('');
                      }}
                      className="w-full flex items-center gap-3.5 p-3.5 bg-[#161616] hover:bg-[#1A1A1A] border border-white/10 hover:border-[#FF6600]/60 transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded bg-[#FF6600]/10 border border-[#FF6600]/30 flex items-center justify-center text-[#FF6600] flex-shrink-0 group-hover:bg-[#FF6600] group-hover:text-black transition-colors">
                        <PaperPlaneTilt size={16} weight="bold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-white group-hover:text-[#FF6600] transition-colors">
                          Open a Ticket
                        </p>
                        <p className="text-[11px] text-white/40 truncate">
                          Send us a direct support request
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setView('mytickets')}
                      className="w-full flex items-center gap-3.5 p-3.5 bg-[#161616] hover:bg-[#1A1A1A] border border-white/10 hover:border-[#FF6600]/60 transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center text-white/70 flex-shrink-0 group-hover:border-white/30 transition-colors">
                        <Ticket size={16} weight="bold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-white group-hover:text-white transition-colors">
                            My Tickets
                          </p>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                            {openCount} active
                          </span>
                        </div>
                        <p className="text-[11px] text-white/40 truncate">
                          Track ongoing and past requests
                        </p>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="p-5 bg-[#161616] border border-white/10 text-center space-y-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#FF6600]/10 border border-[#FF6600]/30 flex items-center justify-center text-[#FF6600]">
                      <LockKey size={20} weight="bold" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-white">
                        Sign In Required
                      </p>
                      <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                        You need an account to open a support ticket and track replies.
                      </p>
                    </div>
                    <Link
                      to="/login"
                      onClick={close}
                      className="btn-kefir block w-full py-2.5 text-[11px] text-center font-bold tracking-wider"
                      style={{ backgroundColor: '#FFFFFF', color: '#000000', border: '1px solid #FFFFFF' }}
                    >
                      Sign In or Create Account →
                    </Link>
                  </div>
                )}

                {/* Direct email info */}
                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-white/40">
                  <span className="flex items-center gap-1.5">
                    <EnvelopeSimple size={14} className="text-[#FF6600]" /> Email Support
                  </span>
                  <a
                    href="mailto:support@vakargames.com"
                    className="text-white/80 hover:text-[#FF6600] transition-colors underline"
                  >
                    support@vakargames.com
                  </a>
                </div>
              </div>
            )}

            {/* ── NEW TICKET VIEW ──────────────────────────────── */}
            {view === 'new' && (
              <div className="p-4">
                {success ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[#FF6600]/15 border border-[#FF6600]/40 flex items-center justify-center text-[#FF6600]">
                      <CheckCircle size={28} weight="bold" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wider text-white">
                        Ticket Submitted!
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        Reference:{' '}
                        <strong className="text-white font-mono">{success}</strong>
                      </p>
                    </div>
                    <p className="text-[11px] text-white/40">
                      We typically respond within 24–48 hours.
                    </p>
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setSuccess('');
                          setView('mytickets');
                        }}
                        className="btn-kefir text-[11px] py-2"
                      >
                        View My Tickets
                      </button>
                      <button
                        onClick={() => {
                          setSuccess('');
                          setView('menu');
                        }}
                        className="text-[11px] text-white/40 hover:text-white uppercase tracking-wider py-1"
                      >
                        Back to Menu
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitTicket} className="space-y-3">
                    {limitReached && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                        <Warning size={16} weight="bold" className="flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold uppercase tracking-wider text-[11px]">Ticket Limit Reached</p>
                          <p className="text-[10px] text-red-300/80 mt-0.5">
                            You already have 3 open tickets. Please wait for resolution before creating a new one.
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                        Account Email
                      </label>
                      <input
                        type="email"
                        required
                        readOnly={!!token}
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-[#181818] border border-white/15 text-white focus:border-[#FF6600] outline-none"
                        style={{ opacity: token ? 0.6 : 1 }}
                        placeholder="your@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                        Category
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-[#181818] border border-white/15 text-white focus:border-[#FF6600] outline-none"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value} className="bg-[#181818] text-white">
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-[#181818] border border-white/15 text-white focus:border-[#FF6600] outline-none placeholder-white/20"
                        placeholder="Brief summary of your issue"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                        Message
                      </label>
                      <textarea
                        required
                        maxLength={2000}
                        rows={4}
                        value={form.message}
                        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                        className="w-full px-3 py-2 text-xs bg-[#181818] border border-white/15 text-white focus:border-[#FF6600] outline-none placeholder-white/20 resize-none"
                        placeholder="Explain your issue in detail…"
                      />
                    </div>

                    {error && (
                      <p className="text-xs text-red-400 font-medium">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={sending || limitReached}
                      className="btn-kefir w-full py-2.5 flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                    >
                      {sending ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <PaperPlaneTilt size={14} weight="bold" />
                      )}
                      <span>{limitReached ? 'Limit Reached' : sending ? 'Sending…' : 'Submit Ticket'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── MY TICKETS VIEW ──────────────────────────────── */}
            {view === 'mytickets' && (
              <div className="p-3 space-y-2">
                {loadingTickets ? (
                  <div className="p-8 text-center">
                    <CircleNotch size={20} className="animate-spin text-[#FF6600] mx-auto" />
                    <p className="text-xs text-white/40 mt-2">Loading tickets…</p>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40 space-y-2">
                    <Ticket size={28} className="mx-auto text-white/20" />
                    <p>No support tickets yet.</p>
                    <button
                      onClick={() => setView('new')}
                      className="btn-kefir text-[11px] py-1.5 px-3 mt-2"
                    >
                      Open a Ticket
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {tickets.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openThread(t)}
                        className="w-full p-3 bg-[#161616] hover:bg-[#1A1A1A] border border-white/10 hover:border-[#FF6600]/50 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-white truncate flex-1 group-hover:text-[#FF6600] transition-colors">
                            {t.subject}
                          </p>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${
                              STATUS_COLORS[t.status] || STATUS_COLORS.open
                            }`}
                          >
                            {STATUS_LABELS[t.status] || t.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-white/40 mt-1 font-mono">
                          <span>{t.ticket_number}</span>
                          <span>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── THREAD VIEW ─────────────────────────────────── */}
            {view === 'thread' && activeTicket && (
              <div className="flex flex-col h-full">
                <div className="px-4 py-2.5 bg-[#161616] border-b border-white/10 flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-white truncate">{activeTicket.subject}</p>
                    <p className="text-[10px] font-mono text-white/40">{activeTicket.ticket_number}</p>
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
                      STATUS_COLORS[activeTicket.status] || STATUS_COLORS.open
                    }`}
                  >
                    {STATUS_LABELS[activeTicket.status] || activeTicket.status}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: '280px' }}>
                  {(activeTicket.messages || []).map((msg, i) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] p-3 text-xs leading-relaxed border ${
                            isUser
                              ? 'bg-[#181818] border-white/15 text-white'
                              : 'bg-[#FF6600]/10 border-[#FF6600]/30 text-white'
                          }`}
                        >
                          <p
                            className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                              isUser ? 'text-white/50' : 'text-[#FF6600]'
                            }`}
                          >
                            {msg.sender === 'support' ? '⚡ Vakar Support' : (msg.author_name || 'You')}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeTicket.status !== 'closed' ? (
                  <form onSubmit={submitReply} className="border-t border-white/10 p-2.5 bg-[#161616] flex gap-2">
                    <input
                      type="text"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-[#111111] border border-white/15 text-white focus:border-[#FF6600] outline-none placeholder-white/30"
                      placeholder="Type your reply…"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !reply.trim()}
                      className="btn-kefir px-3 py-1.5 text-xs flex items-center justify-center disabled:opacity-40"
                    >
                      {sendingReply ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} weight="bold" />}
                    </button>
                  </form>
                ) : (
                  <div className="border-t border-white/10 p-2.5 bg-[#161616] text-center text-xs text-white/40 italic">
                    This ticket is closed.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
