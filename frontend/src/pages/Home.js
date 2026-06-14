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
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'glass border-b border-white/[0.08] shadow-[0_0_60px_rgba(0,0,0,0.8)]'
          : 'bg-transparent border-b border-transparent'
      }`}
      data-testid="landing-navbar"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3 group" data-testid="landing-logo">
            {/* 3D Logo mark */}
            <div className="relative w-8 h-8" style={{ perspective: '120px', transformStyle: 'preserve-3d' }}>
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #FFFFFF 0%, #A0A0A8 100%)',
                borderRadius: '6px',
                transform: 'rotateX(12deg) rotateY(-16deg)',
                boxShadow: '3px 5px 0px rgba(255,255,255,0.25), 0 0 20px rgba(255,255,255,0.08)',
                transition: 'transform 0.4s ease, box-shadow 0.4s ease',
              }}
              className="group-hover:[transform:rotateX(18deg)_rotateY(-24deg)_scale(1.05)]"
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-white font-display">VAKAR GAMES</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/#about', label: 'About' },
              { to: '/games', label: 'Games' },
              { to: '/blog', label: 'Blog' },
            ].map(({ to, label }) => (
              <Link
                key={label}
                to={to}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 font-body
                  ${activePath === to
                    ? 'text-white bg-white/10 border border-white/15'
                    : 'text-[#A1A1A6] hover:text-white hover:bg-white/06'}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button className="md:hidden btn-icon" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
          {mobileMenu ? <X size={16} className="text-white" /> : <Menu size={16} className="text-white" />}
        </button>
      </div>
      {mobileMenu && (
        <div className="md:hidden glass border-t border-white/08 px-6 py-4 space-y-1" data-testid="mobile-menu">
          <Link to="/" className="block px-4 py-3 text-sm text-[#A1A1A6] hover:text-white hover:bg-white/06 rounded-xl transition-all" onClick={() => setMobileMenu(false)}>Home</Link>
          <Link to="/games" className="block px-4 py-3 text-sm text-[#A1A1A6] hover:text-white hover:bg-white/06 rounded-xl transition-all" onClick={() => setMobileMenu(false)}>Games</Link>
          <Link to="/blog" className="block px-4 py-3 text-sm text-[#A1A1A6] hover:text-white hover:bg-white/06 rounded-xl transition-all" onClick={() => setMobileMenu(false)}>Blog</Link>
        </div>
      )}
    </nav>
  );
};

/* ── Animated 3D Sphere (CSS only) ── */
const HeroSphere = () => (
  <div className="relative float-anim" style={{ width: 380, height: 380 }}>
    {/* Outer glow */}
    <div style={{
      position: 'absolute', inset: '-20px',
      background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
      animation: 'orb-pulse 4s ease-in-out infinite',
      borderRadius: '50%',
    }} />
    {/* Main sphere */}
    <div style={{
      width: '100%', height: '100%',
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 30%, rgba(0,0,0,0.8) 80%, #000 100%)',
      boxShadow: 'inset -30px -30px 60px rgba(0,0,0,0.6), inset 20px 20px 40px rgba(255,255,255,0.08), 0 30px 100px rgba(0,0,0,0.8), 0 0 80px rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Specular highlight */}
      <div style={{
        position: 'absolute', top: '12%', left: '22%',
        width: '35%', height: '25%',
        background: 'radial-gradient(ellipse, rgba(255,255,255,0.22) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(8px)',
      }} />
      {/* Rotating ring 1 */}
      <div style={{
        position: 'absolute', inset: '8%',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.08)',
        animation: 'rotate-slow 12s linear infinite',
        transform: 'rotateX(70deg)',
      }} />
      {/* Rotating ring 2 */}
      <div style={{
        position: 'absolute', inset: '20%',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.05)',
        animation: 'rotate-slow 18s linear infinite reverse',
        transform: 'rotateY(60deg)',
      }} />
      {/* Inner glow */}
      <div style={{
        position: 'absolute', bottom: '15%', right: '15%',
        width: '30%', height: '30%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(12px)',
      }} />
    </div>
    {/* Reflection shadow */}
    <div style={{
      position: 'absolute', bottom: '-40px', left: '50%',
      transform: 'translateX(-50%)',
      width: '60%', height: '20px',
      background: 'radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)',
      filter: 'blur(12px)',
    }} />
  </div>
);

/* ── Particle dots background ── */
const ParticlesBg = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="dot-grid absolute inset-0 opacity-100" />
    {/* Radial gradient overlay */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 100%)',
    }} />
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
    <div style={{ background: '#080808', color: '#F5F5F7' }} className="font-body min-h-screen">
      <Navbar activePath="/" />

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex items-center overflow-hidden pt-16"
        data-testid="hero-section"
        style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #080808 100%)' }}
      >
        <ParticlesBg />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-28 lg:py-36 w-full grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div>
            <div className="fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full border border-white/10 mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#30D158]" style={{ animation: 'orb-pulse 2s ease-in-out infinite' }} />
                <span className="text-xs font-medium text-[#A1A1A6] tracking-wide uppercase">Independent Studio</span>
              </div>
            </div>

            <h1 className="fade-up delay-1 font-display font-bold leading-[0.92] tracking-tight mb-6"
              style={{ fontSize: 'clamp(3.5rem, 8vw, 6.5rem)', letterSpacing: '-0.03em' }}>
              <span className="gradient-text-bright block">VAKAR</span>
              <span className="text-[#3A3A3C] block">GAMES</span>
            </h1>

            <p className="fade-up delay-2 text-lg text-[#A1A1A6] leading-relaxed mb-10 max-w-lg font-body" style={{ fontWeight: 300 }}>
              We build games that players remember. Immersive worlds, unforgettable characters, experiences engineered to push boundaries.
            </p>

            <div className="fade-up delay-3 flex flex-wrap gap-3">
              <button onClick={scrollToAbout} className="btn-primary">
                Discover our work <ArrowRight size={14} />
              </button>
              <Link to="/games" className="btn-ghost">
                Browse games <ChevronRight size={14} />
              </Link>
            </div>

            {/* Stat strip */}
            <div className="fade-up delay-4 mt-14 flex gap-8 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { value: '100%', label: 'Indie & Passionate' },
                { value: 'FR', label: 'French Studio' },
                { value: '∞', label: 'Creative drive' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-2xl font-bold font-display text-white">{value}</p>
                  <p className="text-xs text-[#6E6E73] mt-0.5 font-body">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: 3D sphere */}
          <div className="hidden lg:flex items-center justify-center fade-up delay-2">
            <HeroSphere />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ opacity: 0.3 }}>
          <span className="text-[10px] tracking-widest uppercase font-body text-[#6E6E73]">Scroll</span>
          <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)' }} />
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section ref={aboutRef} className="relative py-32 overflow-hidden" data-testid="about-section">
        <div className="section-divider mb-0" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32">
          {/* Label */}
          <div className="flex items-center gap-4 mb-16">
            <div className="w-6 h-px bg-white/30" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#6E6E73]">About the Studio</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div>
              <h2 className="font-display font-bold leading-none tracking-tight mb-8 gradient-text-bright"
                style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', letterSpacing: '-0.03em' }}>
                WHO<br />WE ARE
              </h2>
              <p className="text-base text-[#A1A1A6] leading-relaxed mb-5 font-body" style={{ fontWeight: 300 }}>
                Vakar Games is a French video game development studio driven by passion and creativity. We build immersive worlds, unforgettable characters, and experiences that push boundaries.
              </p>
              <p className="text-base text-[#A1A1A6] leading-relaxed mb-10 font-body" style={{ fontWeight: 300 }}>
                From concept to launch, every pixel, every line of code, every mechanic is crafted with intent. Our mission is simple: create games players remember forever.
              </p>
              <Link to="/games" className="btn-primary">
                See our games <ArrowRight size={14} />
              </Link>
            </div>

            {/* Capability cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Gamepad2, title: 'Game Development', desc: 'Building worlds from concept to launch across multiple platforms' },
                { icon: Code, title: 'Technology', desc: 'Cutting-edge engines and tools for seamless player experiences' },
                { icon: Users, title: 'Community', desc: 'Players at the center of every design decision we make' },
                { icon: Zap, title: 'Innovation', desc: 'Pushing the limits of what interactive experiences can be' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={i}
                  className="card-3d glass glass-hover rounded-2xl p-5 relative overflow-hidden cursor-default"
                >
                  {/* Top shimmer line */}
                  <div style={{
                    position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  }} />
                  <div className="mt-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-2 font-display">{title}</h4>
                    <p className="text-xs text-[#6E6E73] leading-relaxed font-body">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED GAME ── */}
      <section className="relative py-32 overflow-hidden" data-testid="games-section">
        <div className="section-divider" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32">
          <div className="flex items-center gap-4 mb-16">
            <div className="w-6 h-px bg-white/30" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#6E6E73]">Featured Game</span>
          </div>

          {featuredGame ? (
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="card-3d">
                <div className="glass rounded-2xl overflow-hidden" style={{ boxShadow: '0 30px 100px rgba(0,0,0,0.6), 0 0 60px rgba(255,255,255,0.03)' }}>
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
                    <div className="aspect-video flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <Gamepad2 size={48} className="text-[#3A3A3C]" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 glass-strong border border-white/10 rounded-full text-xs font-semibold text-[#30D158] mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] inline-block" style={{ animation: 'orb-pulse 2s ease-in-out infinite' }} /> Available Now
                </span>
                <h3 className="font-display font-bold leading-none tracking-tight mb-5 gradient-text-bright"
                  style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.03em' }}>
                  {featuredGame.name}
                </h3>
                <p className="text-base text-[#A1A1A6] leading-relaxed mb-8 font-body" style={{ fontWeight: 300 }}>
                  {featuredGame.description}
                </p>

                {featuredGame.platforms?.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-8">
                    {featuredGame.platforms.map((p, i) => (
                      <a
                        key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 glass glass-hover rounded-full text-xs font-medium text-[#A1A1A6] hover:text-white transition-all"
                        data-testid={`platform-${p.name}`}
                      >
                        <ExternalLink size={11} />
                        {PLATFORM_ICONS[p.name] || p.name}
                      </a>
                    ))}
                  </div>
                )}

                <Link to="/games" className="btn-primary">
                  View all games <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 glass glass-strong rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Gamepad2 size={28} className="text-[#6E6E73]" />
              </div>
              <h3 className="font-display font-bold text-4xl mb-3 gradient-text-bright" style={{ letterSpacing: '-0.02em' }}>OUR GAMES</h3>
              <p className="text-[#6E6E73] text-base mb-8 font-body">Something big is in development. Stay tuned.</p>
              <Link to="/games" className="btn-primary">
                Explore games <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="relative py-28 overflow-hidden" data-testid="contact-section">
        <div className="section-divider" />
        <div className="dot-grid absolute inset-0 opacity-60" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-28 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-6 h-px bg-white/30" />
              <span className="text-xs font-semibold tracking-widest uppercase text-[#6E6E73]">Contact</span>
            </div>
            <h2 className="font-display font-bold leading-none tracking-tight mb-6 gradient-text-bright"
              style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', letterSpacing: '-0.03em' }}>
              GET IN<br />TOUCH
            </h2>
            <p className="text-[#6E6E73] text-base leading-relaxed font-body" style={{ fontWeight: 300 }}>
              Interested in working with us, pitching a collaboration, or just want to say hello? We'd love to hear from you.
            </p>
          </div>

          <div>
            <a
              href="mailto:vakargames@gmail.com"
              className="group card-3d glass glass-hover rounded-2xl p-8 block relative overflow-hidden"
              data-testid="contact-email-button"
            >
              <div style={{
                position: 'absolute', top: 0, left: '20%', right: '20%', height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
              }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#6E6E73] mb-2 font-body tracking-widest uppercase">Email us</p>
                  <p className="text-xl font-semibold text-white font-display">vakargames@gmail.com</p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-1"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <ArrowRight size={16} className="text-white" />
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#040404' }} data-testid="landing-footer">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <span className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</span>
            <div className="flex items-center gap-5">
              <Link to="/games" className="text-xs text-[#6E6E73] hover:text-white transition-colors font-body uppercase tracking-wider">Games</Link>
              <Link to="/blog" className="text-xs text-[#6E6E73] hover:text-white transition-colors font-body uppercase tracking-wider">Blog</Link>
            </div>
          </div>
          <p className="text-xs text-[#3A3A3C] font-body">&copy; {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
