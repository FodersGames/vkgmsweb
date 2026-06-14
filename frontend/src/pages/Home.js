import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Gamepad2, Code, Users, Zap, Menu, X } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const HERO_BG = 'https://images.unsplash.com/photo-1680003935289-0c8d65e1ae30?auto=format&fit=crop&w=1920&q=80';
const ABOUT_BG = 'https://images.unsplash.com/photo-1756737864755-3a4f37485ce4?auto=format&fit=crop&w=1920&q=80';

const PLATFORM_ICONS = {
  steam: 'Steam', google_play: 'Google Play', apple: 'App Store', pc: 'PC', web: 'Web', android: 'Android'
};

const Home = () => {
  const aboutRef = useRef(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [featuredGame, setFeaturedGame] = useState(null);

  useEffect(() => {
    document.title = 'Vakar Games — Legends Are Born';
    axios.get(`${API_URL}/api/website/games/featured`).then(r => {
      if (r.data.game) setFeaturedGame(r.data.game);
    }).catch(() => {});
  }, []);

  const scrollToAbout = () => { aboutRef.current?.scrollIntoView({ behavior: 'smooth' }); setMobileMenu(false); };

  return (
    <div className="bg-[#0a0a0f] text-white" style={{ fontFamily: "'Bebas Neue', 'Oswald', sans-serif" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/20" data-testid="landing-navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-black tracking-[0.15em] text-white cursor-pointer"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.2em' }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} data-testid="landing-logo">
              VAKAR GAMES
            </h1>
            <div className="hidden md:flex items-center gap-6">
              <button onClick={scrollToAbout} className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>About</button>
              <Link to="/games" className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Games</Link>
              <Link to="/blog" className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Blog</Link>
            </div>
          </div>
          {/* Mobile burger */}
          <button className="md:hidden p-2 text-white" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="md:hidden bg-[#111118] border-t border-white/5 px-6 py-4 space-y-3" data-testid="mobile-menu">
            <button onClick={scrollToAbout} className="block w-full text-left text-sm text-[#8A8A9A] hover:text-white py-2">About</button>
            <Link to="/games" className="block text-sm text-[#8A8A9A] hover:text-white py-2" onClick={() => setMobileMenu(false)}>Games</Link>
            <Link to="/blog" className="block text-sm text-[#8A8A9A] hover:text-white py-2" onClick={() => setMobileMenu(false)}>Blog</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden vakar-soft-grid" data-testid="hero-section">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/60 via-[#0a0a0f]/30 to-[#0a0a0f]"></div>
        </div>
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-6xl mx-auto">
          <h2 className="vakar-gradient-title text-[5.7rem] xs:text-[6.5rem] sm:text-[10rem] md:text-[12rem] lg:text-[16rem] font-black leading-[0.85] tracking-tight text-white vakar-mobile-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", textShadow: '0 4px 60px rgba(0,0,0,0.5)' }}>
            VAKAR
          </h2>
          <p className="text-base sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-[0.22em] sm:tracking-[0.3em] text-white/80 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            LEGENDS ARE BORN
          </p>
          <button onClick={scrollToAbout} className="mt-12 animate-bounce" data-testid="scroll-down-button">
            <ChevronDown size={36} className="text-white/50" />
          </button>
        </div>
      </section>

      {/* About */}
      <section ref={aboutRef} className="relative min-h-screen flex items-center overflow-hidden vakar-soft-grid" data-testid="about-section"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className="absolute inset-0 opacity-10"><img src={ABOUT_BG} alt="" className="w-full h-full object-cover" /></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <h3 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-6 vakar-gradient-title" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>WHO WE ARE</h3>
            <p className="text-base sm:text-lg text-white/70 leading-relaxed mb-8" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Vakar Games is a French video game development studio driven by passion and creativity. We build immersive worlds, unforgettable characters, and experiences that push boundaries.
            </p>
            <p className="text-base sm:text-lg text-white/70 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Our mission is simple: create games that players remember forever. From concept to launch, every detail matters.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Gamepad2, title: 'Game Dev', desc: 'Building worlds from scratch' },
              { icon: Code, title: 'Technology', desc: 'Cutting-edge game engines' },
              { icon: Users, title: 'Community', desc: 'Players at the center' },
              { icon: Zap, title: 'Innovation', desc: 'Pushing the limits' }
            ].map((item, i) => (
              <div key={i} className="vakar-glass vakar-card-hover backdrop-blur-sm rounded-2xl p-5 sm:p-6 transition-all duration-300">
                <item.icon size={24} className="text-[#4ECDC4] mb-3" />
                <h4 className="text-base sm:text-lg font-bold mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>{item.title}</h4>
                <p className="text-xs sm:text-sm text-white/50" style={{ fontFamily: "'Inter', sans-serif" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Game Section */}
      <section id="games" className="relative min-h-[60vh] flex items-center overflow-hidden vakar-soft-grid" data-testid="games-section"
        style={{ background: 'linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 100%)' }}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24 w-full">
          {featuredGame ? (
            <div className="vakar-glass rounded-[2rem] p-5 sm:p-8 lg:p-10 flex flex-col lg:flex-row gap-10 items-center">
              <div className="lg:w-1/2">
                {featuredGame.logo_url ? (
                  <img src={featuredGame.logo_url.startsWith('/') ? `${API_URL}${featuredGame.logo_url}` : featuredGame.logo_url}
                    alt={featuredGame.name} className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl shadow-black/50 object-cover" />
                ) : featuredGame.screenshots?.length > 0 ? (
                  <img src={featuredGame.screenshots[0].startsWith('/') ? `${API_URL}${featuredGame.screenshots[0]}` : featuredGame.screenshots[0]}
                    alt={featuredGame.name} className="w-full rounded-2xl shadow-2xl shadow-black/50 object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-white/5 rounded-2xl flex items-center justify-center">
                    <span className="text-white/20 text-3xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{featuredGame.name}</span>
                  </div>
                )}
              </div>
              <div className="lg:w-1/2 space-y-6">
                <div className="text-xs font-bold tracking-[0.2em] text-[#4ECDC4] uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Featured Game</div>
                <h3 className="text-4xl sm:text-5xl md:text-6xl font-black vakar-gradient-title" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{featuredGame.name}</h3>
                <p className="text-base sm:text-lg text-white/60 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>{featuredGame.description}</p>
                {featuredGame.platforms?.length > 0 && (
                  <div className="flex gap-3 flex-wrap">
                    {featuredGame.platforms.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-[#4ECDC4]/30 transition-all text-sm font-medium text-white/70 hover:text-white"
                        style={{ fontFamily: "'Inter', sans-serif" }}>
                        {PLATFORM_ICONS[p.name] || p.name}
                      </a>
                    ))}
                  </div>
                )}
                <Link to="/games" className="inline-block rounded-xl border-2 border-white/20 text-white/80 hover:border-[#4ECDC4] hover:text-white hover:bg-[#4ECDC4]/10 px-6 py-3 text-sm font-bold tracking-[0.15em] uppercase transition-all" style={{ fontFamily: "'Inter', sans-serif" }}>
                  View All Games
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h3 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-6 vakar-gradient-title" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>OUR GAMES</h3>
              <p className="text-lg text-white/60 mb-8" style={{ fontFamily: "'Inter', sans-serif" }}>Something big is coming. Stay tuned.</p>
              <Link to="/games" className="inline-block border-2 border-white/20 text-white/70 hover:border-white hover:text-white px-8 py-3 text-sm font-bold tracking-[0.15em] uppercase transition-all" style={{ fontFamily: "'Inter', sans-serif" }}>
                Explore Games
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative py-24 overflow-hidden" data-testid="contact-section"
        style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #111118 100%)' }}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-6 vakar-gradient-title" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>GET IN TOUCH</h3>
          <p className="text-base sm:text-lg text-white/50 mb-12 max-w-xl mx-auto" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            Interested in working with us or have a question? We'd love to hear from you.
          </p>
          <a href="mailto:support@vakargames.com"
            className="inline-block border-2 border-white text-white px-10 py-4 text-sm font-bold tracking-[0.2em] uppercase hover:bg-white hover:text-[#0a0a0f] transition-all duration-300"
            style={{ fontFamily: "'Inter', sans-serif" }} data-testid="contact-email-button">
            CONTACT US
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0a0a0f]" data-testid="landing-footer">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <span className="text-lg font-black tracking-[0.2em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</span>
              <div className="hidden md:flex items-center gap-6">
                <Link to="/games" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Games</Link>
                <Link to="/blog" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Blog</Link>
              </div>
            </div>
            <p className="text-xs text-[#8A8A9A]" style={{ fontFamily: "'Inter', sans-serif" }}>&copy; VAKAR GAMES {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
