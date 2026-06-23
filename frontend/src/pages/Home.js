import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Gamepad2, Code, Users, Zap } from 'lucide-react';
import axios from 'axios';
import { PublicNav } from '../components/PublicNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const HERO_BG = 'https://images.unsplash.com/photo-1680003935289-0c8d65e1ae30?auto=format&fit=crop&w=1920&q=80';
const ABOUT_BG = 'https://images.unsplash.com/photo-1756737864755-3a4f37485ce4?auto=format&fit=crop&w=1920&q=80';

const PLATFORM_ICONS = {
  steam: 'Steam', google_play: 'Google Play', apple: 'App Store', pc: 'PC', web: 'Web', android: 'Android'
};

const Home = () => {
  const aboutRef = useRef(null);
  const [featuredGame, setFeaturedGame] = useState(null);

  useEffect(() => {
    document.title = 'Vakar Games — Legends Are Born';
    axios.get(`${API_URL}/api/website/games/featured`).then(r => {
      if (r.data.game) setFeaturedGame(r.data.game);
    }).catch(() => {});
  }, []);

  const scrollToAbout = () => aboutRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="bg-[#0a0a0f] text-white" style={{ fontFamily: "'Bebas Neue', 'Oswald', sans-serif" }}>
      {/* Navbar */}
      <PublicNav onAbout={scrollToAbout} data-testid="landing-navbar" />

      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/60 via-[#0a0a0f]/30 to-[#0a0a0f]"></div>
        </div>
        <div className="relative z-10 text-center px-6">
          <h2 className="text-[7rem] sm:text-[10rem] md:text-[12rem] lg:text-[16rem] font-black leading-[0.85] tracking-tight text-white"
            style={{ fontFamily: "'Bebas Neue', sans-serif", textShadow: '0 4px 60px rgba(0,0,0,0.5)' }}>
            VAKAR
          </h2>
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-[0.3em] text-white/80 mt-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            LEGENDS ARE BORN
          </p>
          <button onClick={scrollToAbout} className="mt-12 animate-bounce" data-testid="scroll-down-button">
            <ChevronDown size={36} className="text-white/50" />
          </button>
        </div>
      </section>

      {/* About */}
      <section ref={aboutRef} className="relative min-h-screen flex items-center overflow-hidden" data-testid="about-section"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className="absolute inset-0 opacity-10"><img src={ABOUT_BG} alt="" className="w-full h-full object-cover" /></div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-6" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>WHO WE ARE</h3>
            <p className="text-base sm:text-lg text-white/70 leading-relaxed mb-6" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Vakar Games is a French independent video game studio driven by passion and creativity. We build immersive worlds, memorable characters, and experiences that push the limits of what indie games can be.
            </p>
            <p className="text-base sm:text-lg text-white/70 leading-relaxed mb-6" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Our mission is simple: create games that players remember forever. From concept to launch, every mechanic, every pixel, and every line of dialogue matters.
            </p>
            <p className="text-base sm:text-lg text-white/50 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Whether you're a longtime fan or just finding us today — welcome. You're part of the story now.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Gamepad2, title: 'Game Dev', desc: 'We craft every mechanic and world with care — from first concept to final polish.' },
              { icon: Code, title: 'Technology', desc: 'From TurboWarp to custom web stacks, we master our tools for seamless, reliable experiences.' },
              { icon: Users, title: 'Community', desc: 'Our players are co-creators. Their feedback and passion shape every decision we make.' },
              { icon: Zap, title: 'Innovation', desc: "We don't follow the playbook — we rewrite it. Every title pushes what indie games can be." }
            ].map((item, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 sm:p-6 hover:bg-white/10 transition-all duration-300">
                <item.icon size={24} className="text-[#4ECDC4] mb-3" />
                <h4 className="text-base sm:text-lg font-bold mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>{item.title}</h4>
                <p className="text-xs sm:text-sm text-white/50 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Game Section */}
      <section id="games" className="relative min-h-[60vh] flex items-center overflow-hidden" data-testid="games-section"
        style={{ background: 'linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 100%)' }}>
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
          {featuredGame ? (
            <div className="flex flex-col lg:flex-row gap-10 items-center">
              <div className="lg:w-1/2">
                {featuredGame.logo_url ? (
                  <img src={featuredGame.logo_url.startsWith('/') ? `${API_URL}${featuredGame.logo_url}` : featuredGame.logo_url}
                    alt={featuredGame.name} className="w-full max-w-lg mx-auto rounded-xl shadow-2xl shadow-black/50" />
                ) : featuredGame.screenshots?.length > 0 ? (
                  <img src={featuredGame.screenshots[0].startsWith('/') ? `${API_URL}${featuredGame.screenshots[0]}` : featuredGame.screenshots[0]}
                    alt={featuredGame.name} className="w-full rounded-xl shadow-2xl shadow-black/50" />
                ) : (
                  <div className="w-full aspect-video bg-white/5 rounded-xl flex items-center justify-center">
                    <span className="text-white/20 text-3xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{featuredGame.name}</span>
                  </div>
                )}
              </div>
              <div className="lg:w-1/2 space-y-6">
                <div className="text-xs font-bold tracking-[0.2em] text-[#4ECDC4] uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>Featured Game</div>
                <h3 className="text-4xl sm:text-5xl md:text-6xl font-black" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{featuredGame.name}</h3>
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
                <Link to="/games" className="inline-block border-2 border-white/20 text-white/70 hover:border-white hover:text-white px-6 py-3 text-sm font-bold tracking-[0.15em] uppercase transition-all" style={{ fontFamily: "'Inter', sans-serif" }}>
                  View All Games
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h3 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-6" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>OUR GAMES</h3>
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
          <h3 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-6" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>GET IN TOUCH</h3>
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
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 mb-14">
            <div>
              <span className="text-xl font-black tracking-[0.2em] text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</span>
              <p className="mt-4 text-sm text-white/40 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
                Independent game studio based in France.<br />We build worlds you'll never forget.
              </p>
              <a href="mailto:support@vakargames.com" className="inline-block mt-5 text-xs text-[#4ECDC4] hover:text-[#45b8b0] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>
                support@vakargames.com
              </a>
            </div>
            <div>
              <h4 className="text-xs font-bold tracking-[0.2em] text-white/30 uppercase mb-5" style={{ fontFamily: "'Inter', sans-serif" }}>Explore</h4>
              <ul className="space-y-3">
                <li><button onClick={scrollToAbout} className="text-sm text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>About</button></li>
                <li><Link to="/games" className="text-sm text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>Games</Link></li>
                <li><Link to="/blog" className="text-sm text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>Blog</Link></li>
                <li><a href="mailto:support@vakargames.com" className="text-sm text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold tracking-[0.2em] text-white/30 uppercase mb-5" style={{ fontFamily: "'Inter', sans-serif" }}>Legal</h4>
              <ul className="space-y-3">
                <li><Link to="/privacy" className="text-sm text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-sm text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/20" style={{ fontFamily: "'Inter', sans-serif" }}>&copy; {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
            <p className="text-xs text-white/20" style={{ fontFamily: "'Inter', sans-serif" }}>Made with passion in France</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
