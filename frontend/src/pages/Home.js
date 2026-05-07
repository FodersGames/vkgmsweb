import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Shield, Gamepad2, Code, Users, Zap } from 'lucide-react';

const HERO_BG = 'https://images.unsplash.com/photo-1680003935289-0c8d65e1ae30?auto=format&fit=crop&w=1920&q=80';
const ABOUT_BG = 'https://images.unsplash.com/photo-1756737864755-3a4f37485ce4?auto=format&fit=crop&w=1920&q=80';
const GAMES_BG = 'https://images.unsplash.com/photo-1631745802672-64b9744ea7de?auto=format&fit=crop&w=1920&q=80';

const Home = () => {
  const navigate = useNavigate();
  const aboutRef = useRef(null);

  const scrollToAbout = () => {
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Preload images
    [HERO_BG, ABOUT_BG, GAMES_BG].forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return (
    <div className="bg-[#0a0a0f] text-white" style={{ fontFamily: "'Bebas Neue', 'Oswald', sans-serif" }}>
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5" data-testid="landing-navbar">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-black tracking-[0.15em] text-white cursor-pointer"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.2em' }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              data-testid="landing-logo">
              VAKAR GAMES
            </h1>
            <div className="hidden md:flex items-center gap-6">
              <button onClick={scrollToAbout} className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase"
                style={{ fontFamily: "'Inter', sans-serif" }}>
                About
              </button>
              <a href="/games" className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase"
                style={{ fontFamily: "'Inter', sans-serif" }}>
                Games
              </a>
              <a href="/blog" className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase"
                style={{ fontFamily: "'Inter', sans-serif" }}>
                Blog
              </a>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase"
            style={{ fontFamily: "'Inter', sans-serif" }}
            data-testid="landing-admin-link"
          >
            Admin Panel
          </button>
        </div>
      </nav>

      {/* Hero Section - Full Viewport */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/60 via-[#0a0a0f]/30 to-[#0a0a0f]"></div>
        </div>
        <div className="relative z-10 text-center px-6">
          <h2 className="text-[8rem] md:text-[12rem] lg:text-[16rem] font-black leading-[0.85] tracking-tight text-white"
            style={{ fontFamily: "'Bebas Neue', sans-serif", textShadow: '0 4px 60px rgba(0,0,0,0.5)' }}>
            VAKAR
          </h2>
          <p className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-[0.3em] text-white/80 mt-2"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            LEGENDS ARE BORN
          </p>
          <button onClick={scrollToAbout} className="mt-12 animate-bounce" data-testid="scroll-down-button">
            <ChevronDown size={36} className="text-white/50" />
          </button>
        </div>
      </section>

      {/* About Section */}
      <section ref={aboutRef} className="relative min-h-screen flex items-center overflow-hidden" data-testid="about-section"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className="absolute inset-0 opacity-10">
          <img src={ABOUT_BG} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="text-6xl md:text-8xl font-black tracking-tight mb-6"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              WHO WE ARE
            </h3>
            <p className="text-lg text-white/70 leading-relaxed mb-8" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Vakar Games is a French video game development studio driven by passion and creativity.
              We build immersive worlds, unforgettable characters, and experiences that push boundaries.
            </p>
            <p className="text-lg text-white/70 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
              Our mission is simple: create games that players remember forever.
              From concept to launch, every detail matters.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Gamepad2, title: 'Game Dev', desc: 'Building worlds from scratch' },
              { icon: Code, title: 'Technology', desc: 'Cutting-edge game engines' },
              { icon: Users, title: 'Community', desc: 'Players at the center' },
              { icon: Zap, title: 'Innovation', desc: 'Pushing the limits' }
            ].map((item, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <item.icon size={28} className="text-[#4ECDC4] mb-3" />
                <h4 className="text-lg font-bold mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
                  {item.title}
                </h4>
                <p className="text-sm text-white/50" style={{ fontFamily: "'Inter', sans-serif" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section id="games" className="relative min-h-[80vh] flex items-center overflow-hidden" data-testid="games-section"
        style={{ background: 'linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 100%)' }}>
        <div className="absolute inset-0 opacity-15">
          <img src={GAMES_BG} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#2d1b4e]/80 to-transparent"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
          <h3 className="text-6xl md:text-8xl font-black tracking-tight mb-6"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            OUR GAMES
          </h3>
          <p className="text-xl text-white/60 mb-12 max-w-xl" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            Something big is coming. Stay tuned for our upcoming releases.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-[#4ECDC4]/30 transition-all duration-500">
                <div className="aspect-[3/4] flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0">
                  <div className="text-center">
                    <Shield size={40} className="mx-auto text-white/15 mb-3" />
                    <p className="text-sm font-bold tracking-[0.2em] text-white/20 uppercase"
                      style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                      Coming Soon
                    </p>
                  </div>
                </div>
                <div className="p-5 border-t border-white/5">
                  <div className="h-4 w-2/3 bg-white/5 rounded mb-2"></div>
                  <div className="h-3 w-1/2 bg-white/5 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative py-24 overflow-hidden" data-testid="contact-section"
        style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #111118 100%)' }}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-6xl md:text-8xl font-black tracking-tight mb-6"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            GET IN TOUCH
          </h3>
          <p className="text-lg text-white/50 mb-12 max-w-xl mx-auto" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            Interested in working with us or have a question? We'd love to hear from you.
          </p>
          <a href="mailto:vakargames@gmail.com"
            className="inline-block border-2 border-white text-white px-10 py-4 text-sm font-bold tracking-[0.2em] uppercase hover:bg-white hover:text-[#0a0a0f] transition-all duration-300"
            style={{ fontFamily: "'Inter', sans-serif" }}
            data-testid="contact-email-button">
            CONTACT US
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0a0a0f]" data-testid="landing-footer">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <span className="text-lg font-black tracking-[0.2em]"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                VAKAR GAMES
              </span>
              <div className="hidden md:flex items-center gap-6">
                <a href="/games" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  Games
                </a>
                <a href="/blog" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  Blog
                </a>
              </div>
            </div>
            <p className="text-xs text-[#8A8A9A]" style={{ fontFamily: "'Inter', sans-serif" }}>
              &copy; VAKAR GAMES {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
