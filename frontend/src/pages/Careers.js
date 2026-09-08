import React, { useState, useEffect } from 'react';
import { MapPin, Briefcase, CaretDown, CaretUp, PaperPlaneTilt, X, CheckCircle, Warning, Users, CircleNotch } from '@phosphor-icons/react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { ToolIcon, TOOL_LABELS, DEPARTMENTS, departmentColor } from '../constants/careers';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const inputStyle = {
  backgroundColor: '#0D0D0D',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#FFFFFF',
  borderRadius: 0,
  outline: 'none',
};

function ApplyModal({ career, onClose, token, user }) {
  const [name, setName] = useState(user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '') : '');
  const [email, setEmail] = useState(user?.email || '');
  const [portfolio, setPortfolio] = useState('');
  const [cover, setCover] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cover.trim()) { setError('Please write a short cover letter.'); return; }
    setSending(true);
    setError('');
    try {
      const message = [
        `Position: ${career.title}`,
        `Department: ${career.department}`,
        `Contract: ${career.contract_type}`,
        ``,
        `Applicant: ${name}`,
        `Email: ${email}`,
        portfolio ? `Portfolio: ${portfolio}` : null,
        ``,
        `Cover letter:`,
        cover,
      ].filter(l => l !== null).join('\n');

      const res = await fetch(`${API}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: `[Recruitment] ${career.title}`,
          category: 'recruitment',
          message,
          career_id: career._id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send application. Please try again.');
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const deptColor = departmentColor(career.department);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="animate-appear w-full max-w-lg overflow-hidden bg-[#111111] border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#141414]">
          <div>
            <p className="text-[10px] font-mono font-bold tracking-widest uppercase mb-1" style={{ color: deptColor }}>// {career.department}</p>
            <h3 className="font-black uppercase text-base text-white tracking-tight">{career.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle size={40} className="mx-auto mb-4 text-[#4ECDC4]" />
            <h4 className="font-black uppercase text-white text-lg tracking-tight mb-2">Application Sent!</h4>
            <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
              We'll review your application and get back to you by email as soon as possible.
            </p>
            <button
              onClick={onClose}
              className="btn-kefir"
              style={{ fontSize: '0.75rem', padding: '0.5rem 1.5rem' }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            {!token && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2 font-medium">
                <Warning size={14} className="shrink-0 text-amber-400" />
                <span>You must be signed in to apply. <a href="/login" className="font-bold underline text-white ml-1 hover:text-[#4ECDC4]">Sign in</a></span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Name</label>
                <input
                  required
                  className="w-full px-3 py-2 text-sm"
                  style={inputStyle}
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  className="w-full px-3 py-2 text-sm"
                  style={{ ...inputStyle, opacity: user ? 0.6 : 1 }}
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  readOnly={!!user}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                Portfolio / Links <span className="normal-case font-normal text-white/30">(optional)</span>
              </label>
              <input
                className="w-full px-3 py-2 text-sm"
                style={inputStyle}
                value={portfolio} onChange={e => setPortfolio(e.target.value)}
                placeholder="https://your-portfolio.com or GitHub / ArtStation"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                Cover letter <span className="text-[#4ECDC4]">*</span>
              </label>
              <textarea
                required
                rows={5}
                className="w-full px-3 py-2 text-sm resize-none"
                style={inputStyle}
                value={cover} onChange={e => setCover(e.target.value)}
                placeholder="Tell us about yourself, your experience, and why you want to join Vakar Games..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <Warning size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                className="text-xs uppercase tracking-wider text-white/40 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !token}
                className="btn-kefir disabled:opacity-40"
              >
                {sending ? <CircleNotch size={14} className="animate-spin mr-2" /> : <PaperPlaneTilt size={14} className="mr-2" />}
                {sending ? 'Sending…' : 'Send Application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Careers() {
  const { user, token } = useAuth();
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState(null);
  const [applying, setApplying] = useState(null);

  useEffect(() => {
    document.title = 'Careers — Vakar Games';
    fetch(`${API}/api/careers`)
      .then(r => r.json())
      .then(d => setCareers(d.careers || []))
      .catch(() => setCareers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? careers : careers.filter(c => c.department === filter);
  const available = ['All', ...DEPARTMENTS.filter(d => careers.some(c => c.department === d))];

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav />

      {/* Hero */}
      <section style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: '90px', paddingBottom: '3.5rem' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <p className="kefir-label mb-3" style={{ color: '#4ECDC4' }}>// JOIN THE STUDIO</p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1
                className="font-black uppercase text-white"
                style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}
              >
                Build something<br className="hidden sm:block" /> that lasts.
              </h1>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '52ch' }}>
                We're a passionate independent studio crafting memorable games and creative experiences. If you want to contribute to ambitious projects, we'd love to hear from you.
              </p>
            </div>

            {!loading && (
              <div
                className="px-5 py-4 flex items-center gap-3 shrink-0 self-start lg:self-auto"
                style={{ backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Users size={20} style={{ color: '#4ECDC4' }} />
                <div>
                  <p className="font-black text-2xl text-white leading-none">{careers.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Open position{careers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 py-12">
        {/* Department Filters */}
        {!loading && careers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {available.map(dept => {
              const active = filter === dept;
              const color = dept === 'All' ? '#FFFFFF' : departmentColor(dept);
              return (
                <button
                  key={dept}
                  onClick={() => setFilter(dept)}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: active ? (dept === 'All' ? '#FFFFFF' : color) : '#141414',
                    color: active ? '#000000' : 'rgba(255,255,255,0.6)',
                    border: `1px solid ${active ? (dept === 'All' ? '#FFFFFF' : color) : 'rgba(255,255,255,0.08)'}`,
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                    }
                  }}
                >
                  {dept !== 'All' && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: active ? '#000000' : color }}
                    />
                  )}
                  {dept}
                </button>
              );
            })}
          </div>
        )}

        {/* Positions List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-[#141414] border border-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-20 px-6"
            style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(78,205,196,0.1)' }}
            >
              <Users size={26} style={{ color: '#4ECDC4' }} />
            </div>
            <h3 className="font-black uppercase text-lg text-white mb-2">
              {careers.length === 0 ? 'No open positions right now' : 'Nothing in this department'}
            </h3>
            <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {careers.length === 0 ? 'Check back soon, or send an unsolicited application to ' : 'Try another department filter, or reach out at '}
              <a href="mailto:support@vakargames.com" style={{ color: '#4ECDC4' }} className="hover:underline">support@vakargames.com</a>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => {
              const color = departmentColor(c.department);
              const isExpanded = expanded === c._id;
              return (
                <div
                  key={c._id}
                  style={{
                    backgroundColor: '#111111',
                    border: `1px solid ${isExpanded ? 'rgba(78,205,196,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'border-color 0.2s',
                  }}
                >
                  <button
                    type="button"
                    className="w-full text-left p-5 sm:p-6"
                    onClick={() => setExpanded(isExpanded ? null : c._id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Left color bar */}
                      <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: color }} />

                      <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                              {c.department}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="text-[10px] uppercase font-bold text-white/40">
                              {c.contract_type}
                            </span>
                          </div>
                          <h2 className="font-black uppercase text-base sm:text-lg text-white tracking-tight mb-2">
                            {c.title}
                          </h2>
                          <div className="flex items-center flex-wrap gap-4 text-xs text-white/40">
                            <span className="flex items-center gap-1.5">
                              <MapPin size={12} style={{ color: '#4ECDC4' }} />
                              {c.location}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Briefcase size={12} style={{ color: '#4ECDC4' }} />
                              {c.contract_type}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {c.tools?.length > 0 && (
                            <div className="hidden md:flex items-center gap-1.5">
                              {c.tools.slice(0, 4).map(t => (
                                <span key={t} className="opacity-60 hover:opacity-100 transition-opacity">
                                  <ToolIcon toolId={t} size={18} />
                                </span>
                              ))}
                              {c.tools.length > 4 && (
                                <span className="text-[10px] font-mono text-white/30 ml-1">
                                  +{c.tools.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-white/40">
                            {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Position Details */}
                  {isExpanded && (
                    <div
                      className="px-6 pb-6 pt-4 space-y-6"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: '#0E0E0E' }}
                    >
                      {c.description && (
                        <div>
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">About the Role</h3>
                          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                            {c.description}
                          </p>
                        </div>
                      )}

                      {c.requirements?.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">What we're looking for</h3>
                          <ul className="space-y-2">
                            {c.requirements.map((r, i) => (
                              <li key={i} className="flex gap-2.5 text-xs text-white/70">
                                <span className="shrink-0 font-bold" style={{ color }}>—</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {c.tools?.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">Tools & Tech</h3>
                          <div className="flex flex-wrap gap-2">
                            {c.tools.map(t => (
                              <span
                                key={t}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/70"
                                style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
                              >
                                <ToolIcon toolId={t} size={14} />
                                <span>{TOOL_LABELS[t] || t}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setApplying(c)}
                          className="btn-kefir"
                        >
                          <PaperPlaneTilt size={14} className="mr-2" />
                          Apply for this position
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {applying && (
        <ApplyModal
          career={applying}
          onClose={() => setApplying(null)}
          token={token}
          user={user}
        />
      )}

      <SiteFooter />
    </div>
  );
}
