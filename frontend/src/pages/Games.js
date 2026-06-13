import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ExternalLink, Gamepad2, ArrowRight } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATFORM_ICONS = {
  steam: {
    label: 'Steam',
    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12S18.606 0 11.979 0z"/></svg>
  },
  google_play: {
    label: 'Google Play',
    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 1.332L16.698 12l3.302-2.493zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
  },
  apple: {
    label: 'App Store',
    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
  },
  pc: {
    label: 'PC',
    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
  },
  web: {
    label: 'Web',
    svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  },
  android: {
    label: 'Android',
    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.523 15.341c-.583 0-1.055.473-1.055 1.056s.473 1.055 1.055 1.055c.583 0 1.056-.473 1.056-1.055s-.474-1.056-1.056-1.056zm-11.046 0c-.583 0-1.055.473-1.055 1.056s.473 1.055 1.055 1.055c.583 0 1.056-.473 1.056-1.055s-.473-1.056-1.056-1.056zm11.405-6.02l1.945-3.368c.108-.188.044-.429-.144-.537-.188-.108-.429-.044-.537.144l-1.97 3.41c-1.479-.672-3.14-1.047-4.89-1.047s-3.411.375-4.89 1.047l-1.97-3.41c-.108-.188-.349-.252-.537-.144-.188.108-.252.349-.144.537l1.945 3.368C3.013 11.18.612 14.04.612 17.353h22.776c0-3.313-2.401-6.173-5.506-8.032z"/></svg>
  },
};

