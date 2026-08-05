import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowSquareOut, Sparkle } from '@phosphor-icons/react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { PublicButton } from '../ui/PublicButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// The public "Applications" showcase — apps built with Vakar Studio by the
// community, listed here once an admin approves their submitted version
// (see AppReviewQueue.js / studio_apps.py's review workflow). This used to
// be the old games storefront (db.website_games); that catalog still exists
// and its routes still work, it's just no longer linked from anywhere —
// this page now reads from GET /api/apps instead.
const ApplicationsPage = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('');

  useEffect(() => {
    document.title = 'Applications — Vakar Games';
    axios.get(`${API_URL}/api/apps`)
      .then(r => { setApps(r.data.apps || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const availableTags = useMemo(() => {
    const set = new Set();
    apps.forEach(a => (a.review_tags || []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [apps]);

  const filteredApps = useMemo(
    () => activeTag ? apps.filter(a => (a.review_tags || []).includes(activeTag)) : apps,
    [apps, activeTag]
  );

  const img = (url) => (url?.startsWith('/') ? `${API_URL}${url}` : url);

  return (
    <div className="bg-[#F5F5F7] min-h-screen">
      <PublicNav />

      <div className="pt-[52px]">
        {/* Page header */}
        <div className="bg-white border-b border-[#D2D2D7] py-16 px-6">
          <Reveal className="max-w-7xl mx-auto">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-3">// vakar applications</p>
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.02em] text-[#1D1D1F]">
              Made with Vakar Studio
            </h1>
            <p className="text-[#6E6E73] mt-3 max-w-md">
              Apps built by our community with Vakar Studio, reviewed and featured here.
            </p>

            {availableTags.length > 1 && (
              <div className="flex gap-2 mt-8 flex-wrap">
                <button
                  onClick={() => setActiveTag('')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    !activeTag
                      ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                      : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:border-[#BFBFC4] hover:text-[#1D1D1F]'
                  }`}
                >
                  All
                </button>
                {availableTags.map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTag(t)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      activeTag === t
                        ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                        : 'bg-white text-[#6E6E73] border-[#D2D2D7] hover:border-[#BFBFC4] hover:text-[#1D1D1F]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </Reveal>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-16">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-2xl bg-white/60 animate-pulse" />)}
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-20">
              <div className="rounded-full w-14 h-14 bg-[#4ECDC4]/10 flex items-center justify-center mx-auto mb-5">
                <Sparkle size={22} className="text-[#4ECDC4]" />
              </div>
              <h2 className="font-display text-2xl font-medium text-[#1D1D1F] mb-3">
                {apps.length === 0 ? 'Nothing here yet' : 'No apps with this tag'}
              </h2>
              <p className="text-[#6E6E73] mb-6 max-w-sm mx-auto">
                {apps.length === 0
                  ? 'Be the first to build something with Vakar Studio and submit it for review.'
                  : 'Try a different tag, or browse everything.'}
              </p>
              <Link to="/my-apps">
                <PublicButton>Start building</PublicButton>
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApps.map(a => (
                <Reveal key={a.slug} className="rounded-2xl bg-white border border-[#D2D2D7] overflow-hidden flex flex-col group">
                  <a href={`/apps/${a.public_id}`} target="_blank" rel="noopener noreferrer" className="block h-32 bg-[#F5F5F7] overflow-hidden">
                    {a.review_banner_url ? (
                      <img src={img(a.review_banner_url)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : a.review_logo_url ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <img src={img(a.review_logo_url)} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-display text-[#A1A1A6] text-lg font-medium">{a.review_name || a.name}</span>
                      </div>
                    )}
                  </a>
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-3">
                      {a.review_logo_url && a.review_banner_url && (
                        <img src={img(a.review_logo_url)} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0 border border-[#D2D2D7]" />
                      )}
                      <h3 className="font-display text-base font-medium text-[#1D1D1F] truncate flex-1">{a.review_name || a.name}</h3>
                      {a.price_cents > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F2994A]/10 text-[#F2994A] shrink-0">${(a.price_cents / 100).toFixed(2)}</span>
                      )}
                    </div>
                    {a.review_description && (
                      <p className="text-sm text-[#6E6E73] leading-relaxed line-clamp-3">{a.review_description}</p>
                    )}
                    {a.review_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {a.review_tags.slice(0, 4).map(t => (
                          <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#4ECDC4]/10 text-[#4ECDC4]">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex-1" />
                    <a
                      href={`/apps/${a.public_id}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F] hover:text-[#4ECDC4] transition-colors"
                    >
                      Open <ArrowSquareOut size={12} />
                    </a>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default ApplicationsPage;
