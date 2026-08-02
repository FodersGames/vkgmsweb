import React, { useState, useEffect } from 'react';
import { MapPin, Briefcase, CaretDown, CaretUp, PaperPlaneTilt, X, CheckCircle, Warning } from '@phosphor-icons/react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { PublicButton } from '../ui/PublicButton';
import { ToolIcon } from '../components/CareersManagement';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const TOOL_LABELS = {
  turbowarp: 'TurboWarp', scratch: 'Scratch', unity: 'Unity', unreal: 'Unreal Engine',
  blender: 'Blender', godot: 'Godot', figma: 'Figma', canva: 'Canva',
  illustrator: 'Illustrator', photoshop: 'Photoshop', aftereffects: 'After Effects',
  premiere: 'Premiere Pro', vscode: 'VS Code', github: 'GitHub', notion: 'Notion', discord: 'Discord',
};

const DEPARTMENTS = ['All', 'Development', 'Art & Design', 'Game Design', 'Marketing', 'Community', 'Sound', 'Writing', 'Other'];

function ApplyModal({ career, onClose, token, user }) {
  const [name, setName] = useState(user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '');
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

      const res = await fetch(`${API}/api/tickets/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: `[Recruitment] ${career.title}`,
          category: 'recruitment',
          message,
        }),
      });
      if (!res.ok) throw new Error('Failed to send application.');
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D1D1F]/40" style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div className="animate-appear rounded-2xl liquid-glass w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7]/60">
          <div>
            <p className="text-xs font-mono font-semibold text-[#4ECDC4] tracking-wide mb-0.5">// {career.department}</p>
            <h3 className="font-display text-lg font-medium text-[#1D1D1F]">{career.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] transition-colors">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle size={32} className="mx-auto mb-4 text-[#4ECDC4]" />
            <p className="font-semibold text-[#1D1D1F] mb-1">Application sent!</p>
            <p className="text-sm text-[#6E6E73] mb-5">
              We'll review your application and get back to you by email.
            </p>
            <button onClick={onClose} className="text-sm font-semibold text-[#4ECDC4] hover:underline">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {!token && (
              <div className="rounded-lg flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 text-xs text-amber-700">
                <Warning size={13} className="shrink-0 mt-0.5" />
                You must be signed in to apply. <a href="/login" className="font-semibold underline ml-1">Sign in</a>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1">Name</label>
                <input
                  required
                  className="rounded-lg w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4]"
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1">Email</label>
                <input
                  required
                  type="email"
                  className="rounded-lg w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4]"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  readOnly={!!user}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1">
                Portfolio / Links <span className="normal-case font-normal text-[#A1A1A6]">(optional)</span>
              </label>
              <input
                className="rounded-lg w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4]"
                value={portfolio} onChange={e => setPortfolio(e.target.value)}
                placeholder="https://your-portfolio.com or GitHub link"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1">
                Cover letter <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                rows={5}
                className="rounded-lg w-full border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#4ECDC4] resize-none"
                value={cover} onChange={e => setCover(e.target.value)}
                placeholder="Tell us about yourself, your experience, and why you want to join Vakar Games..."
              />
            </div>

            {error && (
              <div className="rounded-lg flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs">
                <Warning size={12} className="shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <PublicButton type="submit" disabled={sending || !token} icon={PaperPlaneTilt} iconPosition="leading">
                {sending ? 'Sending…' : 'Send Application'}
              </PublicButton>
              <button type="button" onClick={onClose} className="text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
                Cancel
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
    fetch(`${API}/api/careers`)
      .then(r => r.json())
      .then(d => setCareers(d.careers || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? careers : careers.filter(c => c.department === filter);
  const available = ['All', ...new Set(careers.map(c => c.department))];

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="bg-white border-b border-[#D2D2D7] px-6 md:px-10 lg:px-16 pt-[84px] pb-12">
        <Reveal className="max-w-screen-xl mx-auto">
          <p className="text-[12px] font-mono text-[#4ECDC4] mb-4">// join the company</p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.02em] text-[#1D1D1F] mb-4">
            Careers
          </h1>
          <p className="text-[#6E6E73] text-base leading-relaxed max-w-xl">
            We're a small independent software company building applications, tools and games we're proud of. If you want to contribute
            to something creative and ambitious, we'd love to hear from you.
          </p>
        </Reveal>
      </section>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 md:px-10 lg:px-16 py-12">
        {!loading && careers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {available.filter(d => DEPARTMENTS.includes(d)).map(dept => (
              <button
                key={dept}
                onClick={() => setFilter(dept)}
                className={`px-4 py-1.5 text-sm font-medium border transition-colors ${
                  filter === dept
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                    : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:border-[#BFBFC4] hover:text-[#1D1D1F]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-[#D2D2D7] animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-display text-xl font-medium mb-3 text-[#A1A1A6]">
              No open positions
            </p>
            <p className="text-sm text-[#6E6E73]">
              Nothing right now, but feel free to reach out at{' '}
              <a href="mailto:support@vakargames.com" className="text-[#4ECDC4] hover:underline">support@vakargames.com</a>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => (
              <div key={c._id} className="rounded-xl bg-white border border-[#D2D2D7] hover:border-[#BFBFC4] transition-colors">
                <button className="w-full text-left px-6 py-5" onClick={() => setExpanded(expanded === c._id ? null : c._id)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-[#4ECDC4] uppercase tracking-wider">{c.department}</span>
                        <span className="w-1 h-1 rounded-full bg-[#BFBFC4]" />
                        <span className="text-xs text-[#A1A1A6]">{c.contract_type}</span>
                      </div>
                      <h2 className="font-display text-lg font-medium text-[#1D1D1F] mb-2">{c.title}</h2>
                      <div className="flex items-center flex-wrap gap-4 text-xs text-[#6E6E73]">
                        <span className="flex items-center gap-1"><MapPin size={11} />{c.location}</span>
                        <span className="flex items-center gap-1"><Briefcase size={11} />{c.contract_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.tools?.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1">
                          {c.tools.slice(0, 4).map(t => (
                            <span key={t} className="grayscale opacity-50"><ToolIcon toolId={t} size={18} /></span>
                          ))}
                          {c.tools.length > 4 && <span className="text-xs text-[#A1A1A6] ml-1">+{c.tools.length - 4}</span>}
                        </div>
                      )}
                      {expanded === c._id ? <CaretUp size={16} className="text-[#A1A1A6]" /> : <CaretDown size={16} className="text-[#A1A1A6]" />}
                    </div>
                  </div>
                </button>

                {expanded === c._id && (
                  <div className="px-6 pb-6 border-t border-[#D2D2D7] pt-5 space-y-5">
                    {c.description && <p className="text-sm text-[#3A3A3C] leading-relaxed whitespace-pre-wrap">{c.description}</p>}
                    {c.requirements?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-3">What we're looking for</h3>
                        <ul className="space-y-2">
                          {c.requirements.map((r, i) => (
                            <li key={i} className="flex gap-2 text-sm text-[#3A3A3C]">
                              <span className="text-[#4ECDC4] mt-0.5 shrink-0">—</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.tools?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-3">Tools</h3>
                        <div className="flex flex-wrap gap-2">
                          {c.tools.map(t => (
                            <span key={t} className="rounded-xl flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] border border-[#D2D2D7] text-xs text-[#6E6E73]">
                              <span className="grayscale opacity-60"><ToolIcon toolId={t} size={14} /></span>
                              {TOOL_LABELS[t] || t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <PublicButton onClick={() => setApplying(c)} icon={PaperPlaneTilt} iconPosition="leading">
                        Apply for this position
                      </PublicButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
