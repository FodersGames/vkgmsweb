import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, ExternalLink, Gamepad2, Zap, Users } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/* ── Palm SVG silhouette ── */
const PalmLeft = () => (
  <svg viewBox="0 0 160 400" className="absolute bottom-0 left-0 h-[70vh] opacity-30 pointer-events-none select-none" fill="none">
    <path d="M75 400 Q72 300 80 240 Q60 200 20 170 Q50 175 80 210 Q70 170 30 120 Q65 140 85 190 Q82 150 55 90 Q88 120 90 180 Q95 140 80 70 Q105 110 100 190 Q115 150 105 80 Q125 120 115 200 Q140 160 145 90 Q148 150 125 210 Q130 190 155 180 Q130 200 110 230 Q115 280 110 400Z" fill="#1a0026"/>
  </svg>
);

const PalmRight = () => (
  <svg viewBox="0 0 160 400" className="absolute bottom-0 right-0 h-[70vh] opacity-30 pointer-events-none select-none" fill="none">
    <path d="M85 400 Q88 300 80 240 Q100 200 140 170 Q110 175 80 210 Q90 170 130 120 Q95 140 75 190 Q78 150 105 90 Q72 120 70 180 Q65 140 80 70 Q55 110 60 190 Q45 150 55 80 Q35 120 45 200 Q20 160 15 90 Q12 150 35 210 Q30 190 5 180 Q30 200 50 230 Q45 280 50 400Z" fill="#1a0026"/>
  </svg>
);

