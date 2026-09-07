import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GameController, Sparkle, Compass, ShieldCheck } from '@phosphor-icons/react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { LiveTerminal } from '../components/LiveTerminal';
import { PublicButton } from '../ui/PublicButton';
import jellyfish from '../assets/photos/jellyfish.jpg';
import tealFronds from '../assets/photos/teal-fronds.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const FRAME_CLS = 'rounded-[20px] border border-[#D2D2D7] overflow-hidden';

const PILLARS = [
  {
    icon: GameController,
    title: 'Player-First Game Design',
    description: 'We develop tight mechanics, deliberate pacing, and rich atmospheres that truly respect the player\'s time.',
  },
  {
    icon: Compass,
    title: 'Original Universes',
    description: 'From atmospheric indie adventures to competitive multiplayer experiences, every world is built from the ground up.',
  },
  {
    icon: ShieldCheck,
    title: 'In-House Technology',
    description: 'We write our own backend systems, player registries, and live operations, ensuring reliable online gameplay.',
  },
];

const Home = () => {
  const aboutRef = useRef(null);
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [featuredGame, setFeaturedGame] = useState(null);

  useEffect(() => {
    document.title = 'Vakar Games — Independent Video Game Studio';
    axios.get(`${API_URL}/api/website/games/public`)
      .then(r => {
        const list = r.data.games || [];
        setGames(list);
        const featured = list.find(g => g.is_featured) || list[0];
        if (featured) setFeaturedGame(featured);
      })
      .catch(() => {});
  }, []);

  const scrollToAbout = () =>
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });

  const img = (url) => (url?.startsWith('/') ? `${API_URL}${url}` : url);

  return (
    <div className="bg-white">
      <PublicNav onAbout={scrollToAbout} />

      {/* Hero */}
      <section className="relative overflow-hidden [contain:paint] pt-[132px] pb-20 sm:pb-28 px-6" data-testid="hero-section">
        <div className="dot-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="max-w-[1120px] mx-auto grid lg:grid-cols-[1fr_0.85fr] gap-10 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <Reveal
              as="p"
              className="text-[12px] font-mono text-[#6E6E73] mb-5"
            >
              // vakar games studio
            </Reveal>
            <Reveal
              as="h1"
              className="font-display text-[38px] sm:text-[56px] lg:text-[64px] leading-[1.05] tracking-[-0.01em] font-medium text-[#1D1D1F]"
            >
              <span style={{ textWrap: 'balance' }} data-testid="hero-title">
                Building games <em className="not-italic text-[#4ECDC4]">worth playing.</em>
              </span>
            </Reveal>
            <Reveal as="p" className="text-[16px] sm:text-[18px] text-[#6E6E73] max-w-[46ch] mx-auto lg:mx-0 mt-5 leading-relaxed">
              Vakar Games is an independent video game development studio based in France. Small team, deliberate creative choices, and zero shortcuts on gameplay feel.
            </Reveal>
            <Reveal as="div" className="flex items-center justify-center lg:justify-start gap-3 mt-8 flex-wrap">
              <Link to="/games">
                <PublicButton icon={ArrowRight} className="group">
                  Explore our games
                </PublicButton>
              </Link>
              <Link to="/blog">
                <PublicButton variant="outline">
                  Studio journal
                </PublicButton>
              </Link>
            </Reveal>
          </div>

          <Reveal as="div" className={`${FRAME_CLS} aspect-[4/3] lg:aspect-[3/4]`} style={{ transitionDelay: '100ms' }}>
            <img src={jellyfish} alt="Vakar Games" className="w-full h-full object-cover" />
          </Reveal>
        </div>
      </section>

      {/* Pillars */}
      <section className="bg-[#F5F5F7] py-20 sm:py-28 px-6">
        <div className="max-w-[1120px] mx-auto">
          <Reveal className="text-center max-w-lg mx-auto mb-14">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// our philosophy</p>
            <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              <span style={{ textWrap: 'balance' }}>Craft, constraint & passion.</span>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-5">
            {PILLARS.map((b, i) => (
              <Reveal key={b.title} className="rounded-xl bg-white border border-[#D2D2D7] p-6" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="w-10 h-10 rounded-lg bg-[#4ECDC4]/10 flex items-center justify-center mb-4">
                  <b.icon size={18} className="text-[#4ECDC4]" />
                </div>
                <h3 className="font-display text-base font-medium text-[#1D1D1F] mb-2">{b.title}</h3>
                <p className="text-sm text-[#6E6E73] leading-relaxed">{b.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Games Showcase */}
      <section id="games" className="py-20 sm:py-28 px-6 text-center">
        <div className="max-w-[1040px] mx-auto">
          <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// production catalog</p>
          <Reveal as="h2" className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
            Games from the studio.
          </Reveal>

          {games.length > 0 ? (
            <Reveal
              className="mt-14 grid text-left rounded-[18px] border border-[#D2D2D7] overflow-hidden"
              as="div"
              style={{ gridTemplateColumns: `repeat(${Math.min(games.length, 3)}, 1fr)`, gap: '1px', background: '#D2D2D7' }}
            >
              {games.slice(0, 3).map(g => (
                <Link
                  key={g.slug}
                  to="/games"
                  className="relative bg-white hover:bg-[#FCFCFD] hover:shadow-[0_16px_32px_-16px_rgba(0,0,0,0.18)] hover:-translate-y-px hover:z-10 transition-all duration-300 ease-out px-[30px] py-9"
                >
                  {g.banner_url || g.logo_url ? (
                    <img
                      src={img(g.banner_url || g.logo_url)}
                      alt={g.name}
                      className="w-full h-36 rounded-xl object-cover mb-[18px] border border-[#D2D2D7]"
                    />
                  ) : (
                    <div className="h-36 rounded-xl bg-[#F5F5F7] flex items-center justify-center mb-[18px] border border-[#D2D2D7]">
                      <GameController size={32} className="text-[#4ECDC4]" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display text-xl tracking-[-0.01em] font-medium text-[#1D1D1F]">{g.name}</h3>
                    {g.status === 'coming_soon' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73] border border-[#D2D2D7] px-2 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#6E6E73] leading-relaxed mb-[18px] min-h-[42px] line-clamp-2">
                    {g.description || 'Independent production by Vakar Games.'}
                  </p>
                  <span className="text-[11.5px] font-semibold text-[#4ECDC4] inline-flex items-center gap-1">
                    View title details <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </Reveal>
          ) : (
            <Reveal as="div" className="mt-12 p-12 liquid-glass rounded-2xl max-w-xl mx-auto border border-[#D2D2D7]">
              <div className="w-12 h-12 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center mx-auto mb-4">
                <Sparkle size={20} className="text-[#4ECDC4]" />
              </div>
              <h3 className="font-display text-xl font-medium text-[#1D1D1F] mb-2">New Titles in Production</h3>
              <p className="text-sm text-[#6E6E73] leading-relaxed mb-6">
                Our game projects are currently undergoing development and testing. Stay tuned to our devlog journal for early reveals and release announcements.
              </p>
              <Link to="/blog">
                <PublicButton size="sm" variant="outline">Read Studio Devlogs</PublicButton>
              </Link>
            </Reveal>
          )}

          <div className="mt-10">
            <Link to="/games" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#4ECDC4] group">
              Browse full studio catalog <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* The Studio */}
      <section ref={aboutRef} id="studio" className="bg-[#F5F5F7] py-20 sm:py-28 px-6" data-testid="about-section">
        <div className="max-w-[1120px] mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 items-center">
          <Reveal as="div">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// the studio</p>
            <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              <span style={{ textWrap: 'balance' }}>Focused on games,<br />not fleeting trends.</span>
            </h2>
            <p className="text-[16px] sm:text-[18px] text-[#6E6E73] mt-5 leading-relaxed max-w-[46ch]">
              We keep the core team compact on purpose. Every artist, developer and sound designer is closely connected to the vision, ensuring each game carries an authentic, unmistakable identity.
            </p>
            <div className="mt-8 flex items-center gap-6">
              <div>
                <p className="font-display text-2xl font-bold text-[#1D1D1F]">2024</p>
                <p className="text-xs text-[#6E6E73]">Founded</p>
              </div>
              <div className="w-px h-8 bg-[#D2D2D7]" />
              <div>
                <p className="font-display text-2xl font-bold text-[#1D1D1F]">France</p>
                <p className="text-xs text-[#6E6E73]">Headquarters</p>
              </div>
              <div className="w-px h-8 bg-[#D2D2D7]" />
              <div>
                <p className="font-display text-2xl font-bold text-[#1D1D1F]">PC · Web</p>
                <p className="text-xs text-[#6E6E73]">Platforms</p>
              </div>
            </div>
          </Reveal>

          <Reveal as="div" style={{ transitionDelay: '100ms' }}>
            <LiveTerminal />
          </Reveal>
        </div>
      </section>

      {/* Craft */}
      <section className="py-20 sm:py-28 px-6">
        <div className="max-w-[1120px] mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-12 items-center">
          <Reveal as="div" className={`${FRAME_CLS} aspect-[4/3]`}>
            <img src={tealFronds} alt="Studio Craft" className="w-full h-full object-cover" />
          </Reveal>
          <Reveal as="div" style={{ transitionDelay: '100ms' }}>
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// development philosophy</p>
            <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              <span style={{ textWrap: 'balance' }}>Slow, deliberate, refined.</span>
            </h2>
            <p className="text-[16px] sm:text-[18px] text-[#6E6E73] mt-5 leading-relaxed max-w-[46ch]">
              We believe great games take patience. We prototype rigorously, discard what doesn't spark joy, and polish until the controls feel natural and the world feels alive.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" className="py-20 sm:py-28 px-6">
        <Reveal className="max-w-[1040px] mx-auto liquid-glass rounded-[24px] px-8 sm:px-12 py-10 sm:py-12 flex flex-col sm:flex-row items-center justify-between gap-8 text-center sm:text-left" as="div">
          <div>
            <p className="text-[12px] font-mono text-[#6E6E73] mb-3">// connect with us</p>
            <h2 className="font-display text-[26px] sm:text-[32px] leading-[1.1] tracking-[-0.01em] font-medium text-[#1D1D1F]">
              Let's talk games.
            </h2>
            <p className="text-[15px] text-[#6E6E73] mt-2 max-w-[38ch]">
              Press inquiries, publishing opportunities, community feedback or questions — we read every message.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center shrink-0">
            <PublicButton as={Link} to="/contact" data-testid="contact-email-button">
              Contact studio
            </PublicButton>
            <PublicButton as="a" href="mailto:support@vakargames.com" variant="outline">
              Email us directly
            </PublicButton>
          </div>
        </Reveal>
      </section>

      <SiteFooter onAbout={scrollToAbout} />
    </div>
  );
};

export default Home;
