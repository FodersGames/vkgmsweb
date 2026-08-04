import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import axios from 'axios';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import { LiveTerminal } from '../components/LiveTerminal';
import { PublicButton } from '../ui/PublicButton';
import jellyfish from '../assets/photos/jellyfish.jpg';
import tealFronds from '../assets/photos/teal-fronds.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// One recipe for every framed photo on this page — border, radius, ratio —
// reused instead of inventing a new treatment per section.
const FRAME_CLS = 'rounded-[20px] border border-[#D2D2D7] overflow-hidden';

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

      {/* Hero — same asymmetric grid as every other image section on this page */}
      <section className="relative overflow-hidden [contain:paint] pt-[132px] pb-20 sm:pb-28 px-6" data-testid="hero-section">
        <div className="dot-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="max-w-[1120px] mx-auto grid lg:grid-cols-[1fr_0.85fr] gap-10 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <Reveal
              as="p"
              className="text-[12px] font-mono text-[#6E6E73] mb-5"
            >
              // vakar-games, est. 2024
            </Reveal>
            <Reveal
              as="h1"
              className="font-display text-[38px] sm:text-[56px] lg:text-[64px] leading-[1.05] tracking-[-0.01em] font-medium text-[#1D1D1F]"
            >
              <span style={{ textWrap: 'balance' }} data-testid="hero-title">
                Software built to <em className="not-italic text-[#4ECDC4]">endure.</em>
              </span>
            </Reveal>
            <Reveal as="p" className="text-[16px] sm:text-[18px] text-[#6E6E73] max-w-[46ch] mx-auto lg:mx-0 mt-5 leading-relaxed">
              Three products, one small team. We write and host every core system ourselves, so we're the ones who answer for it when something breaks.
            </Reveal>
            <Reveal as="div" className="flex items-center justify-center lg:justify-start mt-8">
              <PublicButton
                onClick={() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' })}
                variant="secondary"
                icon={ArrowRight}
                className="group"
              >
                Explore our work
              </PublicButton>
            </Reveal>
          </div>

          <Reveal as="div" className={`${FRAME_CLS} aspect-[4/3] lg:aspect-[3/4]`} style={{ transitionDelay: '100ms' }}>
            <img src={jellyfish} alt="" className="w-full h-full object-cover" />
          </Reveal>
        </div>
      </section>

      {/* Featured game — the same asymmetric grid, now with real product content */}
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
                className={`lg:order-1 ${FRAME_CLS} flex items-center justify-center lg:-ml-10`}
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
                  className="relative bg-white hover:bg-[#FCFCFD] hover:shadow-[0_16px_32px_-16px_rgba(0,0,0,0.18)] hover:-translate-y-px hover:z-10 transition-all duration-300 ease-out px-[30px] py-9"
                >
                  {game.logo_url ? (
                    <img
                      src={game.logo_url.startsWith('/') ? `${API_URL}${game.logo_url}` : game.logo_url}
                      alt={game.name}
                      className="w-11 h-11 rounded-xl object-cover mb-[18px] border border-[#D2D2D7]"
                    />
                  ) : (
                    <div className="text-[12px] font-mono text-[#4ECDC4] mb-[18px]">
                      {game.name}
                    </div>
                  )}
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

      {/* Company — the terminal does the talking, not an icon grid */}
      <section ref={aboutRef} id="studio" className="bg-[#F5F5F7] py-20 sm:py-28 px-6" data-testid="about-section">
        <div className="max-w-[1120px] mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 items-center">
          <Reveal as="div">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// the company</p>
            <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              <span style={{ textWrap: 'balance' }}>Made by a small,<br />opinionated team.</span>
            </h2>
            <p className="text-[16px] sm:text-[18px] text-[#6E6E73] mt-5 leading-relaxed max-w-[46ch]">
              We keep the roster small on purpose — the people who build a product are still the ones supporting it a year later. Nothing here runs on someone else's template.
            </p>
            <p className="text-[14px] text-[#A1A1A6] mt-5">
              {titlesShipped || games.length} product{(titlesShipped || games.length) === 1 ? '' : 's'} shipped since we started, in 2024.
            </p>
          </Reveal>

          <Reveal as="div" style={{ transitionDelay: '100ms' }}>
            <LiveTerminal />
          </Reveal>
        </div>
      </section>

      {/* Craft — same asymmetric grid as the hero and featured release, mirrored */}
      <section className="py-20 sm:py-28 px-6">
        <div className="max-w-[1120px] mx-auto grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-12 items-center">
          <Reveal as="div" className={`${FRAME_CLS} aspect-[4/3]`}>
            <img src={tealFronds} alt="" className="w-full h-full object-cover" />
          </Reveal>
          <Reveal as="div" style={{ transitionDelay: '100ms' }}>
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// how we work</p>
            <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              <span style={{ textWrap: 'balance' }}>Slow, on purpose.</span>
            </h2>
            <p className="text-[16px] sm:text-[18px] text-[#6E6E73] mt-5 leading-relaxed max-w-[46ch]">
              We'd rather ship a feature once, working properly, than patch it three times after launch. That means fewer releases than most studios our size — and each one held to a higher bar.
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA — a glass bar, same light system as the rest of the page */}
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
            <PublicButton as={Link} to="/contact" data-testid="contact-email-button">
              Open a ticket
            </PublicButton>
            <PublicButton as="a" href="mailto:support@vakargames.com" variant="outline">
              Email us
            </PublicButton>
          </div>
        </Reveal>
      </section>

      <SiteFooter onAbout={scrollToAbout} />
    </div>
  );
};

export default Home;
