import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { getWebsiteSettings } from '../utils/publicCache';
import {
  PaperPlaneTilt, ChatCircle, EnvelopeSimple, Ticket, CheckCircle,
  CircleNotch, CaretDown, CaretUp, Clock, Warning, LockKey
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';
const DEFAULT_SUPPORT_EMAIL = 'support@vakargames.com';

const CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'billing', label: 'Billing / Purchase' },
  { value: 'account', label: 'Account' },
];

const inputClass = "w-full px-3.5 py-2.5 text-sm bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg text-[#1D1D1F] focus:outline-none focus:border-[#1D1D1F] transition-colors";

const Contact = () => {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('new');
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

  useEffect(() => { document.title = 'Contact | Vakar Games'; }, []);

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
  }, [searchParams]);

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
    <div className="bg-white text-[#1D1D1F] min-h-screen flex flex-col">
      <PublicNav />

      <div className="flex-1">
        {/* Header: Apple Clean White */}
        <div className="pt-28 pb-12 border-b border-[#E5E5EA]">
          <div className="max-w-[1120px] mx-auto px-6">
            <p className="text-[13px] font-medium text-[#FF6600] mb-2">
              Support
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F]">
              Contact & Support
            </h1>
            <p className="mt-3 text-base md:text-lg text-[#6E6E73] max-w-xl">
              We're here to help. Reach out to our team or open a support ticket.
            </p>
          </div>
        </div>

        <div className="max-w-[1120px] mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Area */}
          <div className="lg:col-span-2">
            {/* View Switcher */}
            <div className="flex items-center gap-6 mb-8 border-b border-[#E5E5EA] pb-3">
              <button
                type="button"
                onClick={() => { setActiveView('new'); setSuccess(''); setError(''); }}
                className={`flex items-center gap-2 pb-2 text-sm font-medium transition-colors border-b-2 -mb-[13px] ${
                  activeView === 'new'
                    ? 'border-[#1D1D1F] text-[#1D1D1F]'
                    : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                <PaperPlaneTilt size={16} />
                <span>Nouveau Ticket</span>
              </button>

              {token && (
                <button
                  type="button"
                  onClick={() => { setActiveView('tickets'); setSuccess(''); setError(''); }}
                  className={`flex items-center gap-2 pb-2 text-sm font-medium transition-colors border-b-2 -mb-[13px] ${
                    activeView === 'tickets'
                      ? 'border-[#1D1D1F] text-[#1D1D1F]'
                      : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
                  }`}
                >
                  <Ticket size={16} />
                  <span>Mes Tickets</span>
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                    limitReached ? 'bg-red-100 text-red-700' : 'bg-[#E5E5EA] text-[#1D1D1F]'
                  }`}>
                    {openCount}/3
                  </span>
                </button>
              )}
            </div>

            {/* View 1: New Ticket */}
            {activeView === 'new' ? (
              success ? (
                <div className="bg-[#F5F5F7] rounded-2xl p-12 text-center border border-[#E5E5EA]">
                  <CheckCircle size={44} className="mx-auto mb-4 text-[#FF6600]" />
                  <h2 className="text-2xl font-semibold text-[#1D1D1F] mb-2">
                    Ticket Submitted
                  </h2>
                  <p className="text-sm text-[#6E6E73] mb-1">
                    Your reference: <strong className="text-[#1D1D1F]">{success}</strong>
                  </p>
                  <p className="text-xs text-[#86868B] mt-2 mb-6">
                    We'll reply as soon as possible.
                  </p>
                  {token && (
                    <button
                      type="button"
                      onClick={() => { setActiveView('tickets'); setSuccess(''); }}
                      className="btn-apple mr-3"
                    >
                      <Ticket size={14} className="mr-1.5" /> Voir mes tickets ({openCount}/3)
                    </button>
                  )}
                  <button
                    onClick={() => setSuccess('')}
                    className="text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] mt-4 block mx-auto transition-colors"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <div className="bg-[#F5F5F7] rounded-2xl p-8 sm:p-10 border border-[#E5E5EA]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-[#1D1D1F]">
                      Send Us a Message
                    </h2>
                    {token && (
                      <span className="text-xs font-medium text-[#86868B]">
                        Tickets ouverts: {openCount}/3
                      </span>
                    )}
                  </div>

                  {limitReached && (
                    <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                      <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                        <Warning size={16} /> Ticket ouvert maximum atteint ({openCount}/3)
                      </div>
                      <p className="text-xs text-red-600 leading-relaxed">
                        Vous avez atteint la limite de 3 tickets ouverts simultanés. Veuillez attendre la résolution d'un de vos tickets avant d'en créer un nouveau.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveView('tickets')}
                        className="mt-3 text-xs font-medium underline text-red-700"
                      >
                        Consulter mes tickets en cours &rarr;
                      </button>
                    </div>
                  )}

                  {!token ? (
                    <div className="p-8 sm:p-12 text-center rounded-2xl bg-white border border-[#E5E5EA] space-y-4">
                      <div className="w-12 h-12 mx-auto rounded-full bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600]">
                        <LockKey size={24} weight="bold" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-[#1D1D1F]">
                          Sign In to Open a Ticket
                        </h3>
                        <p className="text-sm text-[#6E6E73] max-w-sm mx-auto mt-1">
                          You need an account to open a support ticket so we can track and notify you of updates.
                        </p>
                      </div>
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link to="/login" className="btn-apple">
                          Sign In or Register
                        </Link>
                        <a href={`mailto:${supportEmail}`} className="btn-apple-outline">
                          Email Directly
                        </a>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
                          Your email
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          readOnly
                          className={`${inputClass} opacity-60`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
                          Category
                        </label>
                        <select
                          value={form.category}
                          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          className={inputClass}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
                          Subject
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={form.subject}
                          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                          className={inputClass}
                          placeholder="Brief description of your issue"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
                          Message
                        </label>
                        <textarea
                          required
                          maxLength={2000}
                          rows={5}
                          value={form.message}
                          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                          className={`${inputClass} resize-none`}
                          placeholder="Describe your issue in detail…"
                        />
                      </div>
                      {error && <p className="text-xs text-red-500">{error}</p>}
                      <button
                        type="submit"
                        disabled={sending || limitReached}
                        className="btn-apple disabled:opacity-50"
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
              <div className="bg-[#F5F5F7] rounded-2xl p-8 border border-[#E5E5EA]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[#1D1D1F]">
                      Mes Tickets Ouverts
                    </h2>
                    <p className="text-xs text-[#86868B] mt-0.5">
                      Tickets actifs: <strong className={limitReached ? 'text-red-500' : 'text-[#1D1D1F]'}>{openCount}/3</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={limitReached}
                    onClick={() => setActiveView('new')}
                    className="btn-apple !py-1.5 !px-3 text-xs disabled:opacity-40"
                  >
                    + Nouveau Ticket
                  </button>
                </div>

                {limitReached && (
                  <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg">
                    Ticket ouvert maximum atteint ({openCount}/3).
                  </div>
                )}

                {loadingTickets ? (
                  <div className="py-16 text-center text-[#86868B]">
                    <CircleNotch size={24} className="animate-spin text-[#FF6600] mx-auto mb-2" />
                    <p className="text-xs">Chargement des tickets...</p>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="py-16 text-center">
                    <Ticket size={36} className="text-[#86868B] mx-auto mb-3" />
                    <p className="text-base font-semibold text-[#1D1D1F] mb-1">Aucun ticket pour l'instant</p>
                    <p className="text-xs text-[#6E6E73] mb-4">Vous n'avez pas de ticket de support actif.</p>
                    <button
                      type="button"
                      onClick={() => setActiveView('new')}
                      className="btn-apple"
                    >
                      Ouvrir un ticket
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map(t => {
                      const isExpanded = expandedTicketNumber === t.ticket_number;
                      const isClosed = t.status === 'closed';
                      const statusColor = t.status === 'open' ? '#FF6600' : t.status === 'in_progress' ? '#F59E0B' : '#86868B';
                      const statusLabel = t.status === 'open' ? 'Ouvert' : t.status === 'in_progress' ? 'En cours' : 'Fermé';

                      return (
                        <div
                          key={t.ticket_number}
                          className="bg-white rounded-xl border border-[#E5E5EA] overflow-hidden transition-all"
                        >
                          <div
                            onClick={() => setExpandedTicketNumber(isExpanded ? null : t.ticket_number)}
                            className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#FAFAFC] transition-colors"
                          >
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-xs font-mono font-medium text-[#FF6600]">{t.ticket_number}</span>
                                <span className="text-[11px] uppercase font-medium text-[#86868B]">• {t.category}</span>
                                <span
                                  className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
                                >
                                  {statusLabel}
                                </span>
                                <span className="text-[11px] text-[#86868B] ml-auto">
                                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <h3 className="text-sm font-semibold text-[#1D1D1F] truncate">
                                {t.subject}
                              </h3>
                            </div>
                            <div className="text-[#86868B]">
                              {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-5 border-t border-[#E5E5EA] bg-[#FAFAFC] space-y-4">
                              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {(t.messages || []).map((m, idx) => {
                                  const isUser = m.sender === 'user';
                                  return (
                                    <div
                                      key={idx}
                                      className={`p-3.5 text-xs rounded-xl ${
                                        isUser
                                          ? 'bg-white border border-[#E5E5EA] ml-0 mr-8'
                                          : 'bg-[#FF6600]/10 border border-[#FF6600]/25 mr-0 ml-8'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-[11px]" style={{ color: isUser ? '#1D1D1F' : '#FF6600' }}>
                                          {m.author_name || (isUser ? 'Vous' : 'Support')}
                                        </span>
                                        <span className="text-[10px] text-[#86868B]">
                                          {m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}
                                        </span>
                                      </div>
                                      <p className="text-[#1D1D1F]/90 whitespace-pre-wrap leading-relaxed">
                                        {m.content}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>

                              {!isClosed ? (
                                <form onSubmit={(e) => handleReply(e, t.ticket_number)} className="space-y-3 pt-2">
                                  <textarea
                                    required
                                    rows={3}
                                    value={replyContent}
                                    onChange={e => setReplyContent(e.target.value)}
                                    placeholder="Répondre au ticket..."
                                    className={`${inputClass} resize-none`}
                                  />
                                  {replyError && <p className="text-xs text-red-500">{replyError}</p>}
                                  <div className="flex justify-end">
                                    <button
                                      type="submit"
                                      disabled={sendingReply || !replyContent.trim()}
                                      className="btn-apple text-xs !py-1.5 !px-3 disabled:opacity-50"
                                    >
                                      {sendingReply ? <CircleNotch size={12} className="animate-spin mr-1.5" /> : <PaperPlaneTilt size={12} className="mr-1.5" />}
                                      {sendingReply ? 'Envoi…' : 'Envoyer la réponse'}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <p className="text-xs text-[#86868B] italic text-center py-2">
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
          <div className="space-y-4">
            <div className="p-6 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E5EA] flex items-center justify-center text-[#FF6600]">
                  <EnvelopeSimple size={16} weight="bold" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">Direct Email</h3>
              </div>
              <a
                href={`mailto:${supportEmail}`}
                className="text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
              >
                {supportEmail}
              </a>
            </div>

            <div className="p-6 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E5EA] flex items-center justify-center text-[#FF6600]">
                  <ChatCircle size={16} weight="bold" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">Live Support Widget</h3>
              </div>
              <p className="text-xs leading-relaxed text-[#6E6E73]">
                The floating support launcher at the bottom right allows you to track ongoing tickets or create new ones anytime.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7]">
              <div className="flex items-center gap-2 mb-2 text-[#6E6E73]">
                <Clock size={16} />
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">Response Time</p>
              </div>
              <p className="text-xs leading-relaxed text-[#6E6E73]">
                We typically respond within <strong className="text-[#1D1D1F] font-semibold">24–48 hours</strong> during business days.
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
