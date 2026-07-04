import React, { useState, useEffect } from 'react';
import { MapPin, Briefcase, ChevronDown, ChevronUp, Send, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60">
      <div className="bg-white w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E3DB]">
          <div>
            <p className="text-xs font-semibold text-[#4ECDC4] uppercase tracking-wider mb-0.5">{career.department}</p>
            <h3 className="font-bold text-[#1C1917] text-sm">{career.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#A8A29E] hover:text-[#1C1917] transition-colors">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle size={32} className="mx-auto mb-4 text-[#4ECDC4]" />
            <p className="font-semibold text-[#1C1917] mb-1">Application sent!</p>
            <p className="text-sm text-[#78716C] mb-5">
              We'll review your application and get back to you by email.
            </p>
            <button onClick={onClose} className="text-sm font-semibold text-[#4ECDC4] hover:underline">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {!token && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 text-xs text-amber-700">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                You must be signed in to apply. <a href="/login" className="font-semibold underline ml-1">Sign in</a>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#78716C] uppercase tracking-wider mb-1">Name</label>
                <input
                  required
                  className="w-full border border-[#E8E3DB] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#4ECDC4]"
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#78716C] uppercase tracking-wider mb-1">Email</label>
                <input
                  required
                  type="email"
                  className="w-full border border-[#E8E3DB] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#4ECDC4]"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  readOnly={!!user}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#78716C] uppercase tracking-wider mb-1">
                Portfolio / Links <span className="normal-case font-normal text-[#A8A29E]">(optional)</span>
              </label>
              <input
                className="w-full border border-[#E8E3DB] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#4ECDC4]"
                value={portfolio} onChange={e => setPortfolio(e.target.value)}
                placeholder="https://your-portfolio.com or GitHub link"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#78716C] uppercase tracking-wider mb-1">
                Cover letter <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                rows={5}
                className="w-full border border-[#E8E3DB] px-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#4ECDC4] resize-none"
                value={cover} onChange={e => setCover(e.target.value)}
                placeholder="Tell us about yourself, your experience, and why you want to join Vakar Games..."
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs">
                <AlertTriangle size={12} className="shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={sending || !token}
                className="inline-flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Send size={13} />
                {sending ? 'Sending…' : 'Send Application'}
              </button>
              <button type="button" onClick={onClose} className="text-sm text-[#78716C] hover:text-[#1C1917] transition-colors">
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
    <div className="min-h-screen bg-[#F9F7F4] flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="bg-white border-b border-[#E8E3DB] px-6 md:px-10 lg:px-16 pt-24 pb-12">
        <div className="max-w-screen-xl mx-auto">
          <p className="text-xs font-semibold text-[#4ECDC4] tracking-[0.16em] uppercase mb-4">Join the Studio</p>
          <h1
            className="text-5xl sm:text-6xl font-black text-[#1C1917] leading-tight mb-4"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            CAREERS
          </h1>
          <p className="text-[#78716C] text-base leading-relaxed max-w-xl">
            We're a small independent studio building games we love. If you want to contribute
            to something creative and ambitious, we'd love to hear from you.
          </p>
        </div>
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
                    ? 'bg-[#1C1917] text-white border-[#1C1917]'
                    : 'bg-white text-[#78716C] border-[#E8E3DB] hover:border-[#C9C3BB] hover:text-[#1C1917]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-[#E8E3DB] animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em', color: '#C9C3BB' }}>
              NO OPEN POSITIONS
            </p>
            <p className="text-sm text-[#78716C]">
              Nothing right now, but feel free to reach out at{' '}
              <a href="mailto:support@vakargames.com" className="text-[#4ECDC4] hover:underline">support@vakargames.com</a>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => (
              <div key={c._id} className="bg-white border border-[#E8E3DB] hover:border-[#C9C3BB] transition-colors">
                <button className="w-full text-left px-6 py-5" onClick={() => setExpanded(expanded === c._id ? null : c._id)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-[#4ECDC4] uppercase tracking-wider">{c.department}</span>
                        <span className="w-1 h-1 rounded-full bg-[#C9C3BB]" />
                        <span className="text-xs text-[#A8A29E]">{c.contract_type}</span>
                      </div>
                      <h2 className="text-lg font-bold text-[#1C1917] mb-2">{c.title}</h2>
                      <div className="flex items-center flex-wrap gap-4 text-xs text-[#78716C]">
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
                          {c.tools.length > 4 && <span className="text-xs text-[#A8A29E] ml-1">+{c.tools.length - 4}</span>}
                        </div>
                      )}
                      {expanded === c._id ? <ChevronUp size={16} className="text-[#A8A29E]" /> : <ChevronDown size={16} className="text-[#A8A29E]" />}
                    </div>
                  </div>
                </button>

                {expanded === c._id && (
                  <div className="px-6 pb-6 border-t border-[#E8E3DB] pt-5 space-y-5">
                    {c.description && <p className="text-sm text-[#44403C] leading-relaxed whitespace-pre-wrap">{c.description}</p>}
                    {c.requirements?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-3">What we're looking for</h3>
                        <ul className="space-y-2">
                          {c.requirements.map((r, i) => (
                            <li key={i} className="flex gap-2 text-sm text-[#44403C]">
                              <span className="text-[#4ECDC4] mt-0.5 shrink-0">—</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.tools?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-3">Tools</h3>
                        <div className="flex flex-wrap gap-2">
                          {c.tools.map(t => (
                            <span key={t} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F9F7F4] border border-[#E8E3DB] text-xs text-[#78716C]">
                              <span className="grayscale opacity-60"><ToolIcon toolId={t} size={14} /></span>
                              {TOOL_LABELS[t] || t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <button
                        onClick={() => setApplying(c)}
                        className="inline-flex items-center gap-2 bg-[#1C1917] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#2D2926] transition-colors"
                      >
                        <Send size={13} />
                        Apply for this position
                      </button>
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
