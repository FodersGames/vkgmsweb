import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Mail } from 'lucide-react';
import axios from 'axios';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATFORM_LABELS = {
  steam:        'Steam',
  google_play:  'Google Play',
  apple:        'App Store',
  pc:           'PC / Windows',
  web:          'Web',
  android:      'Android',
};

// Sparkle label component matching Synth AI eyebrow style
const Eyebrow = ({ children, className = '' }) => (
  <div className={`inline-flex items-center gap-2 mb-6 ${className}`}>
    <span className="text-[#4ECDC4] text-sm leading-none">✦</span>
    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
      {children}
    </span>
  </div>
);

const Home = () => {
  const aboutRef = useRef(null);
  const [featuredGame, setFeaturedGame] = useState(null);

  useEffect(() => {
    document.title = 'Vakar Games — Independent Game Studio';
    axios.get(`${API_URL}/api/website/games/featured`)
      .then(r => { if (r.data.game) setFeaturedGame(r.data.game); })
      .catch(() => {});
  }, []);

  const scrollToAbout = () =>
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ background: '#F8F9FF' }}>
      <PublicNav onAbout={scrollToAbout} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        data-testid="hero-section"
        style={{
          minHeight: '100vh',
          background: [
            'radial-gradient(ellipse 80% 100% at 78% 58%, rgba(185,178,255,0.22) 0%, rgba(145,230,218,0.16) 38%, rgba(255,205,215,0.10) 60%, transparent 75%)',
            '#F8F9FF',
          ].join(', '),
        }}
        className="flex items-center"
      >
        <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left — text */}
            <div>
              <Eyebrow>Independent Game Studio · France</Eyebrow>

              <h1
                className="text-[5rem] sm:text-[7rem] md:text-[8.5rem] lg:text-[9rem] leading-[0.88] font-black tracking-tight text-[#0A0A10] mb-6"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                data-testid="hero-title"
              >
                VAKAR<br />GAMES
              </h1>

              <p className="text-[17px] text-gray-500 max-w-md leading-relaxed mb-10">
                We build games we'd want to play. Small team, deliberate choices,
                and no shortcuts on what matters.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/games"
                  className="inline-flex items-center gap-2 bg-[#0A0A10] hover:bg-[#1a1a24] text-white text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-3.5 rounded-lg transition-colors"
                >
                  Our Games <span className="text-[11px]">↗</span>
                </Link>
                <button
                  onClick={scrollToAbout}
                  className="inline-flex items-center gap-2 border border-[#0A0A10]/20 hover:border-[#0A0A10]/50 text-[#0A0A10] text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-3.5 rounded-lg transition-colors bg-white/60 hover:bg-white/80"
                >
                  About Us
                </button>
              </div>
            </div>

            {/* Right — visual */}
            <div className="relative flex items-center justify-center">
              {/* Iridescent glow blob */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(78,205,196,0.28) 0%, rgba(185,178,255,0.25) 45%, rgba(255,205,215,0.18) 75%, transparent 90%)',
                  filter: 'blur(48px)',
                  transform: 'scale(0.9)',
                }}
              />

              {/* Game logo or placeholder */}
              <div className="relative z-10 w-full max-w-md aspect-square flex items-center justify-center">
                {featuredGame?.logo_url ? (
                  <img
                    src={featuredGame.logo_url.startsWith('/') ? `${API_URL}${featuredGame.logo_url}` : featuredGame.logo_url}
                    alt={featuredGame.name}
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-[40px] flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.55)',
                      backdropFilter: 'blur(24px)',
                      border: '1px solid rgba(255,255,255,0.9)',
                      boxShadow: '0 32px 80px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    <span
                      className="text-[80px] font-black leading-none"
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        background: 'linear-gradient(135deg, #4ECDC4 0%, #b8b0ff 60%, #ffcdd7 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      VG
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div
            className="mt-16 pt-10 border-t grid grid-cols-2 sm:grid-cols-4 gap-8"
            style={{ borderColor: 'rgba(0,0,0,0.07)' }}
          >
            {[
              { n: '2024',        label: 'Studio founded' },
              { n: 'France',      label: 'Based in'       },
              { n: 'PC · Mobile', label: 'Platforms'      },
              { n: 'Indie',       label: 'Spirit'         },
            ].map((s, i) => (
              <div key={i}>
                <div
                  className="text-2xl font-black text-[#0A0A10]"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {s.n}
                </div>
                <div className="text-[12px] text-gray-400 mt-0.5 uppercase tracking-[0.1em] font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Studio / About ───────────────────────────────────────────────── */}
      <section
        ref={aboutRef}
        data-testid="about-section"
        className="py-28 px-6 bg-white"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-start">

            <div>
              <Eyebrow>The Studio</Eyebrow>
              <h2
                className="text-5xl sm:text-6xl font-black text-[#0A0A10] leading-[0.92] tracking-tight mb-8"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                BUILDING<br />GAMES WORTH<br />PLAYING
              </h2>
              <div className="space-y-4 text-[15px] text-gray-500 leading-relaxed">
                <p>
                  Vakar Games is an independent studio. We focus on a small number of projects
                  at a time — not because we have to, but because we believe constraint leads to better work.
                </p>
                <p>
                  We develop across PC and mobile, with a focus on tight mechanics, clear design
                  and experiences that respect the player's time.
                </p>
                <p>
                  Our toolset is built in-house: we manage projects, players, missions and shop
                  systems from our own platform, so we can move fast without losing control.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  num: '01',
                  title: 'Game Development',
                  text: 'From first prototype to final release. We work across PC and mobile with a focus on gameplay that feels right, not just looks right.',
                },
                {
                  num: '02',
                  title: 'Community & Players',
                  text: 'Players are part of the process. We share progress, collect feedback and iterate — because better games come from that loop.',
                },
                {
                  num: '03',
                  title: 'Internal Tooling',
                  text: 'We build what we need. Our studio platform manages accounts, game data, shop systems and team workflows — all under our control.',
                },
              ].map(item => (
                <div
                  key={item.num}
                  className="group flex gap-5 p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: 'rgba(0,0,0,0.07)',
                    background: '#F8F9FF',
                    boxShadow: '0 2px 0 rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 0 rgba(0,0,0,0.04)'}
                >
                  <span
                    className="text-[11px] font-bold text-[#4ECDC4] tracking-wider pt-0.5 shrink-0"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    {item.num}
                  </span>
                  <div>
                    <h3 className="text-[13px] font-bold text-[#0A0A10] mb-1.5 uppercase tracking-[0.08em]">
                      {item.title}
                    </h3>
                    <p className="text-[13px] text-gray-500 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Game ─────────────────────────────────────────────────── */}
      <section
        id="games"
        data-testid="games-section"
        className="py-28 px-6"
        style={{ background: '#F8F9FF' }}
      >
        <div className="max-w-7xl mx-auto">
          {featuredGame ? (
            <>
              <Eyebrow>Featured Release</Eyebrow>
              <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                <div className="order-2 lg:order-1">
                  <h2
                    className="text-5xl sm:text-6xl font-black text-[#0A0A10] leading-[0.92] tracking-tight mb-4"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    {featuredGame.name.toUpperCase()}
                  </h2>
                  {featuredGame.description && (
                    <p className="text-[15px] text-gray-500 leading-relaxed mb-8 max-w-md">
                      {featuredGame.description}
                    </p>
                  )}
                  {featuredGame.platforms?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-8">
                      {featuredGame.platforms.map((p, i) => (
                        <a
                          key={i}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] border px-3.5 py-2 rounded-lg transition-all"
                          style={{ borderColor: 'rgba(0,0,0,0.12)', color: '#4B5563' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ECDC4'; e.currentTarget.style.color = '#0A0A10'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.color = '#4B5563'; }}
                        >
                          {PLATFORM_LABELS[p.name] || p.name}
                          <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  )}
                  <Link
                    to="/games"
                    className="inline-flex items-center gap-2 bg-[#0A0A10] hover:bg-[#1a1a24] text-white text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-3.5 rounded-lg transition-colors"
                  >
                    All Our Games <ArrowRight size={13} />
                  </Link>
                </div>

                <div className="order-1 lg:order-2 relative">
                  <div
                    className="absolute inset-0 rounded-3xl"
                    style={{
                      background: 'radial-gradient(circle at 50% 50%, rgba(78,205,196,0.18) 0%, rgba(185,178,255,0.15) 60%, transparent 80%)',
                      filter: 'blur(32px)',
                    }}
                  />
                  {featuredGame.logo_url ? (
                    <img
                      src={featuredGame.logo_url.startsWith('/') ? `${API_URL}${featuredGame.logo_url}` : featuredGame.logo_url}
                      alt={featuredGame.name}
                      className="relative z-10 w-full max-w-lg mx-auto rounded-2xl"
                      style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.12)' }}
                    />
                  ) : featuredGame.screenshots?.[0] ? (
                    <img
                      src={featuredGame.screenshots[0].startsWith('/') ? `${API_URL}${featuredGame.screenshots[0]}` : featuredGame.screenshots[0]}
                      alt={featuredGame.name}
                      className="relative z-10 w-full rounded-2xl"
                      style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.12)' }}
                    />
                  ) : (
                    <div
                      className="relative z-10 w-full aspect-video rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'rgba(255,255,255,0.7)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,0.9)',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.08)',
                      }}
                    >
                      <span
                        className="text-4xl font-black"
                        style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          background: 'linear-gradient(135deg, #4ECDC4 0%, #b8b0ff 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {featuredGame.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Eyebrow className="justify-center">Our Games</Eyebrow>
              <h2
                className="text-5xl sm:text-6xl font-black text-[#0A0A10] mb-4 tracking-tight"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                IN DEVELOPMENT
              </h2>
              <p className="text-[15px] text-gray-500 mb-8">
                New titles are in progress. Follow the blog for updates.
              </p>
              <Link
                to="/games"
                className="inline-flex items-center gap-2 bg-[#0A0A10] hover:bg-[#1a1a24] text-white text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-3.5 rounded-lg transition-colors"
              >
                Game Catalog <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <section
        id="contact"
        data-testid="contact-section"
        className="py-28 px-6 bg-[#0A0A10]"
      >
        <div className="max-w-7xl mx-auto">
          <div
            className="relative rounded-3xl overflow-hidden px-10 py-20 text-center"
            style={{
              background: [
                'radial-gradient(ellipse 80% 100% at 50% -10%, rgba(78,205,196,0.18) 0%, transparent 60%)',
                'rgba(255,255,255,0.03)',
              ].join(', '),
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* decorative glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse, rgba(78,205,196,0.15) 0%, transparent 70%)',
                filter: 'blur(32px)',
              }}
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="text-[#4ECDC4] text-sm">✦</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">Contact</span>
              </div>
              <h2
                className="text-5xl sm:text-6xl md:text-7xl font-black text-white leading-[0.92] tracking-tight mb-5"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                LET'S TALK
              </h2>
              <p className="text-[15px] text-gray-400 mb-10 max-w-md mx-auto leading-relaxed">
                Questions about our games, a collaboration proposal or press inquiries — reach us directly.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  to="/contact"
                  data-testid="contact-email-button"
                  className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-[#0A0A10] text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-3.5 rounded-lg transition-colors"
                >
                  Open a Ticket <ArrowRight size={13} />
                </Link>
                <a
                  href="mailto:support@vakargames.com"
                  className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-white text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-3.5 rounded-lg transition-colors"
                >
                  <Mail size={13} /> Email Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter onAbout={scrollToAbout} />
    </div>
  );
};

export default Home;
