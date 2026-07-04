import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { ToolIcon } from '../components/CareersManagement';

const API = process.env.REACT_APP_API_URL || '';

const DEPARTMENTS = ['All', 'Development', 'Art & Design', 'Game Design', 'Marketing', 'Community', 'Sound', 'Writing', 'Other'];

export default function Careers() {
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/careers`)
      .then(r => r.json())
      .then(d => setCareers(d.careers || []))
      .finally(() => setLoading(false));
  }, []);

  const TOOL_LABELS = {
    turbowarp: 'TurboWarp', scratch: 'Scratch', unity: 'Unity', unreal: 'Unreal Engine',
    blender: 'Blender', godot: 'Godot', figma: 'Figma', canva: 'Canva',
    illustrator: 'Illustrator', photoshop: 'Photoshop', aftereffects: 'After Effects',
    premiere: 'Premiere Pro', vscode: 'VS Code', github: 'GitHub', notion: 'Notion', discord: 'Discord',
  };

  const filtered = filter === 'All' ? careers : careers.filter(c => c.department === filter);
  const available = ['All', ...new Set(careers.map(c => c.department))].filter(d => d === 'All' || careers.some(c => c.department === d));

  return (
    <div className="min-h-screen bg-[#F9F7F4] flex flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="bg-[#1C1917] py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#4ECDC4] uppercase mb-4">Join the Studio</p>
          <h1
            className="text-5xl md:text-6xl font-black text-white mb-5"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}
          >
            CAREERS
          </h1>
          <p className="text-[#78716C] text-base leading-relaxed max-w-xl mx-auto">
            We're a small independent studio building games we love. If you want to contribute
            to something creative and ambitious, we'd love to hear from you.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-14">

        {/* Filter tabs */}
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
                {dept !== 'All' && (
                  <span className="ml-1.5 text-xs opacity-60">
                    ({careers.filter(c => c.department === dept).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-[#E8E3DB] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em', color: '#C9C3BB' }}>
              NO OPEN POSITIONS
            </p>
            <p className="text-sm text-[#78716C]">
              Nothing right now, but you can always reach out at{' '}
              <a href="mailto:support@vakargames.com" className="text-[#4ECDC4] hover:underline">
                support@vakargames.com
              </a>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => (
              <div
                key={c._id}
                className="bg-white border border-[#E8E3DB] hover:border-[#C9C3BB] transition-colors"
              >
                <button
                  className="w-full text-left px-6 py-5"
                  onClick={() => setExpanded(expanded === c._id ? null : c._id)}
                >
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
                            <span key={t} className="grayscale opacity-50" title={TOOL_LABELS[t] || t}>
                              <ToolIcon toolId={t} size={18} />
                            </span>
                          ))}
                          {c.tools.length > 4 && (
                            <span className="text-xs text-[#A8A29E] ml-1">+{c.tools.length - 4}</span>
                          )}
                        </div>
                      )}
                      {expanded === c._id
                        ? <ChevronUp size={16} className="text-[#A8A29E]" />
                        : <ChevronDown size={16} className="text-[#A8A29E]" />
                      }
                    </div>
                  </div>
                </button>

                {expanded === c._id && (
                  <div className="px-6 pb-6 border-t border-[#E8E3DB] pt-5 space-y-5">
                    {c.description && (
                      <p className="text-sm text-[#44403C] leading-relaxed whitespace-pre-wrap">{c.description}</p>
                    )}

                    {c.requirements?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-3">What we're looking for</h3>
                        <ul className="space-y-2">
                          {c.requirements.map((r, i) => (
                            <li key={i} className="flex gap-2 text-sm text-[#44403C]">
                              <span className="text-[#4ECDC4] mt-0.5 shrink-0">—</span>
                              {r}
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
                            <span
                              key={t}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F9F7F4] border border-[#E8E3DB] text-xs text-[#78716C]"
                            >
                              <span className="grayscale opacity-60"><ToolIcon toolId={t} size={14} /></span>
                              {TOOL_LABELS[t] || t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <a
                        href={`mailto:support@vakargames.com?subject=Application — ${encodeURIComponent(c.title)}`}
                        className="inline-flex items-center gap-2 bg-[#1C1917] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#2D2926] transition-colors"
                      >
                        Apply for this position
                      </a>
                      <p className="mt-2 text-xs text-[#A8A29E]">Send your application and portfolio to support@vakargames.com</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
