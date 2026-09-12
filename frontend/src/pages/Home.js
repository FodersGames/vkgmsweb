import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaretDown, GameController } from '@phosphor-icons/react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { getPublicGames } from '../utils/publicCache';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';
const img = (url) => (url?.startsWith('/') ? `${API_URL}${url}` : url);

const Home = () => {
  const studioRef = useRef(null);
  const [games, setGames] = useState([]);

  useEffect(() => {
    document.title = 'Vakar Games | Independent Video Game Studio';
    getPublicGames()
      .then(gamesList => setGames(gamesList || []))
      .catch(() => {});
  }, []);

  const scrollToStudio = () =>
    studioRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="bg-white text-[#1D1D1F] min-h-screen">
      <PublicNav onAbout={scrollToStudio} />

      {/* ── HERO ─ Apple Dark Section ─────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center text-center overflow-hidden bg-[#1D1D1F]"
        style={{ minHeight: '92vh' }}
        data-testid="hero-section"
      >
        {/* Background Video */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover object-center"
            style={{
              filter: 'brightness(0.45) contrast(1.1)',
              transform: 'scale(1.02)',
            }}
          >
            <source src={`${process.env.PUBLIC_URL || ''}/videos/programmer.mp4`} type="video/mp4" />
          </video>
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(29,29,31,0.4) 0%, rgba(29,29,31,0.2) 40%, rgba(29,29,31,0.85) 90%, #1D1D1F 100%)',
            }}
          />
        </div>

        {/* Center Content */}
        <div className="relative z-10 px-6 max-w-3xl mx-auto">
          <h1
            className="font-bold text-white tracking-tight"
            style={{ fontSize: 'clamp(2.8rem, 7vw, 5.5rem)', lineHeight: 1.05 }}
            data-testid="hero-title"
          >
            Vakar Games
          </h1>
          <p
            className="text-white/80 font-normal mt-4"
            style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.45rem)' }}
          >
            Forged in Passion.
          </p>

          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <Link to="/games" className="btn-apple-light">
              View Games
            </Link>
            <Link to="/blog" className="btn-apple-light-outline">
              Studio Blog
            </Link>
          </div>
        </div>

        {/* Scroll down indicator */}
        <button
          onClick={scrollToStudio}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 hover:text-white transition-colors animate-bounce-y"
          aria-label="Scroll down"
        >
          <CaretDown size={24} />
        </button>
      </section>

      {/* ── STATS STRIP ─ Clean White ─────────────────────────────────── */}
      <section className="bg-white border-b border-[#E5E5EA]">
        <div className="max-w-[1120px] mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x-0 md:divide-x divide-[#E5E5EA]">
            <div>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1D1D1F]">2024</p>
              <p className="text-[13px] text-[#86868B] mt-1">Founded</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1D1D1F]">France</p>
              <p className="text-[13px] text-[#86868B] mt-1">Studio HQ</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1D1D1F]">
                {games.length > 0 ? games.length : '1'}
              </p>
              <p className="text-[13px] text-[#86868B] mt-1">Productions</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1D1D1F]">PC · Web</p>
              <p className="text-[13px] text-[#86868B] mt-1">Platforms</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── GAMES SHOWCASE ─ Clean White ──────────────────────────────── */}
      <section id="games" className="bg-white py-20 md:py-28">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="mb-14">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
              Games
            </h2>
            <p className="text-base md:text-lg text-[#86868B] mt-2">
              Original titles crafted with deliberate vision.
            </p>
          </div>

          {games.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-8">
              {games.map((game) => (
                <Link
                  key={game.slug}
                  to="/games"
                  className="group block bg-[#F5F5F7] rounded-2xl overflow-hidden border border-[#E5E5EA] transition-all hover:border-[#D2D2D7] hover:shadow-md"
                  data-testid={`game-card-${game.slug}`}
                >
                  <div className="aspect-[16/9] w-full bg-[#E5E5EA] overflow-hidden relative">
                    {game.banner_url || game.logo_url ? (
                      <img
                        src={img(game.banner_url || game.logo_url)}
                        alt={game.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GameController size={48} className="text-[#86868B]" />
                      </div>
                    )}
                  </div>
                  <div className="p-7">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <h3 className="text-2xl font-semibold text-[#1D1D1F] group-hover:text-[#FF6600] transition-colors">
                        {game.name}
                      </h3>
                      {game.status === 'coming_soon' && (
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white text-[#FF6600] border border-[#FF6600]/30">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    {game.description && (
                      <p className="text-sm text-[#6E6E73] line-clamp-2 leading-relaxed mb-4">
                        {game.description}
                      </p>
                    )}
                    <span className="inline-flex items-center text-sm font-medium text-[#1D1D1F] group-hover:text-[#FF6600] transition-colors">
                      Discover &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-[#F5F5F7] rounded-2xl p-12 text-center border border-[#E5E5EA]">
              <GameController size={44} className="text-[#86868B] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#1D1D1F] mb-2">
                New Titles in Development
              </h3>
              <p className="text-sm text-[#6E6E73] max-w-md mx-auto mb-6">
                Our games are currently in production. Follow the studio devlog for behind-the-scenes progress.
              </p>
              <Link to="/blog" className="btn-apple">
                Read Studio Devlog
              </Link>
            </div>
          )}

          <div className="mt-10">
            <Link to="/games" className="btn-apple-outline">
              All Games &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── THE STUDIO ─ Apple Dark Section with Real Photography ─────── */}
      <section
        ref={studioRef}
        id="studio"
        className="bg-[#1D1D1F] text-white py-24 md:py-32 relative overflow-hidden"
        data-testid="about-section"
      >
        <div className="max-w-[1120px] mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <div>
              <p className="text-[13px] font-medium text-[#FF6600] mb-3">
                The Studio
              </p>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
                We make games <br />we love.
              </h2>
              <p className="mt-6 text-[#A1A1A6] text-base leading-relaxed max-w-lg">
                Vakar Games is an independent studio based in France. We keep our team compact by design, where every developer, artist, and designer is directly connected to the vision. Deliberate creative choices, zero shortcuts on gameplay.
              </p>
              <div className="mt-8 flex items-center gap-4 flex-wrap">
                <Link to="/blog" className="btn-apple-light">
                  Studio Journal
                </Link>
                <Link to="/contact" className="btn-apple-light-outline">
                  Get In Touch
                </Link>
              </div>
            </div>

            {/* Real landscape photography (Provence cliffs from user's downloads) */}
            <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
              <img
                src="/photos/studio-landscape.jpg"
                alt="Studio atmosphere"
                className="w-full h-80 lg:h-96 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1D1D1F]/70 via-transparent to-transparent" />
            </div>
          </div>

          {/* 3 Core Pillars in Apple Minimalist Style */}
          <div className="grid md:grid-cols-3 gap-8 mt-20 pt-16 border-t border-white/10">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Player-First Design
              </h3>
              <p className="text-sm text-[#86868B] leading-relaxed">
                Tight mechanics, deliberate pacing, and immersive atmospheres that respect the player's time.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Original Universes
              </h3>
              <p className="text-sm text-[#86868B] leading-relaxed">
                Every world is designed from scratch, from atmospheric single-player to memorable multiplayer experiences.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                In-House Technology
              </h3>
              <p className="text-sm text-[#86868B] leading-relaxed">
                We craft our own backend services, player registries, and live operations architecture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT CTA ─ Clean White ─────────────────────────────────── */}
      <section id="contact" className="bg-white py-20 md:py-28 border-t border-[#E5E5EA]">
        <div className="max-w-[1120px] mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
            Let's talk games.
          </h2>
          <p className="mt-4 text-base text-[#6E6E73] max-w-md mx-auto">
            Press inquiries, publishing opportunities, or general questions. We read every message.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <Link to="/contact" className="btn-apple">
              Contact Studio
            </Link>
            <a href="mailto:support@vakargames.com" className="btn-apple-outline">
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
