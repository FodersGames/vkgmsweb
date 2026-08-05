import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MagicWand, Rocket, Code } from '@phosphor-icons/react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
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

const BENEFITS = [
  {
    icon: MagicWand, title: 'Visual builder',
    description: 'Screens, components and actions — drag, drop, connect. No code required, ever.',
  },
  {
    icon: Rocket, title: 'Submit & get featured',
    description: 'Send a version for review, and once approved it goes live and appears on Applications.',
  },
  {
    icon: Code, title: 'Export to code',
    description: 'Vakar+ unlocks a real, ready-to-open VS Code project — HTML, CSS and JS, yours to keep.',
  },
];

const Home = () => {
  const aboutRef = useRef(null);
  const { user } = useAuth();
  const [apps, setApps] = useState([]);

  useEffect(() => {
    document.title = 'Vakar Games — Vakar Studio, the no-code app builder';
    axios.get(`${API_URL}/api/apps`)
      .then(r => setApps(r.data.apps || []))
      .catch(() => {});
  }, []);

  const scrollToAbout = () =>
    aboutRef.current?.scrollIntoView({ behavior: 'smooth' });

  const img = (url) => (url?.startsWith('/') ? `${API_URL}${url}` : url);

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
              // vakar studio
            </Reveal>
            <Reveal
              as="h1"
              className="font-display text-[38px] sm:text-[56px] lg:text-[64px] leading-[1.05] tracking-[-0.01em] font-medium text-[#1D1D1F]"
            >
              <span style={{ textWrap: 'balance' }} data-testid="hero-title">
                Build apps. <em className="not-italic text-[#4ECDC4]">No code needed.</em>
              </span>
            </Reveal>
            <Reveal as="p" className="text-[16px] sm:text-[18px] text-[#6E6E73] max-w-[46ch] mx-auto lg:mx-0 mt-5 leading-relaxed">
              Vakar Studio is our one product: a visual app builder. Design screens, wire up actions, and publish — we write and host every core system ourselves, so we're the ones who answer for it when something breaks.
            </Reveal>
            <Reveal as="div" className="flex items-center justify-center lg:justify-start gap-3 mt-8 flex-wrap">
              <Link to={user ? '/my-apps' : '/login'}>
                <PublicButton icon={ArrowRight} className="group">
                  Start building
                </PublicButton>
              </Link>
              <Link to="/applications">
                <PublicButton variant="outline">
                  See what people built
                </PublicButton>
              </Link>
            </Reveal>
          </div>

          <Reveal as="div" className={`${FRAME_CLS} aspect-[4/3] lg:aspect-[3/4]`} style={{ transitionDelay: '100ms' }}>
            <img src={jellyfish} alt="" className="w-full h-full object-cover" />
          </Reveal>
        </div>
      </section>

      {/* Why Vakar Studio */}
      <section className="bg-[#F5F5F7] py-20 sm:py-28 px-6">
        <div className="max-w-[1120px] mx-auto">
          <Reveal className="text-center max-w-lg mx-auto mb-14">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// how it works</p>
            <h2 className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              <span style={{ textWrap: 'balance' }}>From idea to published app.</span>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-5">
            {BENEFITS.map((b, i) => (
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

      {/* Community showcase */}
      {apps.length > 0 && (
        <section id="applications" className="py-20 sm:py-28 px-6 text-center">
          <div className="max-w-[1040px] mx-auto">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// from our community</p>
            <Reveal as="h2" className="font-display text-[30px] sm:text-[42px] leading-[1.08] tracking-[-0.015em] font-medium text-[#1D1D1F]">
              Built with Vakar Studio.
            </Reveal>

            <Reveal
              className="mt-14 grid text-left rounded-[18px] border border-[#D2D2D7] overflow-hidden"
              as="div"
              style={{ gridTemplateColumns: `repeat(${Math.min(apps.length, 3)}, 1fr)`, gap: '1px', background: '#D2D2D7' }}
            >
              {apps.slice(0, 3).map(a => (
                <a
                  key={a.slug}
                  href={`/apps/${a.slug}`} target="_blank" rel="noopener noreferrer"
                  className="relative bg-white hover:bg-[#FCFCFD] hover:shadow-[0_16px_32px_-16px_rgba(0,0,0,0.18)] hover:-translate-y-px hover:z-10 transition-all duration-300 ease-out px-[30px] py-9"
                >
                  {a.review_logo_url ? (
                    <img
                      src={img(a.review_logo_url)}
                      alt={a.review_name || a.name}
                      className="w-11 h-11 rounded-xl object-cover mb-[18px] border border-[#D2D2D7]"
                    />
                  ) : (
                    <div className="text-[12px] font-mono text-[#4ECDC4] mb-[18px]">
                      {a.review_name || a.name}
                    </div>
                  )}
                  <h3 className="font-display text-xl tracking-[-0.01em] font-medium text-[#1D1D1F] mb-2">{a.review_name || a.name}</h3>
                  <p className="text-sm text-[#6E6E73] leading-relaxed mb-[18px] min-h-[42px] line-clamp-2">
                    {a.review_description || ' '}
                  </p>
                  <span className="text-[11.5px] font-semibold text-[#6E6E73]">Open the app</span>
                </a>
              ))}
            </Reveal>

            <div className="mt-10">
              <Link to="/applications" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#4ECDC4] group">
                Browse all applications <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
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
            {apps.length > 0 && (
              <p className="text-[14px] text-[#A1A1A6] mt-5">
                {apps.length} app{apps.length === 1 ? '' : 's'} built with Vakar Studio and featured so far.
              </p>
            )}
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
