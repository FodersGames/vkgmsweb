import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { getWebsiteSettings } from '../utils/publicCache';
import {
  PaperPlaneTilt, ChatCircle, EnvelopeSimple, Ticket, CheckCircle,
  CircleNotch, CaretDown, CaretUp, Clock, Warning
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';
const DEFAULT_SUPPORT_EMAIL = 'support@vakargames.com';

const CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'billing', label: 'Billing / Purchase' },
  { value: 'account', label: 'Account' },
];

/* Input style shorthand */
const inputStyle = {
  backgroundColor: '#0D0D0D',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#FFFFFF',
  borderRadius: 0,
  outline: 'none',
};

const Contact = () => {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('new'); // 'new' | 'tickets'
  const [form, setForm] = useState({ subject: '', category: 'general', message: '', email: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [expandedTicketNumber, setExpandedTicketNumber] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState('');

  const limitReached = openCount >= 3;

  useEffect(() => { document.title = 'Contact — Vakar Games'; }, []);

  useEffect(() => {
    getWebsiteSettings()
      .then(data => { if (data.support_email) setSupportEmail(data.support_email); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, email: user.email }));
  }, [user]);

  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setLoadingTickets(true);
    try {
      const res = await axios.get(`${API_URL}/api/tickets/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const list = res.data.tickets || [];
      setTickets(list);
      setOpenCount(res.data.open_count ?? list.filter(t => t.status !== 'closed').length);
    } catch {
      // silent
    } finally {
      setLoadingTickets(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchTickets();
  }, [token, fetchTickets]);

  useEffect(() => {
    const viewParam = searchParams.get('view') || searchParams.get('tab');
    if (viewParam === 'tickets') setActiveView('tickets');

    const category = searchParams.get('category');
    const subject   = searchParams.get('subject');
    const message   = searchParams.get('message');
    if (!category && !subject && !message) return;
    setForm(f => ({
      ...f,
      category: CATEGORIES.some(c => c.value === category) ? category : f.category,
      subject:  subject || f.subject,
      message:  message || f.message,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (limitReached) {
      setError('Ticket ouvert maximum atteint (3/3).');
      return;
    }
    setSending(true);
    setError('');
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await axios.post(`${API_URL}/api/tickets`, form, { headers });
      setSuccess(r.data.ticket_number);
      setForm(f => ({ ...f, subject: '', message: '' }));
      fetchTickets();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (e, ticketNumber) => {
    e.preventDefault();
    if (!replyContent.trim() || !token) return;
    setSendingReply(true);
    setReplyError('');
    try {
      await axios.post(`${API_URL}/api/tickets/${ticketNumber}/reply`, { content: replyContent }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReplyContent('');
      await fetchTickets();
    } catch (err) {
      setReplyError(err.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav />

      <div style={{ flex: 1, paddingTop: '60px' }}>
        {/* Header */}
        <div style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '4rem 0' }}>
          <div className="max-w-[1100px] mx-auto px-6">
            <p className="kefir-label mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Support</p>
            <h1
              className="font-black uppercase text-white"
              style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              Contact & Support
            </h1>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '42ch' }}>
              We're here to help. Fill out the form below and we'll get back to you as soon as possible.
            </p>
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Area */}
          <div className="lg:col-span-2">
            {/* View Switcher */}
            <div className="flex items-center gap-4 mb-6 border-b border-white/[0.08] pb-3">
              <button
                type="button"
                onClick={() => { setActiveView('new'); setSuccess(''); setError(''); }}
                className="flex items-center gap-2 pb-2 text-xs font-bold uppercase tracking-wider transition-colors"
                style={{
                  color: activeView === 'new' ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                  borderBottom: activeView === 'new' ? '2px solid #FF6600' : '2px solid transparent',
                  marginBottom: '-13px',
                }}
              >
                <PaperPlaneTilt size={14} />
                Nouveau Ticket
              </button>

              {token && (
                <button
                  type="button"
                  onClick={() => { setActiveView('tickets'); setSuccess(''); setError(''); }}
                  className="flex items-center gap-2 pb-2 text-xs font-bold uppercase tracking-wider transition-colors"
                  style={{
                    color: activeView === 'tickets' ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    borderBottom: activeView === 'tickets' ? '2px solid #FF6600' : '2px solid transparent',
                    marginBottom: '-13px',
                  }}
                >
                  <Ticket size={14} />
                  <span>Mes Tickets</span>
                  <span
                    className="px-2 py-0.5 text-[10px] font-mono font-bold rounded"
                    style={{
                      backgroundColor: limitReached ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 102, 0, 0.15)',
                      color: limitReached ? '#F87171' : '#FF6600',
                    }}
                  >
                    {openCount}/3
                  </span>
                </button>
              )}
            </div>

            {/* View 1: New Ticket */}
            {activeView === 'new' ? (
              success ? (
                <div
                  className="p-10 text-center"
                  style={{ backgroundColor: '#111111', border: '1px solid rgba(255, 102, 0,0.2)' }}
                >
                  <CheckCircle size={40} style={{ color: '#FF6600', margin: '0 auto 1rem' }} />
                  <h2 className="font-black uppercase text-white text-xl tracking-tight mb-2">
                    Ticket Submitted!
                  </h2>
                  <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Your reference: <strong className="text-white">{success}</strong>
                  </p>
                  <p className="text-xs mt-3 mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    We'll reply as soon as possible.
                  </p>
                  {token && (
                    <button
                      type="button"
                      onClick={() => { setActiveView('tickets'); setSuccess(''); }}
                      className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide mb-4"
                      style={{ color: '#FF6600', fontSize: '0.7rem' }}
                    >
                      <Ticket size={14} /> Voir mes tickets ({openCount}/3)
                    </button>
                  )}
                  <button
                    onClick={() => setSuccess('')}
                    className="block mx-auto mt-3 text-xs uppercase tracking-wide transition-colors"
                    style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <div
                  className="p-8"
                  style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-black uppercase text-white text-lg tracking-tight">
                      Send Us a Message
                    </h2>
                    {token && (
                      <span className="text-xs font-mono" style={{ color: limitReached ? '#F87171' : 'rgba(255,255,255,0.4)' }}>
                        Tickets ouverts: {openCount}/3
                      </span>
                    )}
                  </div>

                  {limitReached && (
                    <div className="p-4 mb-6 bg-red-500/10 border border-red-500/30 text-red-400">
                      <div className="flex items-center gap-2 font-bold uppercase text-xs tracking-wider mb-1">
                        <Warning size={16} /> Ticket ouvert maximum atteint ({openCount}/3)
                      </div>
                      <p className="text-xs text-red-300/80 leading-relaxed">
                        Vous avez atteint la limite de 3 tickets ouverts simultanés. Veuillez attendre la résolution d'un de vos tickets avant d'en créer un nouveau.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveView('tickets')}
                        className="mt-3 text-xs font-bold uppercase tracking-wider text-white underline hover:text-[#FF6600]"
                      >
                        Consulter mes tickets en cours →
                      </button>
                    </div>
                  )}

                  {!token ? (
                    <div className="text-center py-10 space-y-4">
                      <p className="font-bold uppercase text-white tracking-wide" style={{ fontSize: '0.8rem' }}>Account Required</p>
                      <p className="text-xs leading-relaxed mx-auto max-w-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        You need to be signed in to open a support ticket. This helps us track your request and reply faster.
                      </p>
                      <Link to="/login" className="btn-kefir inline-flex">
                        Sign in or Create Account
                      </Link>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Your email
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          readOnly
                          className="w-full px-3 py-2.5 text-sm"
                          style={{ ...inputStyle, opacity: 0.5 }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Category
                        </label>
                        <select
                          value={form.category}
                          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm"
                          style={inputStyle}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Subject
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={form.subject}
                          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm"
                          style={inputStyle}
                          placeholder="Brief description of your issue"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Message
                        </label>
                        <textarea
                          required
                          maxLength={2000}
                          rows={6}
                          value={form.message}
                          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm resize-none"
                          style={inputStyle}
                          placeholder="Describe your issue in detail…"
                        />
                      </div>
                      {error && <p className="text-xs text-red-400">{error}</p>}
                      <button
                        type="submit"
                        disabled={sending || limitReached}
                        className="btn-kefir disabled:opacity-50"
                      >
                        {sending ? <CircleNotch size={14} className="animate-spin mr-2" /> : <PaperPlaneTilt size={14} className="mr-2" />}
                        {limitReached ? 'Ticket ouvert maximum atteint' : (sending ? 'Sending…' : 'Send Message')}
                      </button>
                    </form>
                  )}
                </div>
              )
            ) : (
              /* View 2: Mes Tickets */
              <div style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)', padding: '2rem' }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-black uppercase text-white text-lg tracking-tight">
                      Mes Tickets Ouverts
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Tickets actifs: <strong className={limitReached ? 'text-red-400' : 'text-white'}>{openCount}/3</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={limitReached}
                    onClick={() => setActiveView('new')}
                    className="btn-kefir disabled:opacity-40"
                    style={{ fontSize: '0.65rem', padding: '0.45rem 0.8rem' }}
                  >
                    + Nouveau Ticket
                  </button>
                </div>

                {limitReached && (
                  <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                    Ticket ouvert maximum atteint ({openCount}/3).
                  </div>
                )}

                {loadingTickets ? (
                  <div className="py-12 text-center">
                    <CircleNotch size={24} className="animate-spin text-[#FF6600] mx-auto mb-2" />
                    <p className="text-xs text-white/40">Chargement des tickets...</p>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="py-12 text-center">
                    <Ticket size={32} className="text-white/20 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-white mb-1">Aucun ticket pour l'instant</p>
                    <p className="text-xs text-white/40 mb-4">Vous n'avez pas de ticket de support.</p>
                    <button
                      type="button"
                      onClick={() => setActiveView('new')}
                      className="btn-kefir"
                    >
                      Ouvrir un ticket
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map(t => {
                      const isExpanded = expandedTicketNumber === t.ticket_number;
                      const isClosed = t.status === 'closed';
                      const statusColor = t.status === 'open' ? '#FF6600' : t.status === 'in_progress' ? '#F59E0B' : '#6E6E73';
                      const statusLabel = t.status === 'open' ? 'Ouvert' : t.status === 'in_progress' ? 'En cours' : 'Fermé';

                      return (
                        <div
                          key={t.ticket_number}
                          style={{
                            backgroundColor: '#0D0D0D',
                            border: `1px solid ${isExpanded ? 'rgba(255, 102, 0,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          <div
                            onClick={() => setExpandedTicketNumber(isExpanded ? null : t.ticket_number)}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-xs font-mono font-bold text-[#FF6600]">{t.ticket_number}</span>
                                <span className="text-[10px] uppercase font-bold text-white/30">• {t.category}</span>
                                <span
                                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                                  style={{ backgroundColor: `${statusColor}1A`, color: statusColor }}
                                >
                                  {statusLabel}
                                </span>
                                <span className="text-[10px] text-white/30 ml-auto">
                                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-white truncate">
                                {t.subject}
                              </h3>
                            </div>
                            <div className="text-white/40">
                              {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-4 border-t border-white/[0.06] bg-[#0A0A0A] space-y-4">
                              {/* Messages list */}
                              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {(t.messages || []).map((m, idx) => {
                                  const isUser = m.sender === 'user';
                                  return (
                                    <div
                                      key={idx}
                                      className={`p-3 text-xs ${
                                        isUser
                                          ? 'bg-white/[0.03] border border-white/[0.06] ml-0 mr-8'
                                          : 'bg-[#FF6600]/[0.08] border border-[#FF6600]/20 mr-0 ml-8'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-[11px]" style={{ color: isUser ? '#FFFFFF' : '#FF6600' }}>
                                          {m.author_name || (isUser ? 'Vous' : 'Support')}
                                        </span>
                                        <span className="text-[10px] text-white/30">
                                          {m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}
                                        </span>
                                      </div>
                                      <p className="text-white/80 whitespace-pre-wrap leading-relaxed">
                                        {m.content}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Reply form */}
                              {!isClosed ? (
                                <form onSubmit={(e) => handleReply(e, t.ticket_number)} className="space-y-3 pt-2">
                                  <textarea
                                    required
                                    rows={3}
                                    value={replyContent}
                                    onChange={e => setReplyContent(e.target.value)}
                                    placeholder="Répondre au ticket..."
                                    className="w-full px-3 py-2 text-xs resize-none"
                                    style={inputStyle}
                                  />
                                  {replyError && <p className="text-xs text-red-400">{replyError}</p>}
                                  <div className="flex justify-end">
                                    <button
                                      type="submit"
                                      disabled={sendingReply || !replyContent.trim()}
                                      className="btn-kefir disabled:opacity-50"
                                      style={{ fontSize: '0.7rem', padding: '0.45rem 1rem' }}
                                    >
                                      {sendingReply ? <CircleNotch size={12} className="animate-spin mr-1.5" /> : <PaperPlaneTilt size={12} className="mr-1.5" />}
                                      {sendingReply ? 'Envoi…' : 'Envoyer la réponse'}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <p className="text-xs text-white/30 italic text-center py-2">
                                  Ce ticket est fermé. Les réponses ne sont plus acceptées.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar info */}
          <div className="space-y-2">
            <div
              className="p-5"
              style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <EnvelopeSimple size={14} style={{ color: '#FF6600' }} />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">Email</h3>
              </div>
              <a
                href={`mailto:${supportEmail}`}
                className="text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#FF6600'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >
                {supportEmail}
              </a>
            </div>

            <div
              className="p-5"
              style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <ChatCircle size={14} style={{ color: '#FF6600' }} />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">Chat Support</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                The chat bubble at the bottom right of every page lets you open a ticket or track your existing requests instantly.
              </p>
            </div>

            {token && (
              <div
                className="p-5 cursor-pointer hover:border-white/20 transition-colors"
                style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
                onClick={() => { setActiveView('tickets'); setSuccess(''); }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Ticket size={14} style={{ color: '#FF6600' }} />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">Mes Tickets</h3>
                </div>
                <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Tickets ouverts: <strong className={limitReached ? 'text-red-400' : 'text-white'}>{openCount}/3</strong>
                </p>
                <button
                  type="button"
                  className="text-[10px] font-bold uppercase tracking-wide transition-colors"
                  style={{ color: '#FF6600', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  Voir mes tickets →
                </button>
              </div>
            )}

            <div
              className="p-5"
              style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white mb-1.5">Response Time</p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                We typically respond within <strong className="text-white/60">24–48 hours</strong> during business days.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Contact;
