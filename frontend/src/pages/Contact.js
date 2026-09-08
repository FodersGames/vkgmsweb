import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { PaperPlaneTilt, ChatCircle, EnvelopeSimple, Ticket, CheckCircle, CircleNotch } from '@phosphor-icons/react';

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
  const [form, setForm] = useState({ subject: '', category: 'general', message: '', email: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => { document.title = 'Contact — Vakar Games'; }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/settings`)
      .then(r => { if (r.data.support_email) setSupportEmail(r.data.support_email); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, email: user.email }));
  }, [user]);

  useEffect(() => {
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
    setSending(true);
    setError('');
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await axios.post(`${API_URL}/api/tickets`, form, { headers });
      setSuccess(r.data.ticket_number);
      setForm(f => ({ ...f, subject: '', message: '' }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
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
          {/* Form */}
          <div className="lg:col-span-2">
            {success ? (
              <div
                className="p-10 text-center"
                style={{ backgroundColor: '#111111', border: '1px solid rgba(78,205,196,0.2)' }}
              >
                <CheckCircle size={40} style={{ color: '#4ECDC4', margin: '0 auto 1rem' }} />
                <h2 className="font-black uppercase text-white text-xl tracking-tight mb-2">
                  Ticket Submitted!
                </h2>
                <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your reference: <strong className="text-white">{success}</strong>
                </p>
                <p className="text-xs mt-3 mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  We'll reply by email as soon as possible.
                </p>
                {token && (
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide"
                    style={{ color: '#4ECDC4', fontSize: '0.7rem' }}
                  >
                    <Ticket size={14} /> View my tickets
                  </Link>
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
                <h2 className="font-black uppercase text-white text-lg tracking-tight mb-6">
                  Send Us a Message
                </h2>
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
                      disabled={sending}
                      className="btn-kefir disabled:opacity-50"
                    >
                      {sending ? <CircleNotch size={14} className="animate-spin mr-2" /> : <PaperPlaneTilt size={14} className="mr-2" />}
                      {sending ? 'Sending…' : 'Send Message'}
                    </button>
                  </form>
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
                <EnvelopeSimple size={14} style={{ color: '#4ECDC4' }} />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">Email</h3>
              </div>
              <a
                href={`mailto:${supportEmail}`}
                className="text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#4ECDC4'}
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
                <ChatCircle size={14} style={{ color: '#4ECDC4' }} />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">Chat Support</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                The chat bubble at the bottom right of every page lets you open a ticket or track your existing requests instantly.
              </p>
            </div>

            {token && (
              <div
                className="p-5"
                style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Ticket size={14} style={{ color: '#4ECDC4' }} />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">My Tickets</h3>
                </div>
                <Link
                  to="/profile"
                  className="text-[10px] font-bold uppercase tracking-wide transition-colors"
                  style={{ color: '#4ECDC4' }}
                >
                  View ticket history →
                </Link>
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
