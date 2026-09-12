import React, { useState, useEffect } from 'react';
import { MapPin, Briefcase, CaretDown, CaretUp, PaperPlaneTilt, X, CheckCircle, Warning, Users, CircleNotch } from '@phosphor-icons/react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { ToolIcon, TOOL_LABELS, DEPARTMENTS, departmentColor } from '../constants/careers';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="animate-appear w-full max-w-lg overflow-hidden bg-white rounded-2xl border border-[#E5E5EA] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA] bg-[#F5F5F7]">
          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase mb-0.5" style={{ color: deptColor }}>
              {career.department}
            </p>
            <h3 className="font-semibold text-lg text-[#1D1D1F] tracking-tight">{career.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] transition-colors">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle size={44} className="mx-auto mb-4 text-[#FF6600]" />
            <h4 className="font-semibold text-xl text-[#1D1D1F] mb-2">Application Sent</h4>
            <p className="text-sm text-[#6E6E73] mb-6 max-w-xs mx-auto">
              We'll review your application and get back to you by email as soon as possible.
            </p>
            <button
              onClick={onClose}
              className="btn-apple"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            {!token && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-800 rounded-lg flex items-center gap-2 font-medium">
                <Warning size={15} className="shrink-0 text-amber-600" />
                <span>You must be signed in to apply. <a href="/login" className="font-semibold underline text-[#1D1D1F] ml-1">Sign in</a></span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] mb-1.5">Name</label>
                <input
                  required
                  className="w-full px-3 py-2 text-sm bg-[#F5F5F7] border border-[#D2D2D7] rounded-md text-[#1D1D1F] focus:outline-none focus:border-[#1D1D1F]"
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  className="w-full px-3 py-2 text-sm bg-[#F5F5F7] border border-[#D2D2D7] rounded-md text-[#1D1D1F] focus:outline-none focus:border-[#1D1D1F]"
                  style={{ opacity: user ? 0.7 : 1 }}
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  readOnly={!!user}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] mb-1.5">
                Portfolio / Links <span className="normal-case font-normal text-[#86868B]">(optional)</span>
              </label>
              <input
                className="w-full px-3 py-2 text-sm bg-[#F5F5F7] border border-[#D2D2D7] rounded-md text-[#1D1D1F] focus:outline-none focus:border-[#1D1D1F]"
                value={portfolio} onChange={e => setPortfolio(e.target.value)}
                placeholder="https://your-portfolio.com or GitHub / ArtStation"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#6E6E73] mb-1.5">
                Cover letter <span className="text-[#FF6600]">*</span>
              </label>
              <textarea
                required
                rows={5}
                className="w-full px-3 py-2 text-sm bg-[#F5F5F7] border border-[#D2D2D7] rounded-md text-[#1D1D1F] focus:outline-none focus:border-[#1D1D1F] resize-none"
                value={cover} onChange={e => setCover(e.target.value)}
                placeholder="Tell us about yourself, your experience, and why you want to join Vakar Games..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
                <Warning size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#E5E5EA]">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !token}
                className="btn-apple disabled:opacity-40"
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
    <div className="bg-white text-[#1D1D1F] min-h-screen flex flex-col">
      <PublicNav />

      {/* Hero — Apple Clean White */}
      <section className="pt-28 pb-12 border-b border-[#E5E5EA]">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-[#FF6600] mb-2">
                Opportunities
              </p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F]">
                Careers
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#6E6E73] max-w-xl">
                Join our compact, autonomous team in France or remotely. We make games we love, with zero compromises on craft.
              </p>
            </div>

            {!loading && (
              <div className="px-5 py-3.5 flex items-center gap-3 shrink-0 self-start lg:self-auto bg-[#F5F5F7] rounded-xl border border-[#E5E5EA]">
                <Users size={22} className="text-[#FF6600]" />
                <div>
                  <p className="font-semibold text-2xl text-[#1D1D1F] leading-none">{careers.length}</p>
                  <p className="text-[11px] font-medium text-[#86868B] mt-0.5">
                    Open position{careers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-[1120px] mx-auto w-full px-6 py-12">
        {/* Department Filters */}
        {!loading && careers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {available.map(dept => {
              const active = filter === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setFilter(dept)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-[#1D1D1F] text-white'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] border border-[#E5E5EA]'
                  }`}
                >
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
              <div key={i} className="h-24 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-6 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA]">
            <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 rounded-full bg-white text-[#FF6600] shadow-sm">
              <Users size={24} />
            </div>
            <h3 className="font-semibold text-lg text-[#1D1D1F] mb-1">
              {careers.length === 0 ? 'No open positions right now' : 'Nothing in this department'}
            </h3>
            <p className="text-sm text-[#6E6E73] max-w-sm mx-auto leading-relaxed">
              {careers.length === 0 ? 'Check back soon, or send an unsolicited application to ' : 'Try another department filter, or reach out at '}
              <a href="mailto:support@vakargames.com" className="text-[#FF6600] hover:underline font-medium">support@vakargames.com</a>
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
                  className="bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA] overflow-hidden transition-all hover:border-[#D2D2D7]"
                >
                  <button
                    type="button"
                    className="w-full text-left p-6"
                    onClick={() => setExpanded(isExpanded ? null : c._id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />

                      <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
                              {c.department}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#86868B]" />
                            <span className="text-[11px] font-medium text-[#86868B]">
                              {c.contract_type}
                            </span>
                          </div>
                          <h2 className="font-semibold text-lg sm:text-xl text-[#1D1D1F] tracking-tight mb-2">
                            {c.title}
                          </h2>
                          <div className="flex items-center flex-wrap gap-4 text-xs text-[#6E6E73]">
                            <span className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-[#FF6600]" />
                              {c.location}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Briefcase size={13} className="text-[#FF6600]" />
                              {c.contract_type}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {c.tools?.length > 0 && (
                            <div className="hidden md:flex items-center gap-1.5">
                              {c.tools.slice(0, 4).map(t => (
                                <span key={t} className="opacity-70 hover:opacity-100 transition-opacity">
                                  <ToolIcon toolId={t} size={18} />
                                </span>
                              ))}
                              {c.tools.length > 4 && (
                                <span className="text-[11px] text-[#86868B] ml-1 font-medium">
                                  +{c.tools.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-[#86868B]">
                            {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Position Details */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-4 space-y-6 bg-white border-t border-[#E5E5EA]">
                      {c.description && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B] mb-2">About the Role</h3>
                          <p className="text-sm text-[#1D1D1F]/80 leading-relaxed whitespace-pre-wrap">
                            {c.description}
                          </p>
                        </div>
                      )}

                      {c.requirements?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B] mb-3">What we're looking for</h3>
                          <ul className="space-y-2">
                            {c.requirements.map((r, i) => (
                              <li key={i} className="flex gap-2.5 text-xs text-[#1D1D1F]/80">
                                <span className="shrink-0 font-bold" style={{ color }}>—</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {c.tools?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B] mb-3">Tools & Tech</h3>
                          <div className="flex flex-wrap gap-2">
                            {c.tools.map(t => (
                              <span
                                key={t}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#1D1D1F] bg-[#F5F5F7] rounded-md border border-[#E5E5EA]"
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
                          className="btn-apple"
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
