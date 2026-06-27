import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Mail } from 'lucide-react';
import axios from 'axios';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLATFORM_LABELS = {
  steam: 'Steam',
  google_play: 'Google Play',
  apple: 'App Store',
  pc: 'PC / Windows',
  web: 'Web',
  android: 'Android',
};

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
    <div className="bg-[#F9F7F4]">
      <PublicNav onAbout={scrollToAbout} />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 md:px-10 lg:px-16 max-w-screen-xl mx-auto" data-testid="hero-section">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold text-[#4ECDC4] tracking-[0.16em] uppercase mb-6">
            Independent Game Studio · France
          </p>
          <h1
            className="text-[5rem] sm:text-[7.5rem] md:text-[9.5rem] lg:text-[11.5rem] leading-[0.86] font-black tracking-tight text-[#1C1917] mb-8"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            data-testid="hero-title"
          >
            VAKAR<br />GAMES
          </h1>
          <p className="text-lg sm:text-xl text-[#78716C] max-w-lg leading-relaxed mb-10">
            We build games we'd want to play. Small team, deliberate choices, and no shortcuts on what matters.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/games"
              className="inline-flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Our games <ArrowRight size={14} />
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 border border-[#E8E3DB] hover:border-[#C9C3BB] bg-white text-[#1C1917] px-5 py-2.5 text-sm font-semibold transition-all"
            >
              Studio journal
            </Link>
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-[#E8E3DB] grid grid-cols-2 sm:grid-cols-4 gap-8">
          {[
            { n: '2024',        label: 'Studio founded' },
            { n: 'France',      label: 'Based in' },
            { n: 'PC · Mobile', label: 'Platforms' },
            { n: 'Indie',       label: 'Spirit' },
          ].map((s, i) => (
            <div key={i}>
              <div
                className="text-2xl font-black text-[#1C1917]"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                {s.n}
              </div>
              <div className="text-sm text-[#78716C] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Studio / About */}
      <section
        ref={aboutRef}
        className="bg-white py-24 px-6 md:px-10 lg:px-16"
        data-testid="about-section"
      >
        <div className="max-w-screen-xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-4">
                The studio
              </p>
              <h2
                className="text-4xl sm:text-5xl font-black text-[#1C1917] leading-tight mb-6"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                BUILDING GAMES<br />WORTH PLAYING
              </h2>
              <div className="space-y-4 text-[#78716C] text-base leading-relaxed">
                <p>
                  Vakar Games is an independent studio. We focus on a small number of projects at a time — not because we have to, but because we believe constraint leads to better work.
                </p>
                <p>
                  We develop across PC and mobile, with a focus on tight mechanics, clear design and experiences that respect the player's time.
                </p>
                <p>
                  Our toolset is built in-house: we manage projects, players, missions and shop systems from our own platform, so we can move fast without losing control.
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
              ].map((item) => (
                <div
                  key={item.num}
                  className="flex gap-5 p-5 bg-[#F9F7F4] border border-[#E8E3DB] hover:border-[#C9C3BB] transition-colors"
                >
                  <span
                    className="text-xs font-black text-[#A8A29E] tracking-wider pt-0.5 shrink-0"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    {item.num}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#1C1917] mb-1">{item.title}</h3>
                    <p className="text-sm text-[#78716C] leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Game */}
      <section id="games" className="py-24 px-6 md:px-10 lg:px-16" data-testid="games-section">
        <div className="max-w-screen-xl mx-auto">
          {featuredGame ? (
            <>
              <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-12">
                Featured release
              </p>
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                <div className="order-2 lg:order-1">
                  <h2
                    className="text-5xl sm:text-6xl font-black text-[#1C1917] leading-tight mb-4"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    {featuredGame.name.toUpperCase()}
                  </h2>
                  {featuredGame.description && (
                    <p className="text-[#78716C] leading-relaxed mb-8 max-w-md">
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
                          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-[#E8E3DB] text-[#78716C] px-3 py-1.5 hover:border-[#4ECDC4]/50 hover:text-[#1C1917] transition-all"
                        >
                          {PLATFORM_LABELS[p.name] || p.name}
                          <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  )}
                  <Link
                    to="/games"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4ECDC4] hover:text-[#45b8b0] transition-colors"
                  >
                    All our games <ArrowRight size={14} />
                  </Link>
                </div>

                <div className="order-1 lg:order-2">
                  {featuredGame.logo_url ? (
                    <img
                      src={featuredGame.logo_url.startsWith('/') ? `${API_URL}${featuredGame.logo_url}` : featuredGame.logo_url}
                      alt={featuredGame.name}
                      className="w-full max-w-lg mx-auto rounded-lg shadow-lg"
                    />
                  ) : featuredGame.screenshots?.[0] ? (
                    <img
                      src={featuredGame.screenshots[0].startsWith('/') ? `${API_URL}${featuredGame.screenshots[0]}` : featuredGame.screenshots[0]}
                      alt={featuredGame.name}
                      className="w-full rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-white border border-[#E8E3DB] rounded-lg flex items-center justify-center">
                      <span
                        className="text-[#A8A29E] text-3xl font-black"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
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
              <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-6">
                Our games
              </p>
              <h2
                className="text-5xl sm:text-6xl font-black text-[#1C1917] mb-4"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                IN DEVELOPMENT
              </h2>
              <p className="text-[#78716C] mb-8">
                New titles are in progress. Follow the blog for updates.
              </p>
              <Link
                to="/games"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4ECDC4] hover:text-[#45b8b0] transition-colors"
              >
                Game catalog <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-white py-24 px-6 md:px-10 lg:px-16" data-testid="contact-section">
        <div className="max-w-screen-xl mx-auto">
          <div className="max-w-xl">
            <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-4">
              Contact
            </p>
            <h2
              className="text-4xl sm:text-5xl font-black text-[#1C1917] mb-4 leading-tight"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              LET'S TALK
            </h2>
            <p className="text-[#78716C] mb-8 leading-relaxed">
              Questions about our games, a collaboration proposal or press inquiries — reach us directly.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-[#1C1917] hover:bg-[#2D2926] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                data-testid="contact-email-button"
              >
                Open a ticket <ArrowRight size={14} />
              </Link>
              <a
                href="mailto:support@vakargames.com"
                className="inline-flex items-center gap-2 border border-[#E8E3DB] hover:border-[#C9C3BB] bg-white text-[#78716C] px-5 py-2.5 text-sm font-semibold transition-all"
              >
                <Mail size={14} /> support@vakargames.com
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter onAbout={scrollToAbout} />
    </div>
  );
};

export default Home;
