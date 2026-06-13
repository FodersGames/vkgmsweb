import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Gamepad2, Code, Users, Zap, Menu, X, ArrowRight, ExternalLink } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATFORM_ICONS = {
  steam: 'Steam', google_play: 'Google Play', apple: 'App Store',
  pc: 'PC', web: 'Web', android: 'Android'
};

/* ── Shared Nav ── */
const Navbar = ({ activePath }) => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-white border-b border-[#E1DFDD] shadow-sm' : 'bg-white/95 border-b border-[#E1DFDD]'
      }`}
      data-testid="landing-navbar"
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2.5 group" data-testid="landing-logo">
            {/* Azure-style 3D logo mark */}
            <div className="w-7 h-7 relative" style={{ perspective: '80px' }}>
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #0078D4 0%, #40A9FF 100%)',
                borderRadius: '3px',
                transform: 'rotateX(10deg) rotateY(-12deg)',
                boxShadow: '3px 4px 0px #005A9E, 1px 1px 8px rgba(0,120,212,0.3)',
                transition: 'transform 0.3s',
              }}
              className="group-hover:[transform:rotateX(15deg)_rotateY(-18deg)]"
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-[#201F1E] font-display">VAKAR GAMES</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/#about', label: 'About', scroll: true },
              { to: '/games', label: 'Games' },
              { to: '/blog', label: 'Blog' },
            ].map(({ to, label, scroll }) => (
              <Link
                key={label}
                to={to}
                className={`px-3 py-1.5 text-[0.8125rem] font-medium rounded-sm transition-colors font-body
                  ${activePath === to ? 'text-[#0078D4] bg-[#EFF6FC]' : 'text-[#605E5C] hover:text-[#201F1E] hover:bg-[#F3F2F1]'}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button className="md:hidden p-2 text-[#605E5C]" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
          {mobileMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileMenu && (
        <div className="md:hidden bg-white border-t border-[#E1DFDD] px-6 py-3 space-y-1" data-testid="mobile-menu">
          <Link to="/" className="block px-3 py-2 text-sm text-[#605E5C] hover:bg-[#F3F2F1] rounded-sm" onClick={() => setMobileMenu(false)}>Home</Link>
          <Link to="/games" className="block px-3 py-2 text-sm text-[#605E5C] hover:bg-[#F3F2F1] rounded-sm" onClick={() => setMobileMenu(false)}>Games</Link>
          <Link to="/blog" className="block px-3 py-2 text-sm text-[#605E5C] hover:bg-[#F3F2F1] rounded-sm" onClick={() => setMobileMenu(false)}>Blog</Link>
        </div>
      )}
    </nav>
  );
};

/* ── Isometric 3D Cube SVG decoration ── */
const IsoCube = ({ size = 60, color = '#0078D4', className = '' }) => {
  const d = size;
  const h = d * 0.866;
  return (
    <svg width={d * 2} height={d * 1.8} viewBox={`0 0 ${d * 2} ${d * 1.8}`} className={className} style={{ filter: 'drop-shadow(0 8px 24px rgba(0,120,212,0.18))' }}>
      {/* Top face */}
      <polygon
        points={`${d},0 ${d*2},${h*0.5} ${d},${h} 0,${h*0.5}`}
        fill={color} opacity="0.9"
      />
      {/* Left face */}
      <polygon
        points={`0,${h*0.5} ${d},${h} ${d},${d*1.73} 0,${d*1.73*0.5+h*0.5}`}
        fill={color} opacity="0.55"
      />
      {/* Right face */}
      <polygon
        points={`${d},${h} ${d*2},${h*0.5} ${d*2},${d*1.73*0.5+h*0.5} ${d},${d*1.73}`}
        fill={color} opacity="0.35"
      />
    </svg>
  );
};

/* ── Animated grid wires ── */
const GridWires = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="az-grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(0,120,212,0.07)" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#az-grid)" />
    </svg>
  </div>
);

