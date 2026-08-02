import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Users, Wrench } from 'lucide-react';
import axios from 'axios';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FEATURES = [
  {
    icon: Code2,
    title: 'Software & game development',
    text: 'From web platforms to native apps and games — built end-to-end, with no outsourced core systems.',
  },
  {
    icon: Users,
    title: 'Community & clients',
    text: 'Direct feedback loops that shape the roadmap, not just the release notes.',
  },
  {
    icon: Wrench,
    title: 'In-house tooling',
    text: 'Accounts, shop and live-ops systems we build and own outright.',
  },
];

const Home = () => {
  const aboutRef = useRef(null);
  const [featuredGame, setFeaturedGame] = useState(null);
  const [games, setGames] = useState([]);

  useEffect(() => {
    document.title = 'Vakar Games — Software, Applications & Games';
    axios.get(`${API_URL}/api/website/games/featured`)
      .then(r => { if (r.data.game) setFeaturedGame(r.data.game); })
      .catch(() => {});
    axios.get(`${API_URL}/api/website/games/public`)
      .then(r => setGames(r.data.games || []))
      .catch(() => {});
  }, []);

  const scrollToAbout = () =>
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });

  const titlesShipped = games.filter(g => g.status === 'published').length;

  return (
    <div className="bg-white">
      <PublicNav onAbout={scrollToAbout} />

      {/* Hero */}
      <section className="relative overflow-hidden [contain:paint] pt-[160px] pb-24 px-6 text-center" data-testid="hero-section">
        {/* Ambient glow — the color the glass badge below refracts */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 -translate-x-[62%] w-[560px] h-[560px] rounded-full bg-[#4ECDC4]/25 blur-[110px]" />
          <div className="absolute -top-24 left-1/2 translate-x-[8%] w-[420px] h-[420px] rounded-full bg-[#6C5CE7]/15 blur-[110px]" />
        </div>

        <div className="max-w-[1040px] mx-auto">
          <Reveal as="div" className="mb-6 flex justify-center">
            <span className="liquid-glass rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#3A3A3C]">
              Independent Software Company — Est. 2024
            </span>
          </Reveal>
          <Reveal
            as="h1"
            className="text-[40px] sm:text-[64px] lg:text-[80px] leading-[1.05] tracking-[-0.03em] font-bold text-[#1D1D1F]"
          >
            <span style={{ textWrap: 'balance' }} data-testid="hero-title">
              Software built to<br /><span className="text-[#4ECDC4]">endure.</span>
            </span>
          </Reveal>
          <Reveal as="p" className="text-[17px] sm:text-[21px] text-[#6E6E73] max-w-[42ch] mx-auto mt-5 leading-relaxed">
            Vakar Games is a software company crafting applications, tools and games — for the public and for professionals alike. Small team, deliberate choices, no shortcuts on what matters.
          </Reveal>
          <Reveal as="div" className="flex items-center justify-center gap-3 mt-9 flex-wrap">
            <button
              onClick={() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' })}
              className="liquid-glass liquid-glass-interactive rounded-full inline-flex items-center gap-1.5 text-[14px] font-medium text-[#1D1D1F] px-5 py-2.5 group"
            >
              Explore our work <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={scrollToAbout}
              className="rounded-full inline-flex items-center gap-1.5 text-[14px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] px-5 py-2.5 transition-colors group"
            >
              Meet the company <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* Featured game */}
      <section className="bg-[#F5F5F7] py-[132px] px-6 text-center">
        <div className="max-w-[1040px] mx-auto">
          <Reveal as="p" className="text-[13px] font-semibold text-[#6E6E73] mb-[18px]">Featured release</Reveal>
          {featuredGame ? (
            <>
              <Reveal as="h2" className="text-[32px] sm:text-[44px] leading-[1.08] tracking-[-0.025em] font-bold text-[#1D1D1F]">
                <span style={{ textWrap: 'balance' }}>
                  {featuredGame.name}
                  {featuredGame.description ? '.' : ''}
                </span>
              </Reveal>
              {featuredGame.description && (
                <Reveal as="p" className="text-[17px] sm:text-[21px] text-[#6E6E73] max-w-[42ch] mx-auto mt-5 leading-relaxed">
                  {featuredGame.description}
                </Reveal>
              )}
              <Reveal
                className="mt-14 rounded-[24px] border border-[#D2D2D7] overflow-hidden flex items-center justify-center"
                as="div"
              >
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(180deg, #FAFAFB 0%, #F0F0F2 100%)', aspectRatio: '16 / 8.2' }}
                >
                  {featuredGame.logo_url || featuredGame.screenshots?.[0] ? (
                    <img
                      src={
                        (featuredGame.logo_url || featuredGame.screenshots[0]).startsWith('/')
                          ? `${API_URL}${featuredGame.logo_url || featuredGame.screenshots[0]}`
                          : (featuredGame.logo_url || featuredGame.screenshots[0])
                      }
                      alt={featuredGame.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[48px] sm:text-[80px] font-bold tracking-[-0.03em] text-[#1D1D1F] opacity-90 uppercase">
                      {featuredGame.name}
                    </span>
                  )}
                </div>
              </Reveal>
              <Reveal as="div" className="mt-7">
                <Link to="/shop" className="inline-flex items-center gap-1.5 text-base text-[#4ECDC4] group">
                  View on the shop <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Reveal>
            </>
          ) : (
            <>
              <h2 className="text-[32px] sm:text-[44px] leading-[1.08] tracking-[-0.025em] font-bold text-[#1D1D1F]">
                New releases, in the works.
              </h2>
              <p className="text-[17px] text-[#6E6E73] max-w-[42ch] mx-auto mt-5 leading-relaxed">
                Follow the company journal for updates on what's next.
              </p>
              <div className="mt-7">
                <Link to="/blog" className="inline-flex items-center gap-1.5 text-base text-[#4ECDC4] group">
                  Read the journal <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Games grid */}
      {games.length > 0 && (
        <section id="games" className="py-[132px] px-6 text-center">
          <div className="max-w-[1040px] mx-auto">
            <Reveal as="p" className="text-[13px] font-semibold text-[#6E6E73] mb-[18px]">Games we've shipped</Reveal>
            <Reveal as="h2" className="text-[32px] sm:text-[44px] leading-[1.08] tracking-[-0.025em] font-bold text-[#1D1D1F]">
              {games.length === 1 ? 'One world, one philosophy.' : `${games.length} worlds. One philosophy.`}
            </Reveal>

            <Reveal
              className="mt-14 grid text-left rounded-[18px] border border-[#D2D2D7] overflow-hidden"
              as="div"
              style={{ gridTemplateColumns: `repeat(${Math.min(games.length, 3)}, 1fr)`, gap: '1px', background: '#D2D2D7' }}
            >
              {games.slice(0, 3).map(game => (
                <Link
                  key={game.slug}
                  to={`/shop?game=${game.slug}`}
                  className="bg-white hover:bg-[#FCFCFD] transition-colors px-[30px] py-9"
                >
                  <div className="text-[13px] font-bold text-[#4ECDC4] tracking-[0.04em] mb-[18px] uppercase">
                    {game.name}
                  </div>
                  <h3 className="text-xl tracking-[-0.01em] font-bold text-[#1D1D1F] mb-2">{game.name}</h3>
                  <p className="text-sm text-[#6E6E73] leading-relaxed mb-[18px] min-h-[42px]">
                    {game.description || ' '}
                  </p>
                  <span className="text-[11.5px] font-semibold text-[#6E6E73]">
                    {game.status === 'coming_soon' ? 'In development' : `Live${game.platforms?.length ? ' — ' + game.platforms.map(p => p.name).join(' · ') : ''}`}
                  </span>
                </Link>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* Company */}
      <section ref={aboutRef} id="studio" className="bg-[#F5F5F7] py-[132px] px-6 text-center" data-testid="about-section">
        <div className="max-w-[1040px] mx-auto">
          <Reveal as="p" className="text-[13px] font-semibold text-[#6E6E73] mb-[18px]">The company</Reveal>
          <Reveal as="h2" className="text-[32px] sm:text-[44px] leading-[1.08] tracking-[-0.025em] font-bold text-[#1D1D1F]">
            <span style={{ textWrap: 'balance' }}>Made by a small,<br />opinionated team.</span>
          </Reveal>
          <Reveal as="p" className="text-[17px] sm:text-[21px] text-[#6E6E73] max-w-[42ch] mx-auto mt-5 leading-relaxed">
            We keep the roster deliberately small — people who ship, support and iterate on every product long after release.
          </Reveal>

          <div className="mt-16 grid sm:grid-cols-3 gap-12 text-left">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} className="pt-5 border-t border-[#D2D2D7]" style={{ transitionDelay: `${i * 80}ms` }}>
                <Icon size={22} className="text-[#4ECDC4] mb-[18px]" strokeWidth={2} />
                <h3 className="text-[17px] tracking-[-0.01em] font-bold text-[#1D1D1F] mb-2">{title}</h3>
                <p className="text-sm text-[#6E6E73] leading-relaxed">{text}</p>
              </Reveal>
            ))}
          </div>

          <Reveal as="div" className="mt-16 grid grid-cols-3 gap-8">
            {[
              { n: titlesShipped || games.length, label: 'Products shipped' },
              { n: '2024', label: 'Company founded' },
              { n: 'Web · Mobile', label: 'Platforms' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[36px] sm:text-[56px] leading-none font-bold tracking-[-0.02em] text-[#1D1D1F]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {s.n}
                </div>
                <div className="text-[13.5px] text-[#6E6E73] mt-2">{s.label}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-[132px] px-6 text-center">
        <div className="max-w-[1040px] mx-auto">
          <Reveal as="p" className="text-[13px] font-semibold text-[#6E6E73] mb-[18px]">Get in touch</Reveal>
          <Reveal as="h2" className="text-[32px] sm:text-[44px] leading-[1.08] tracking-[-0.025em] font-bold text-[#1D1D1F]">
            Let's build together.
          </Reveal>
          <Reveal as="p" className="text-[17px] sm:text-[21px] text-[#6E6E73] max-w-[42ch] mx-auto mt-5 leading-relaxed">
            Press, partnerships, or a question about one of our products — we read everything ourselves.
          </Reveal>
          <Reveal as="div" className="flex items-center justify-center gap-3 mt-9 flex-wrap">
            <Link
              to="/contact"
              className="inline-flex items-center rounded-full bg-[#1D1D1F] hover:opacity-80 text-white text-sm font-medium px-5 py-2.5 transition-opacity"
              data-testid="contact-email-button"
            >
              Open a ticket
            </Link>
            <a
              href="mailto:support@vakargames.com"
              className="inline-flex items-center rounded-full border border-[#D2D2D7] hover:bg-black/[0.03] text-[#1D1D1F] text-sm font-medium px-5 py-2.5 transition-colors"
            >
              Email us
            </a>
          </Reveal>
        </div>
      </section>

      <SiteFooter onAbout={scrollToAbout} />
    </div>
  );
};

export default Home;