/* ── Bird SVG ── */
const Birds = () => (
  <svg viewBox="0 0 300 80" className="absolute top-[18%] right-[10%] w-40 opacity-40 pointer-events-none" fill="none">
    <path d="M10 30 Q25 20 40 30" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M60 20 Q78 10 95 20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M120 35 Q135 26 150 35" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M200 15 Q218 5 235 15" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M255 28 Q268 20 280 28" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

/* ── City skyline ── */
const Skyline = () => (
  <svg viewBox="0 0 1440 160" className="absolute bottom-0 left-0 w-full opacity-20 pointer-events-none" preserveAspectRatio="none">
    <rect x="0" y="60" width="40" height="100" fill="#2d0057"/>
    <rect x="50" y="30" width="30" height="130" fill="#2d0057"/>
    <rect x="90" y="50" width="50" height="110" fill="#2d0057"/>
    <rect x="150" y="10" width="35" height="150" fill="#2d0057"/>
    <rect x="195" y="40" width="60" height="120" fill="#2d0057"/>
    <rect x="265" y="20" width="25" height="140" fill="#2d0057"/>
    <rect x="300" y="45" width="80" height="115" fill="#2d0057"/>
    <rect x="390" y="30" width="40" height="130" fill="#2d0057"/>
    <rect x="440" y="55" width="90" height="105" fill="#2d0057"/>
    <rect x="540" y="15" width="30" height="145" fill="#2d0057"/>
    <rect x="580" y="35" width="55" height="125" fill="#2d0057"/>
    <rect x="645" y="50" width="70" height="110" fill="#2d0057"/>
    <rect x="725" y="20" width="45" height="140" fill="#2d0057"/>
    <rect x="780" y="40" width="60" height="120" fill="#2d0057"/>
    <rect x="850" y="10" width="35" height="150" fill="#2d0057"/>
    <rect x="895" y="30" width="80" height="130" fill="#2d0057"/>
    <rect x="985" y="55" width="50" height="105" fill="#2d0057"/>
    <rect x="1045" y="25" width="40" height="135" fill="#2d0057"/>
    <rect x="1095" y="45" width="65" height="115" fill="#2d0057"/>
    <rect x="1170" y="15" width="30" height="145" fill="#2d0057"/>
    <rect x="1210" y="35" width="90" height="125" fill="#2d0057"/>
    <rect x="1310" y="50" width="50" height="110" fill="#2d0057"/>
    <rect x="1370" y="20" width="70" height="140" fill="#2d0057"/>
  </svg>
);

const HomeV2 = () => {
  const [featuredGame, setFeaturedGame] = useState(null);
  const gamesRef = useRef(null);

  useEffect(() => {
    document.title = 'Vakar Games — Independent Game Studio';
    axios.get(`${API_URL}/api/website/games/featured`)
      .then(r => { if (r.data.game) setFeaturedGame(r.data.game); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: '#0d0015' }}>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5"
        style={{ background: 'linear-gradient(to bottom, rgba(13,0,21,0.9) 0%, transparent 100%)' }}>
        <span className="text-white font-black text-xl tracking-[0.2em]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.25em',
            textShadow: '0 0 20px rgba(255,0,120,0.6)' }}>
          VAKAR GAMES
        </span>
        <div className="hidden md:flex items-center gap-8">
          {[['Games', '/games'], ['Shop', '/shop'], ['Blog', '/blog'], ['Contact', '/contact']].map(([label, to]) => (
            <Link key={label} to={to}
              className="text-sm font-semibold text-white/70 hover:text-white transition-colors tracking-wide">
              {label}
            </Link>
          ))}
          <Link to="/login"
            className="text-sm font-bold px-5 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 transition-all">
            Sign In
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Sunset gradient sky */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, #0d0015 0%, #1a0030 15%, #4a0060 35%, #8B1A6B 52%, #C2446A 65%, #E8785A 78%, #F5A855 90%, #FBC97A 100%)'
        }} />

        {/* Glow overlays */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, #FF006E 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, #A855F7 0%, transparent 70%)', filter: 'blur(40px)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse, #FF6B35 0%, transparent 70%)', filter: 'blur(40px)' }} />
        </div>

        {/* Silhouettes */}
        <PalmLeft />
        <PalmRight />
        <Skyline />
        <Birds />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-[0.35em] uppercase mb-6"
            style={{ color: '#FF9ECC', textShadow: '0 0 12px rgba(255,0,120,0.5)' }}>
            Independent Game Studio
          </p>

          <h1 className="font-black leading-none mb-6 text-white"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(5rem, 18vw, 14rem)',
              textShadow: '0 0 40px rgba(255,0,110,0.4), 0 4px 30px rgba(0,0,0,0.6)',
              letterSpacing: '0.04em',
            }}>
            VAKAR<br />
            <span style={{ WebkitTextStroke: '2px rgba(255,158,204,0.8)', color: 'transparent',
              textShadow: '0 0 30px rgba(255,0,120,0.6)' }}>
              GAMES
            </span>
          </h1>

          <p className="text-base sm:text-lg mb-10 max-w-md mx-auto leading-relaxed"
            style={{ color: 'rgba(255,220,240,0.85)' }}>
            We build games we'd want to play — small team, deliberate choices, no shortcuts.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/games"
              className="inline-flex items-center gap-2 font-bold px-8 py-3.5 rounded-full text-white transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #FF006E 0%, #9B00FF 100%)',
                boxShadow: '0 0 30px rgba(255,0,110,0.5), 0 4px 15px rgba(0,0,0,0.3)',
              }}>
              Discover our games <ArrowRight size={16} />
            </Link>
            <Link to="/shop"
              className="inline-flex items-center gap-2 font-bold px-8 py-3.5 rounded-full text-white border border-white/30 hover:bg-white/10 transition-all"
              style={{ backdropFilter: 'blur(8px)' }}>
              Visit the shop
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-60">
          <div className="w-6 h-10 rounded-full border-2 border-white/40 flex justify-center pt-2">
            <div className="w-1 h-2 rounded-full bg-white/60" />
          </div>
        </div>
      </section>

      {/* ── FEATURED GAME ── */}
      {featuredGame && (
        <section className="relative py-24 px-6 overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #0d0015 0%, #150025 100%)' }}>
          {/* Grid pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-5"
            style={{ backgroundImage: 'linear-gradient(rgba(255,0,120,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,120,0.3) 1px, transparent 1px)',
              backgroundSize: '60px 60px' }} />

          <div className="max-w-6xl mx-auto relative z-10">
            <p className="text-xs font-bold tracking-[0.3em] uppercase mb-12"
              style={{ color: '#FF006E' }}>
              ✦ Featured release
            </p>

            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="font-black text-white mb-4 leading-none"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(3rem, 8vw, 6rem)',
                    textShadow: '0 0 30px rgba(255,0,110,0.3)' }}>
                  {featuredGame.name.toUpperCase()}
                </h2>
                {featuredGame.description && (
                  <p className="mb-8 leading-relaxed" style={{ color: 'rgba(255,200,230,0.75)', maxWidth: '40ch' }}>
                    {featuredGame.description}
                  </p>
                )}
                {featuredGame.platforms?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {featuredGame.platforms.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
                        style={{ borderColor: 'rgba(255,0,120,0.4)', color: '#FF9ECC',
                          background: 'rgba(255,0,120,0.08)' }}>
                        <ExternalLink size={10} /> {p.label || p.platform}
                      </a>
                    ))}
                  </div>
                )}
                <Link to="/games"
                  className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-full text-white transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #FF006E 0%, #9B00FF 100%)',
                    boxShadow: '0 0 20px rgba(255,0,110,0.4)',
                  }}>
                  Learn more <ArrowRight size={14} />
                </Link>
              </div>

              {featuredGame.logo_url ? (
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl opacity-30"
                    style={{ background: 'radial-gradient(ellipse, #FF006E 0%, transparent 70%)', filter: 'blur(40px)', transform: 'scale(0.9)' }} />
                  <img src={featuredGame.logo_url.startsWith('/') ? `${API_URL}${featuredGame.logo_url}` : featuredGame.logo_url}
                    alt={featuredGame.name}
                    className="relative rounded-2xl shadow-2xl w-full"
                    style={{ boxShadow: '0 0 60px rgba(255,0,110,0.2)' }} />
                </div>
              ) : (
                <div className="aspect-video rounded-2xl border flex items-center justify-center"
                  style={{ borderColor: 'rgba(255,0,120,0.2)', background: 'rgba(255,0,120,0.05)' }}>
                  <Gamepad2 size={48} style={{ color: 'rgba(255,0,120,0.3)' }} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── STUDIO ── */}
      <section className="py-24 px-6" style={{ background: '#0a0018' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-bold tracking-[0.3em] uppercase mb-4"
            style={{ color: '#FF006E' }}>✦ The studio</p>
          <h2 className="font-black text-white mb-16 leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              textShadow: '0 0 20px rgba(168,85,247,0.3)' }}>
            BUILDING GAMES<br />WORTH PLAYING
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Gamepad2, title: 'Game Development', desc: 'From first prototype to final release. PC and mobile, with a focus on gameplay that feels right.', color: '#FF006E' },
              { icon: Users, title: 'Community', desc: 'Players are part of the process. We share progress, collect feedback and iterate.', color: '#A855F7' },
              { icon: Zap, title: 'Internal Tooling', desc: 'We build what we need — accounts, game data, shop systems and team workflows.', color: '#22D3EE' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="p-6 rounded-2xl border relative overflow-hidden group transition-all hover:scale-[1.02]"
                style={{ borderColor: `${color}25`, background: `${color}08` }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${color}15` }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,200,230,0.6)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 px-6 border-t border-b" style={{ borderColor: 'rgba(255,0,120,0.1)', background: '#0d0015' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { n: '2024', label: 'Studio founded' },
            { n: 'France', label: 'Based in' },
            { n: 'PC · Mobile', label: 'Platforms' },
            { n: 'Indie', label: 'Spirit' },
          ].map((s, i) => (
            <div key={i}>
              <div className="font-black text-2xl text-white mb-1"
                style={{ fontFamily: "'Bebas Neue', sans-serif",
                  textShadow: i % 2 === 0 ? '0 0 15px rgba(255,0,110,0.5)' : '0 0 15px rgba(168,85,247,0.5)' }}>
                {s.n}
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,180,220,0.6)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 text-center relative overflow-hidden" style={{ background: '#0a0018' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #A855F7 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div className="relative z-10 max-w-lg mx-auto">
          <h2 className="font-black text-white mb-4 leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 7vw, 5rem)',
              textShadow: '0 0 20px rgba(255,0,110,0.3)' }}>
            READY TO PLAY?
          </h2>
          <p className="mb-8 text-sm leading-relaxed" style={{ color: 'rgba(255,200,230,0.7)' }}>
            Discover all our games and join the community.
          </p>
          <Link to="/games"
            className="inline-flex items-center gap-2 font-bold px-10 py-4 rounded-full text-white transition-all hover:scale-105 active:scale-95 text-base"
            style={{
              background: 'linear-gradient(135deg, #FF006E 0%, #9B00FF 100%)',
              boxShadow: '0 0 40px rgba(255,0,110,0.5)',
            }}>
            Browse games <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-8 py-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ borderColor: 'rgba(255,0,120,0.1)', background: '#0d0015' }}>
        <span className="font-black tracking-[0.2em] text-sm"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'rgba(255,158,204,0.7)' }}>
          VAKAR GAMES
        </span>
        <div className="flex gap-6">
          {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Contact', '/contact']].map(([l, h]) => (
            <Link key={l} to={h} className="text-xs transition-colors"
              style={{ color: 'rgba(255,180,220,0.5)' }}
              onMouseEnter={e => e.target.style.color = 'rgba(255,158,204,0.9)'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,180,220,0.5)'}>
              {l}
            </Link>
          ))}
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,180,220,0.4)' }}>
          © {new Date().getFullYear()} Vakar Games
        </p>
      </footer>
    </div>
  );
};

export default HomeV2;