/* Shared navbar for public pages */
const PublicNav = ({ active }) => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 bg-white ${scrolled ? 'border-b border-[#E1DFDD] shadow-sm' : 'border-b border-[#E1DFDD]'}`}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-6 h-6 relative" style={{ perspective: '60px' }}>
              <div style={{ width:'100%',height:'100%',background:'linear-gradient(135deg,#0078D4 0%,#40A9FF 100%)',borderRadius:'2px',transform:'rotateX(10deg) rotateY(-12deg)',boxShadow:'2px 3px 0px #005A9E,0 1px 6px rgba(0,120,212,0.3)'}} />
            </div>
            <span className="text-sm font-bold tracking-tight text-[#201F1E] font-display">VAKAR GAMES</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {[{ to:'/', label:'Home' },{ to:'/games', label:'Games' },{ to:'/blog', label:'Blog' }].map(({ to, label }) => (
              <Link key={label} to={to}
                className={`px-3 py-1.5 text-[0.8125rem] font-medium rounded-sm transition-colors font-body ${
                  active === label ? 'text-[#0078D4] bg-[#EFF6FC]' : 'text-[#605E5C] hover:text-[#201F1E] hover:bg-[#F3F2F1]'
                }`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button className="md:hidden p-2 text-[#605E5C]" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
          {mobileMenu ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </div>
      {mobileMenu && (
        <div className="md:hidden bg-white border-t border-[#E1DFDD] px-6 py-3 space-y-1" data-testid="mobile-menu">
          {[{ to:'/', label:'Home' },{ to:'/games', label:'Games' },{ to:'/blog', label:'Blog' }].map(({ to, label }) => (
            <Link key={label} to={to} className="block px-3 py-2 text-sm text-[#605E5C] hover:bg-[#F3F2F1] rounded-sm" onClick={() => setMobileMenu(false)}>{label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
};

const GridWires = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <svg width="100%" height="100%"><defs><pattern id="az-grid-g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(0,120,212,0.06)" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#az-grid-g)"/></svg>
  </div>
);

const GamesPage = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Games — Vakar Games';
    axios.get(`${API_URL}/api/website/games/public`)
      .then(r => { setGames(r.data.games); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white text-[#201F1E] min-h-screen font-body">
      <PublicNav active="Games" />

      {/* Page header */}
      <div className="relative pt-14 overflow-hidden" style={{ background: 'linear-gradient(160deg, #FAFAFA 0%, #EFF6FC 100%)' }}>
        <GridWires />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0078D4] to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-8 h-px bg-[#0078D4]" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#0078D4]">Our Portfolio</span>
          </div>
          <h1 className="font-display font-black text-5xl md:text-7xl leading-none tracking-tight text-[#201F1E] mb-4">
            OUR<br /><span style={{ WebkitTextStroke: '2px #0078D4', color: 'transparent' }}>GAMES</span>
          </h1>
          <p className="text-base text-[#605E5C] max-w-xl mt-4">Discover the worlds we've built — from concept to launch, each title crafted with precision and passion.</p>
        </div>
      </div>

      {/* Game list */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3">
            <div className="w-5 h-5 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#605E5C] font-body">Loading games...</span>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-32">
            <div className="w-16 h-16 bg-[#EFF6FC] border border-[#C7E0F4] rounded-sm flex items-center justify-center mx-auto mb-6">
              <Gamepad2 size={28} className="text-[#0078D4]" />
            </div>
            <h3 className="font-display font-black text-3xl text-[#201F1E] mb-3">COMING SOON</h3>
            <p className="text-[#605E5C] font-body">New games are in development. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-[#E1DFDD]">
            {games.map((game, idx) => (
              <div
                key={game.slug}
                className={`py-20 flex flex-col ${idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-16 items-center group`}
                data-testid={`game-card-${game.slug}`}
              >
                {/* Image */}
                <div className="lg:w-1/2">
                  <div className="card-3d az-panel rounded-sm overflow-hidden">
                    {game.logo_url ? (
                      <img src={game.logo_url.startsWith('/') ? `${API_URL}${game.logo_url}` : game.logo_url}
                        alt={game.name} className="w-full object-cover" />
                    ) : game.screenshots?.length > 0 ? (
                      <img src={game.screenshots[0].startsWith('/') ? `${API_URL}${game.screenshots[0]}` : game.screenshots[0]}
                        alt={game.name} className="w-full aspect-video object-cover" />
                    ) : (
                      <div className="aspect-video bg-[#F3F2F1] flex items-center justify-center">
                        <Gamepad2 size={40} className="text-[#C8C6C4]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="lg:w-1/2 space-y-5">
                  {/* Index label */}
                  <span className="text-[10px] font-mono text-[#A19F9D] tracking-widest">
                    {String(idx + 1).padStart(2, '0')} / {String(games.length).padStart(2, '0')}
                  </span>
                  <h2 className="font-display font-black text-4xl md:text-5xl leading-none tracking-tight text-[#201F1E]">{game.name}</h2>
                  <p className="text-base text-[#605E5C] leading-relaxed font-body">{game.description}</p>

                  {/* Screenshots strip */}
                  {game.screenshots?.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {game.screenshots.slice(1, 4).map((s, i) => (
                        <img key={i}
                          src={s.startsWith('/') ? `${API_URL}${s}` : s}
                          alt=""
                          className="h-16 w-28 object-cover border border-[#E1DFDD] rounded-sm flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}

                  {/* Platform links */}
                  {game.platforms?.length > 0 && (
                    <div className="flex gap-2 flex-wrap pt-2">
                      {game.platforms.map((p, i) => {
                        const pl = PLATFORM_ICONS[p.name];
                        return pl ? (
                          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E1DFDD] rounded-sm text-xs font-medium text-[#605E5C] hover:border-[#0078D4] hover:text-[#0078D4] hover:bg-[#EFF6FC] transition-all font-body"
                            data-testid={`platform-${p.name}`}>
                            <span className="text-current">{pl.svg}</span>
                            {pl.label}
                            <ExternalLink size={10} className="opacity-50" />
                          </a>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#1B1A19] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</Link>
            <Link to="/games" className="text-xs text-[#605E5C] hover:text-white transition-colors uppercase tracking-wider font-body">Games</Link>
            <Link to="/blog" className="text-xs text-[#605E5C] hover:text-white transition-colors uppercase tracking-wider font-body">Blog</Link>
          </div>
          <p className="text-xs text-[#605E5C] font-body">&copy; {new Date().getFullYear()} Vakar Games</p>
        </div>
      </footer>
    </div>
  );
};

export default GamesPage;
