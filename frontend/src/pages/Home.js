import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import axios from 'axios';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { LiveTerminal } from '../components/LiveTerminal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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
        <div className="dot-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

        <div className="max-w-[1040px] mx-auto">
          <Reveal as="div" className="mb-6 flex justify-center">
            <span className="liquid-glass rounded-full px-4 py-1.5 text-[12px] font-mono font-medium tracking-wide text-[#3A3A3C]">
              vakar-games · independent software co. · est. 2024
            </span>
          </Reveal>
          <Reveal
            as="h1"
            className="font-display text-[42px] sm:text-[68px] lg:text-[84px] leading-[1.03] tracking-[-0.01em] font-medium text-[#1D1D1F]"
          >
            <span style={{ textWrap: 'balance' }} data-testid="hero-title">
              Software built to<br /><em className="not-italic text-[#4ECDC4]">endure.</em>
            </span>
          </Reveal>
          <Reveal as="p" className="text-[17px] sm:text-[21px] text-[#6E6E73] max-w-[42ch] mx-auto mt-6 leading-relaxed">
            We build the applications, tools and games we'd want to use ourselves — every core system written and run in-house, nothing rented out to a template.
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

      {/* Featured game — asymmetric: image bleeds to the edge, copy sits beside it */}
      <section className="bg-[#F5F5F7] py-20 sm:py-28 px-6">
        <div className="max-w-[1120px] mx-auto">
          {featuredGame ? (
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-4 items-center">
              <Reveal as="div" className="lg:order-2">
                <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// featured release</p>
                <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
                  <span style={{ textWrap: 'balance' }}>{featuredGame.name}</span>
                </h2>
                {featuredGame.description && (
                  <p className="text-[16px] sm:text-[18px] text-[#6E6E73] mt-4 leading-relaxed max-w-[46ch]">
                    {featuredGame.description}
                  </p>
                )}
                <Link
                  to="/shop"
                  className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-[#4ECDC4] group"
                >
                  View on the shop <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Reveal>
              <Reveal
                className="lg:order-1 rounded-[20px] border border-[#D2D2D7] overflow-hidden flex items-center justify-center lg:-ml-10"
                as="div"
              >
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(180deg, #FAFAFB 0%, #F0F0F2 100%)', aspectRatio: '4 / 3' }}
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
                    <span className="text-[40px] sm:text-[64px] font-display font-medium tracking-[-0.02em] text-[#1D1D1F] opacity-90 uppercase px-6 text-center">
                      {featuredGame.name}
                    </span>
                  )}
                </div>
              </Reveal>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// featured release</p>
              <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
                New releases, in the works.
              </h2>
              <p className="text-[16px] text-[#6E6E73] max-w-[42ch] mx-auto mt-4 leading-relaxed">
                Follow the company journal for updates on what's next.
              </p>
              <div className="mt-6">
                <Link to="/blog" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#4ECDC4] group">
                  Read the journal <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Games grid */}
      {games.length > 0 && (
        <section id="games" className="py-20 sm:py-28 px-6 text-center">
          <div className="max-w-[1040px] mx-auto">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// games we've shipped</p>
            <Reveal as="h2" className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
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
                  <div className="text-[12px] font-mono text-[#4ECDC4] mb-[18px]">
                    {game.name}
                  </div>
                  <h3 className="font-display text-xl tracking-[-0.01em] font-medium text-[#1D1D1F] mb-2">{game.name}</h3>
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

      {/* Company — asymmetric: the terminal does the talking, not an icon grid */}
      <section ref={aboutRef} id="studio" className="bg-[#F5F5F7] py-20 sm:py-28 px-6" data-testid="about-section">
        <div className="max-w-[1120px] mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 items-center">
          <Reveal as="div">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// the company</p>
            <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              <span style={{ textWrap: 'balance' }}>Made by a small,<br />opinionated team.</span>
            </h2>
            <p className="text-[16px] sm:text-[18px] text-[#6E6E73] mt-5 leading-relaxed max-w-[46ch]">
              We keep the roster deliberately small — people who ship, support and iterate on every product long after release. No offshore core systems, no template stack.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-6 max-w-[420px]">
              {[
                { n: titlesShipped || games.length, label: 'Products shipped' },
                { n: '2024', label: 'Founded' },
                { n: '100%', label: 'In-house stack' },
              ].map(s => (
                <div key={s.label}>
                  <div className="font-mono text-[26px] sm:text-[34px] leading-none font-medium tracking-[-0.01em] text-[#1D1D1F]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {s.n}
                  </div>
                  <div className="text-[12.5px] text-[#6E6E73] mt-2">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal as="div" style={{ transitionDelay: '100ms' }}>
            <LiveTerminal />
          </Reveal>
        </div>
      </section>

      {/* CTA — a glass bar instead of another centered stack */}
      <section id="contact" className="py-20 sm:py-28 px-6">
        <Reveal className="max-w-[1040px] mx-auto liquid-glass rounded-[24px] px-8 sm:px-12 py-10 sm:py-12 flex flex-col sm:flex-row items-center justify-between gap-8 text-center sm:text-left" as="div">
          <div>
            <p className="text-[12px] font-mono text-[#6E6E73] mb-3">// get in touch</p>
            <h2 className="font-display text-[26px] sm:text-[32px] leading-[1.1] tracking-[-0.01em] font-medium text-[#1D1D1F]">
              Let's build together.
            </h2>
            <p className="text-[15px] text-[#6E6E73] mt-2 max-w-[38ch]">
              Press, partnerships, or a question about one of our products — we read everything ourselves.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center shrink-0">
            <Link
              to="/contact"
              className="glass-sheen inline-flex items-center rounded-full bg-[#1D1D1F] hover:bg-[#3A3A3C] text-white text-sm font-medium px-5 py-2.5 transition-colors"
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
          </div>
        </Reveal>
      </section>

      <SiteFooter onAbout={scrollToAbout} />
    </div>
  );
};

export default Home;
