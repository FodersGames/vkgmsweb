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

const PublicNav = ({ active }) => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'glass border-b border-white/[0.08] shadow-[0_0_60px_rgba(0,0,0,0.8)]' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8" style={{ perspective: '120px' }}>
              <div style={{
                width:'100%',height:'100%',
                background:'linear-gradient(135deg,#FFFFFF 0%,#A0A0A8 100%)',
                borderRadius:'6px',
                transform:'rotateX(12deg) rotateY(-16deg)',
                boxShadow:'3px 5px 0px rgba(255,255,255,0.25), 0 0 20px rgba(255,255,255,0.08)',
                transition:'transform 0.4s ease',
              }} className="group-hover:[transform:rotateX(18deg)_rotateY(-24deg)]" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white font-display">VAKAR GAMES</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {[{to:'/',label:'Home'},{to:'/games',label:'Games'},{to:'/blog',label:'Blog'}].map(({to,label}) => (
              <Link key={label} to={to}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 font-body
                  ${active===label?'text-white bg-white/10 border border-white/15':'text-[#A1A1A6] hover:text-white hover:bg-white/06'}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button className="md:hidden btn-icon" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
          {mobileMenu ? <X size={16} className="text-white"/> : <Menu size={16} className="text-white"/>}
        </button>
      </div>
      {mobileMenu && (
        <div className="md:hidden glass border-t border-white/08 px-6 py-4 space-y-1" data-testid="mobile-menu">
          {[{to:'/',label:'Home'},{to:'/games',label:'Games'},{to:'/blog',label:'Blog'}].map(({to,label}) => (
            <Link key={label} to={to} className="block px-4 py-3 text-sm text-[#A1A1A6] hover:text-white hover:bg-white/06 rounded-xl transition-all" onClick={() => setMobileMenu(false)}>{label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
};

const Footer = () => (
  <footer style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'#040404' }}>
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</Link>
        <Link to="/games" className="text-xs text-[#6E6E73] hover:text-white transition-colors uppercase tracking-wider font-body">Games</Link>
        <Link to="/blog" className="text-xs text-[#6E6E73] hover:text-white transition-colors uppercase tracking-wider font-body">Blog</Link>
      </div>
      <p className="text-xs text-[#3A3A3C] font-body">&copy; {new Date().getFullYear()} Vakar Games</p>
    </div>
  </footer>
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
    <div style={{ background:'#080808', color:'#F5F5F7', minHeight:'100vh' }} className="font-body">
      <PublicNav active="Games" />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-60 pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-6 h-px bg-white/30" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#6E6E73]">Our Catalog</span>
          </div>
          <h1 className="font-display font-bold gradient-text-bright mb-4"
            style={{ fontSize:'clamp(3rem,7vw,5.5rem)', letterSpacing:'-0.03em', lineHeight:0.92 }}>
            GAMES
          </h1>
          <p className="text-[#6E6E73] text-lg max-w-xl" style={{ fontWeight:300 }}>
            Every title crafted with passion, from concept to launch.
          </p>
        </div>
      </section>

      <div className="section-divider" />

      {/* Games grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-video" style={{ background:'rgba(255,255,255,0.04)' }} />
                  <div className="p-6 space-y-3">
                    <div className="h-4 rounded-full bg-white/06 w-3/4" />
                    <div className="h-3 rounded-full bg-white/04 w-full" />
                    <div className="h-3 rounded-full bg-white/04 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-28">
              <div className="w-20 h-20 glass glass-strong rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Gamepad2 size={36} className="text-[#3A3A3C]" />
              </div>
              <h3 className="font-display font-bold text-3xl mb-3 gradient-text-bright" style={{ letterSpacing:'-0.02em' }}>
                Coming Soon
              </h3>
              <p className="text-[#6E6E73] max-w-md mx-auto" style={{ fontWeight:300 }}>
                We're hard at work on something amazing. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game, idx) => (
                <article
                  key={game.id || idx}
                  className="card-3d glass glass-hover rounded-2xl overflow-hidden flex flex-col"
                  style={{ position:'relative' }}
                >
                  {/* Top shimmer */}
                  <div style={{
                    position:'absolute', top:0, left:'15%', right:'15%', height:'1px', zIndex:1,
                    background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)',
                  }} />

                  {/* Image */}
                  <div className="relative overflow-hidden" style={{ aspectRatio:'16/9' }}>
                    {game.logo_url ? (
                      <img
                        src={game.logo_url.startsWith('/') ? `${API_URL}${game.logo_url}` : game.logo_url}
                        alt={game.name}
                        className="w-full h-full object-cover"
                        style={{ transition:'transform 0.5s ease' }}
                        onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background:'rgba(255,255,255,0.03)' }}>
                        <Gamepad2 size={40} className="text-[#3A3A3C]" />
                      </div>
                    )}
                    {game.is_featured && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 glass-strong rounded-full border border-white/15 text-xs font-semibold text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" style={{ animation:'orb-pulse 2s ease-in-out infinite' }} />
                        Featured
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-display font-bold text-lg text-white mb-2" style={{ letterSpacing:'-0.01em' }}>{game.name}</h3>
                    {game.description && (
                      <p className="text-sm text-[#6E6E73] leading-relaxed mb-4 flex-1" style={{ fontWeight:300 }}>
                        {game.description.length > 120 ? game.description.slice(0, 120) + '…' : game.description}
                      </p>
                    )}
                    {game.platforms?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-auto pt-4" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                        {game.platforms.map((p, i) => {
                          const info = PLATFORM_ICONS[p.name];
                          return (
                            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1 glass rounded-full text-xs text-[#A1A1A6] hover:text-white transition-all"
                              data-testid={`platform-${p.name}`}
                            >
                              {info ? <>{info.svg}{info.label}</> : <>{p.name}</>}
                              <ExternalLink size={10} />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="section-divider mb-20" />
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold text-3xl gradient-text-bright mb-4" style={{ letterSpacing:'-0.02em' }}>
            Stay in the loop
          </h2>
          <p className="text-[#6E6E73] mb-8 max-w-md mx-auto" style={{ fontWeight:300 }}>
            Follow our blog for dev updates, release news, and behind-the-scenes content.
          </p>
          <Link to="/blog" className="btn-primary">
            Read our blog <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default GamesPage;
