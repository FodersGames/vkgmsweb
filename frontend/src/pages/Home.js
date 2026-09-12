import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaretDown, GameController } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { getPublicGames } from '../utils/publicCache';
import heroCoastSunset from '../assets/photos/hero-coast-sunset.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const img = (url) => (url?.startsWith('/') ? `${API_URL}${url}` : url);

/* ─── Stat card ─────────────────────────────────────────────────────────── */
const StatCard = ({ value, label }) => (
  <div className="text-center px-4 py-7 flex flex-col items-center justify-center min-w-0" style={{ borderRight: '1px solid #E5E7EB' }}>
    <p className="stat-number">{value}</p>
    <p className="kefir-label mt-2" style={{ color: '#71717A', fontSize: '0.65rem' }}>{label}</p>
  </div>
);

/* ─── Home ──────────────────────────────────────────────────────────────── */
const Home = () => {
  const studioRef = useRef(null);
  const { user } = useAuth();
  const [games, setGames] = useState([]);

  useEffect(() => {
    document.title = 'Vakar Games — Independent Video Game Studio';
    getPublicGames()
      .then(gamesList => setGames(gamesList || []))
      .catch(() => {});
  }, []);

  const scrollToStudio = () =>
    studioRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0A0A0A', minHeight: '100vh' }}>
      <PublicNav onAbout={scrollToStudio} />

      {/* ── HERO ─ 100vh cinematic background with crisp white overlay ────────── */}
      <section
        className="relative flex flex-col items-center justify-center text-center overflow-hidden"
        style={{ height: '100vh', minHeight: '560px' }}
        data-testid="hero-section"
      >
        {/* Cinematic Video Background with Crisp White Overlay */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster={heroCoastSunset}
            className="w-full h-full object-cover object-center"
            style={{
              filter: 'brightness(1.0) contrast(1.05) saturate(1.1)',
              opacity: 0.28,
              transform: 'scale(1.03)',
            }}
          >
            <source src={`${process.env.PUBLIC_URL || ''}/videos/programmer.mp4`} type="video/mp4" />
          </video>
          {/* Gradients for crisp text contrast and seamless fade into pure #FFFFFF */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 35%, rgba(255,255,255,0.92) 85%, #FFFFFF 100%)',
            }}
          />
          {/* Radial orange glow centered behind title */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 65% 50% at 50% 50%, rgba(255, 102, 0, 0.08) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Center content */}
        <div className="relative z-10 px-6 fade-up max-w-4xl mx-auto">
          <h1
            className="font-black uppercase tracking-tight text-[#0A0A0A]"
            style={{ fontSize: 'clamp(3rem, 8.5vw, 6.5rem)', lineHeight: 0.95, letterSpacing: '-0.02em' }}
            data-testid="hero-title"
          >
            Vakar Games
          </h1>
          <p
            className="font-bold uppercase tracking-[0.28em] mt-5"
            style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.2rem)', color: '#FF6600' }}
          >
            Forged in Passion
          </p>

          {/* CTA buttons */}
          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <Link to="/games" className="btn-kefir">
              View Games
            </Link>
            <Link to="/blog" className="btn-kefir-outline">
              Studio Blog
            </Link>
          </div>
        </div>

        {/* Scroll chevron */}
        <button
          onClick={scrollToStudio}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#0A0A0A]/30 hover:text-[#0A0A0A]/70 transition-colors animate-bounce-y"
          aria-label="Scroll down"
        >
          <CaretDown size={28} weight="bold" />
        </button>
      </section>

      {/* ── STATS BANNER ───────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderLeft: '1px solid #E5E7EB' }}>
            <StatCard value="2024" label="Founded" />
            <StatCard value="France" label="HQ" />
            <StatCard value={games.length > 0 ? `${games.length}` : 'Original'} label="Productions" />
            <StatCard value="PC · Web" label="Platforms" />
          </div>
        </div>
      </section>

      {/* ── GAMES SHOWCASE ─────────────────────────────────────────────── */}
      <section
        id="games"
        style={{ backgroundColor: '#F8F9FA', paddingTop: '6rem', paddingBottom: '6rem' }}
      >
        <div className="max-w-[1100px] mx-auto px-6">
          {/* Section header */}
          <div className="mb-12">
            <p className="kefir-label mb-4" style={{ color: '#71717A' }}>Our Productions</p>
            <h2
              className="font-black uppercase text-[#0A0A0A]"
              style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)', lineHeight: 1.05, letterSpacing: '-0.02em' }}
            >
              Games
            </h2>
          </div>

          {games.length > 0 ? (
            <div className="space-y-2">
              {games.map((game) => (
                <Link
                  key={game.slug}
                  to="/games"
                  className="group block relative overflow-hidden"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    transition: 'border-color 0.3s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#FF6600'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                  data-testid={`game-card-${game.slug}`}
                >
                  <div className="flex flex-col sm:flex-row items-stretch">
                    {/* Banner image */}
                    <div className="sm:w-64 h-44 sm:h-auto flex-shrink-0 relative overflow-hidden">
                      {game.banner_url || game.logo_url ? (
                        <img
                          src={img(game.banner_url || game.logo_url)}
                          alt={game.name}
                          className="w-full h-full object-cover"
                          style={{ transition: 'transform 0.6s ease', transform: 'scale(1)' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#F4F4F5' }}>
                          <GameController size={40} style={{ color: '#FF6600', opacity: 0.6 }} />
                        </div>
                      )}
                    </div>

                    {/* Game info */}
                    <div className="flex-1 p-8 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-4 mb-3">
                          <h3
                            className="font-black uppercase text-[#0A0A0A] group-hover:text-[#FF6600] transition-colors"
                            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', letterSpacing: '-0.01em', lineHeight: 1 }}
                          >
                            {game.name}
                          </h3>
                          {game.status === 'coming_soon' && (
                            <span
                              className="text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1"
                              style={{ color: '#FF6600', border: '1px solid #FF6600', backgroundColor: 'rgba(255,102,0,0.06)' }}
                            >
                              Coming Soon
                            </span>
                          )}
                        </div>
                        {game.description && (
                          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: '#52525B' }}>
                            {game.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-5">
                        <span className="btn-kefir text-[10px] py-2 px-4">
                          Discover
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              className="text-center py-20"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
            >
              <GameController size={48} style={{ color: 'rgba(255, 102, 0,0.5)', margin: '0 auto 1rem' }} />
              <h3 className="font-black uppercase text-[#0A0A0A] text-2xl tracking-tight mb-3">
                New Titles In Production
              </h3>
              <p className="text-sm" style={{ color: '#71717A', marginBottom: '2rem' }}>
                Our games are currently in development. Follow the studio blog for updates.
              </p>
              <Link to="/blog" className="btn-kefir-outline">
                Read Devlogs
              </Link>
            </div>
          )}

          <div className="mt-8">
            <Link to="/games" className="btn-kefir-outline">
              All Games →
            </Link>
          </div>
        </div>
      </section>

      {/* ── THE STUDIO ─────────────────────────────────────────────────── */}
      <section
        ref={studioRef}
        id="studio"
        style={{ backgroundColor: '#FFFFFF', paddingTop: '6rem', paddingBottom: '6rem', borderTop: '1px solid #E5E7EB' }}
        data-testid="about-section"
      >
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="kefir-label mb-4" style={{ color: '#71717A' }}>The Studio</p>
              <h2
                className="font-black uppercase text-[#0A0A0A]"
                style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', lineHeight: 1.05, letterSpacing: '-0.02em' }}
              >
                We Make<br />
                <span style={{ color: '#FF6600' }}>Games</span><br />
                We Love.
              </h2>
              <p className="mt-6 leading-relaxed" style={{ color: '#52525B', fontSize: '1rem', maxWidth: '42ch' }}>
                Vakar Games is an independent studio based in France. We keep our team compact by design — every developer, artist, and designer is closely tied to the vision. Small team, deliberate creative choices, zero shortcuts on gameplay.
              </p>
              <div className="mt-8 flex items-center gap-6 flex-wrap">
                <Link to="/blog" className="btn-kefir">
                  Studio Journal
                </Link>
                <Link to="/contact" className="btn-kefir-outline">
                  Get In Touch
                </Link>
              </div>
            </div>

            {/* Right — manifesto / philosophy cards */}
            <div className="space-y-px">
              {[
                { label: 'Player-First Design', desc: 'Tight mechanics, deliberate pacing, rich atmospheres that respect the player\'s time.' },
                { label: 'Original Universes', desc: 'Every world is built from scratch — atmospheric adventures to competitive multiplayer.' },
                { label: 'In-House Technology', desc: 'We write our own backend systems, player registries, and live operations.' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-6 py-5 flex items-start gap-4"
                  style={{ backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB', borderLeftWidth: '3px', borderLeftColor: '#FF6600' }}
                >
                  <div>
                    <p className="font-bold uppercase text-[#0A0A0A] text-sm tracking-[0.08em] mb-1">{item.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#71717A' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT CTA ────────────────────────────────────────────────── */}
      <section
        id="contact"
        style={{ backgroundColor: '#F8F9FA', paddingTop: '5rem', paddingBottom: '5rem', borderTop: '1px solid #E5E7EB' }}
      >
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="kefir-label mb-4" style={{ color: '#71717A' }}>Let's Talk</p>
          <h2
            className="font-black uppercase text-[#0A0A0A]"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}
          >
            Let's Talk <span style={{ color: '#FF6600' }}>Games.</span>
          </h2>
          <p className="mt-4 mx-auto" style={{ color: '#52525B', fontSize: '0.9rem', maxWidth: '38ch' }}>
            Press inquiries, publishing opportunities, or general questions — we read every message.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <Link to="/contact" className="btn-kefir">
              Contact Studio
            </Link>
            <a href="mailto:support@vakargames.com" className="btn-kefir-outline">
              Email Directly
            </a>
          </div>
        </div>
      </section>

      <SiteFooter onAbout={scrollToStudio} />
    </div>
  );
};

export default Home;