const Home = () => {
  const aboutRef = useRef(null);
  const [featuredGame, setFeaturedGame] = useState(null);

  useEffect(() => {
    document.title = 'Vakar Games — Studio';
    axios.get(`${API_URL}/api/website/games/featured`).then(r => {
      if (r.data.game) setFeaturedGame(r.data.game);
    }).catch(() => {});
  }, []);

  const scrollToAbout = () => aboutRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="bg-white text-[#201F1E] font-body">
      <Navbar activePath="/" />

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex items-center overflow-hidden pt-14"
        style={{ background: 'linear-gradient(160deg, #FAFAFA 0%, #EFF6FC 45%, #F3F2F1 100%)' }}
        data-testid="hero-section"
      >
        <GridWires />

        {/* Floating 3D cubes decoration */}
        <div className="absolute right-[8%] top-[15%] iso-cube opacity-70 hidden lg:block">
          <IsoCube size={52} color="#0078D4" />
        </div>
        <div className="absolute right-[22%] top-[55%] opacity-40 hidden lg:block" style={{ animation: 'iso-float 8s ease-in-out infinite', animationDelay: '-3s' }}>
          <IsoCube size={28} color="#40A9FF" />
        </div>
        <div className="absolute right-[5%] top-[55%] opacity-30 hidden lg:block" style={{ animation: 'iso-float 10s ease-in-out infinite', animationDelay: '-6s' }}>
          <IsoCube size={18} color="#0078D4" />
        </div>

        {/* Blue accent vertical bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0078D4] via-[#40A9FF] to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 lg:py-32 w-full grid lg:grid-cols-2 gap-16 items-center">
          <div className="fade-up">
            <h1 className="font-display font-black leading-[0.9] tracking-tight mb-6" style={{ fontSize: 'clamp(3.5rem, 8vw, 7rem)', color: '#201F1E' }}>
              VAKAR<br />
              <span style={{ WebkitTextStroke: '2px #0078D4', color: 'transparent' }}>GAMES</span>
            </h1>

            <p className="text-lg text-[#605E5C] leading-relaxed mb-10 max-w-lg font-body font-light">
              We build games that players remember. Immersive worlds, unforgettable characters, and experiences engineered to push boundaries.
            </p>

            <div className="flex flex-wrap gap-3">
              <button onClick={scrollToAbout} className="az-btn-primary flex items-center gap-2">
                Discover our work <ArrowRight size={14} />
              </button>
              <Link to="/games" className="az-btn-ghost flex items-center gap-2">
                Browse games <ChevronRight size={14} />
              </Link>
            </div>

            {/* Stat strip */}
            <div className="mt-14 flex gap-8 pt-8 border-t border-[#E1DFDD]">
              {[
                { value: '100%', label: 'Indie & Passionate' },
                { value: 'FR', label: 'French Studio' },
                { value: '∞', label: 'Creative drive' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-2xl font-bold font-display text-[#0078D4]">{value}</p>
                  <p className="text-xs text-[#A19F9D] mt-0.5 font-body">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — stylized "terminal" card */}
          <div className="hidden lg:block fade-up fade-up-2">
            <div className="relative card-3d">
              <div className="az-panel rounded-sm overflow-hidden" style={{ boxShadow: '0 24px 80px rgba(0,120,212,0.10), 0 4px 20px rgba(0,0,0,0.06)' }}>
                {/* Terminal header */}
                <div className="bg-[#1E1E1E] px-4 py-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
                  <span className="ml-3 text-xs text-[#6E6E6E] font-mono">vakar-studio — zsh</span>
                </div>
                <div className="az-terminal p-6 text-sm leading-7 min-h-[280px]">
                  <p><span className="text-[#569CD6]">$</span> <span className="text-[#9CDCFE]">vakar</span> <span className="text-[#CE9178]">init --studio</span></p>
                  <p className="text-[#6A9955]">✓ Loading passion engine...</p>
                  <p className="text-[#6A9955]">✓ Compiling world-builder v3.0</p>
                  <p className="text-[#6A9955]">✓ Loading player experience SDK</p>
                  <p className="mt-2"><span className="text-[#569CD6]">$</span> <span className="text-[#9CDCFE]">vakar</span> <span className="text-[#CE9178]">build --release</span></p>
                  <p className="text-[#C8C6C4]">Building <span className="text-[#4EC9B0]">legendary games</span>...</p>
                  <p><span className="text-[#D4D4D4]">Progress: </span>
                    <span className="text-[#0078D4]">████████████</span>
                    <span className="text-[#3C3C3C]">████</span>
                    <span className="text-[#9CDCFE]"> 75%</span>
                  </p>
                  <p className="animate-pulse">
                    <span className="text-[#569CD6]">$</span>
                    <span className="text-[#D4D4D4]"> _</span>
                  </p>
                </div>
              </div>
              {/* Shadow depth element */}
              <div className="absolute -bottom-3 -right-3 w-full h-full border border-[#C7E0F4] rounded-sm -z-10 bg-[#EFF6FC]" />
              <div className="absolute -bottom-5 -right-5 w-full h-full border border-[#E1DFDD] rounded-sm -z-20" />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="text-[10px] tracking-widest uppercase font-body text-[#605E5C]">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-[#0078D4] to-transparent" />
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section ref={aboutRef} className="relative py-28 overflow-hidden bg-white" data-testid="about-section">
        <div className="absolute inset-0 az-dot-grid opacity-50" />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          {/* Section label */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-8 h-px bg-[#0078D4]" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#0078D4] font-body">About the Studio</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="font-display font-black text-5xl md:text-6xl leading-none tracking-tight mb-8 text-[#201F1E]">
                WHO<br />WE ARE
              </h2>
              <p className="text-base text-[#605E5C] leading-relaxed mb-5 font-body">
                Vakar Games is a French video game development studio driven by passion and creativity. We build immersive worlds, unforgettable characters, and experiences that push boundaries.
              </p>
              <p className="text-base text-[#605E5C] leading-relaxed mb-10 font-body">
                From concept to launch, every pixel, every line of code, every mechanic is crafted with intent. Our mission is simple: create games players remember forever.
              </p>
              <Link to="/games" className="az-btn-primary inline-flex items-center gap-2">
                See our games <ArrowRight size={14} />
              </Link>
            </div>

            {/* Capability cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Gamepad2, title: 'Game Development', desc: 'Building worlds from concept to launch across multiple platforms', color: '#0078D4' },
                { icon: Code, title: 'Technology', desc: 'Cutting-edge engines and tools for seamless player experiences', color: '#40A9FF' },
                { icon: Users, title: 'Community', desc: 'Players at the center of every design decision we make', color: '#0078D4' },
                { icon: Zap, title: 'Innovation', desc: 'Pushing the limits of what interactive experiences can be', color: '#40A9FF' },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <div
                  key={i}
                  className="card-3d az-panel p-5 relative az-accent-bar"
                  style={{ '--accent-color': color }}
                >
                  <div className="mt-2">
                    <div className="w-9 h-9 rounded-sm flex items-center justify-center mb-4" style={{ background: `${color}14` }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <h4 className="text-sm font-semibold text-[#201F1E] mb-1.5 font-display">{title}</h4>
                    <p className="text-xs text-[#605E5C] leading-relaxed font-body">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED GAME ── */}
      <section
        id="games"
        className="relative py-28 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #F8F8F8 0%, #EFF6FC 100%)' }}
        data-testid="games-section"
      >
        <GridWires />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-8 h-px bg-[#0078D4]" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#0078D4] font-body">Featured Game</span>
          </div>

          {featuredGame ? (
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="card-3d">
                <div className="az-panel rounded-sm overflow-hidden">
                  {featuredGame.logo_url ? (
                    <img
                      src={featuredGame.logo_url.startsWith('/') ? `${API_URL}${featuredGame.logo_url}` : featuredGame.logo_url}
                      alt={featuredGame.name}
                      className="w-full object-cover"
                    />
                  ) : featuredGame.screenshots?.length > 0 ? (
                    <img
                      src={featuredGame.screenshots[0].startsWith('/') ? `${API_URL}${featuredGame.screenshots[0]}` : featuredGame.screenshots[0]}
                      alt={featuredGame.name}
                      className="w-full object-cover aspect-video"
                    />
                  ) : (
                    <div className="aspect-video bg-[#F3F2F1] flex items-center justify-center">
                      <Gamepad2 size={48} className="text-[#C8C6C4]" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#DFF6DD] border border-[#107C10]/20 rounded-sm text-xs font-semibold text-[#107C10] mb-6 font-body">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#107C10] inline-block" /> Available Now
                </span>
                <h3 className="font-display font-black text-4xl md:text-5xl leading-none tracking-tight mb-5 text-[#201F1E]">{featuredGame.name}</h3>
                <p className="text-base text-[#605E5C] leading-relaxed mb-8 font-body">{featuredGame.description}</p>

                {featuredGame.platforms?.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-8">
                    {featuredGame.platforms.map((p, i) => (
                      <a
                        key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E1DFDD] rounded-sm text-xs font-medium text-[#605E5C] hover:border-[#0078D4] hover:text-[#0078D4] hover:bg-[#EFF6FC] transition-all font-body"
                        data-testid={`platform-${p.name}`}
                      >
                        <ExternalLink size={11} />
                        {PLATFORM_ICONS[p.name] || p.name}
                      </a>
                    ))}
                  </div>
                )}

                <Link to="/games" className="az-btn-primary inline-flex items-center gap-2">
                  View all games <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-[#EFF6FC] border border-[#C7E0F4] rounded-sm flex items-center justify-center mx-auto mb-6">
                <Gamepad2 size={28} className="text-[#0078D4]" />
              </div>
              <h3 className="font-display font-black text-4xl mb-3 text-[#201F1E]">OUR GAMES</h3>
              <p className="text-[#605E5C] text-base mb-8 font-body">Something big is in development. Stay tuned.</p>
              <Link to="/games" className="az-btn-primary inline-flex items-center gap-2">
                Explore games <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="relative py-24 overflow-hidden bg-[#201F1E]" data-testid="contact-section">
        {/* Subtle dark grid */}
        <div className="absolute inset-0 az-line-grid opacity-30" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0078D4] via-[#40A9FF] to-transparent opacity-60" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-8 h-px bg-[#0078D4]" />
              <span className="text-xs font-semibold tracking-widest uppercase text-[#40A9FF] font-body">Contact</span>
            </div>
            <h2 className="font-display font-black text-5xl md:text-6xl leading-none tracking-tight text-white mb-6">
              GET IN<br />TOUCH
            </h2>
            <p className="text-[#A19F9D] text-base leading-relaxed font-body">
              Interested in working with us, pitching a collaboration, or just want to say hello? We'd love to hear from you.
            </p>
          </div>

          <div>
            <a
              href="mailto:vakargames@gmail.com"
              className="group block az-panel p-8 bg-white border border-[#D7E3F5] hover:bg-[#F6FAFF] shadow-[0_18px_45px_rgba(0,120,212,0.16)] transition-all"
              data-testid="contact-email-button"
              style={{ border: '1px solid rgba(0,120,212,0.18)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#0078D4] mb-2 font-body tracking-widest uppercase font-semibold">Email us</p>
                  <p className="text-xl font-semibold text-[#111827] font-display">vakargames@gmail.com</p>
                </div>
                <div className="w-10 h-10 rounded-sm bg-[#0078D4] flex items-center justify-center transition-transform group-hover:translate-x-1">
                  <ArrowRight size={18} className="text-white" />
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#1B1A19] border-t border-white/5" data-testid="landing-footer">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <span className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</span>
            <div className="flex items-center gap-5">
              <Link to="/games" className="text-xs text-[#605E5C] hover:text-white transition-colors font-body uppercase tracking-wider">Games</Link>
              <Link to="/blog" className="text-xs text-[#605E5C] hover:text-white transition-colors font-body uppercase tracking-wider">Blog</Link>
            </div>
          </div>
          <p className="text-xs text-[#605E5C] font-body">&copy; {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
