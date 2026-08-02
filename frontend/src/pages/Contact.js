import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { PublicButton } from '../ui/PublicButton';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { Select } from '../ui';
import { PaperPlaneTilt, ChatCircle, EnvelopeSimple, Ticket, CheckCircle, CircleNotch } from '@phosphor-icons/react';
import chapelSunset from '../assets/photos/chapel-sunset.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const DEFAULT_SUPPORT_EMAIL = 'support@vakargames.com';

const CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'billing', label: 'Billing / Purchase' },
  { value: 'account', label: 'Account' },
];

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

  // Pre-fill from URL params (e.g. the in-game ban-appeal button links here directly)
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
    <div className="bg-[#F5F5F7] min-h-screen flex flex-col">
      <PublicNav />

      <div className="flex-1 pt-[52px]">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-[#D2D2D7] py-20 px-6">
          <img src={chapelSunset} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1D1D1F] via-[#1D1D1F]/70 to-[#1D1D1F]/30" />
          <Reveal className="relative max-w-6xl mx-auto">
            <p className="text-[12px] font-mono text-[#4ECDC4] mb-3">// support</p>
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.02em] text-white">
              Contact &amp; support
            </h1>
            <p className="text-[#D2D2D7] mt-4 max-w-md text-sm leading-relaxed">
              We're here to help. Fill out the form below and we'll get back to you as soon as possible.
            </p>
          </Reveal>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Form */}
          <div className="lg:col-span-2">
            {success ? (
              <div className="rounded-xl bg-white border border-[#D2D2D7] p-10 text-center">
                <CheckCircle size={40} className="text-[#4ECDC4] mx-auto mb-4" />
                <h2 className="text-xl font-bold text-[#1D1D1F] mb-2">
                  Ticket submitted!
                </h2>
                <p className="text-sm text-[#6E6E73] mb-1">
                  Your reference: <strong className="text-[#1D1D1F]">{success}</strong>
                </p>
                <p className="text-xs text-[#A1A1A6] mt-3 mb-6">
                  We'll reply by email as soon as possible.
                </p>
                {token && (
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#4ECDC4] hover:underline"
                  >
                    <Ticket size={14} /> View my tickets
                  </Link>
                )}
                <button
                  onClick={() => setSuccess('')}
                  className="block mx-auto mt-3 text-xs text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-white border border-[#D2D2D7] p-8">
                <h2 className="text-lg font-bold text-[#1D1D1F] mb-6">Send us a message</h2>
                {!token ? (
                  <div className="text-center py-10 space-y-4">
                    <p className="text-sm font-semibold text-[#1D1D1F]">Account required</p>
                    <p className="text-xs text-[#6E6E73] max-w-xs mx-auto leading-relaxed">You need to be signed in to open a support ticket. This helps us track your request and reply faster.</p>
                    <PublicButton as="a" href="/login">
                      Sign in or create account
                    </PublicButton>
                  </div>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">Your email</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      readOnly
                      className="rounded-xl w-full px-3 py-2.5 text-sm border border-[#D2D2D7] bg-[#F5F5F7] text-[#6E6E73]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">Category</label>
                    <Select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">Subject</label>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      className="rounded-lg w-full px-3 py-2.5 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F]"
                      placeholder="Brief description of your issue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">Message</label>
                    <textarea
                      required
                      maxLength={2000}
                      rows={6}
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="rounded-lg w-full px-3 py-2.5 text-sm border border-[#D2D2D7] focus:outline-none focus:border-[#4ECDC4] bg-white text-[#1D1D1F] resize-none"
                      placeholder="Describe your issue in detail…"
                    />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <PublicButton type="submit" disabled={sending} size="lg">
                    {sending ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} />}
                    {sending ? 'Sending…' : 'Send message'}
                  </PublicButton>
                </form>
                )}
              </div>
            )}
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg w-8 h-8 bg-[#4ECDC4]/10 flex items-center justify-center">
                  <EnvelopeSimple size={14} className="text-[#4ECDC4]" />
                </div>
                <h3 className="text-sm font-bold text-[#1D1D1F]">Email</h3>
              </div>
              <a
                href={`mailto:${supportEmail}`}
                className="text-sm text-[#6E6E73] hover:text-[#4ECDC4] transition-colors"
              >
                {supportEmail}
              </a>
            </div>

            <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg w-8 h-8 bg-[#4ECDC4]/10 flex items-center justify-center">
                  <ChatCircle size={14} className="text-[#4ECDC4]" />
                </div>
                <h3 className="text-sm font-bold text-[#1D1D1F]">Chat support</h3>
              </div>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                The chat bubble at the bottom right of every page lets you open a ticket or track your existing requests instantly.
              </p>
            </div>

            {token && (
              <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-lg w-8 h-8 bg-[#4ECDC4]/10 flex items-center justify-center">
                    <Ticket size={14} className="text-[#4ECDC4]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">My tickets</h3>
                </div>
                <Link
                  to="/profile"
                  className="text-sm font-semibold text-[#4ECDC4] hover:underline"
                >
                  View ticket history →
                </Link>
              </div>
            )}

            <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
              <p className="text-xs font-semibold text-[#1D1D1F] mb-1.5">Response time</p>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                We typically respond within <strong>24–48 hours</strong> during business days.
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
