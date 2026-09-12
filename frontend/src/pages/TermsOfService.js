import React, { useEffect, useState } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { ShieldCheck, ArrowUpRight, CaretRight, Scales, EnvelopeSimple, BookOpen } from '@phosphor-icons/react';

const SECTIONS = [
  {
    id: 'acceptance',
    num: '01',
    title: 'Acceptance of Terms',
    content: (
      <>
        <p>By accessing or using the Vakar Games website (<strong className="text-white">vakargames.com</strong>) or any of our games, you agree to be bound by these Terms of Service. If you do not agree, please stop using our services.</p>
      </>
    ),
  },
  {
    id: 'services',
    num: '02',
    title: 'Our Services',
    content: (
      <>
        <p>Vakar Games provides a public website to showcase our game catalogue, a development blog, an online shop for games and in-game items, and backend tools that support in-game features such as real-time global chat. Our games are primarily distributed through platforms such as TurboWarp.</p>
      </>
    ),
  },
  {
    id: 'accounts',
    num: '03',
    title: 'Accounts & Purchases',
    content: (
      <>
        <p>Some features require a free account. You are responsible for keeping your credentials secure. Purchases are processed by Stripe; in-game items are delivered to the player ID you provide at checkout. Except where required by law, purchases of digital items are final and non-refundable once delivered.</p>
      </>
    ),
  },
  {
    id: 'chat',
    num: '04',
    title: 'Chat System',
    content: (
      <>
        <p className="mb-3">Some of our games include a real-time in-game chat. By using the chat system, you agree to the following:</p>
        <ul className="space-y-2">
          {[
            'Use an appropriate, non-offensive username',
            'Not post hateful, discriminatory, threatening, or sexually explicit content',
            'Understand that messages are visible to all players of the same game in real time',
            'Accept that messages may be moderated or removed without prior notice',
            'Acknowledge that banned words are automatically filtered and replaced with asterisks',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6600] mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'conduct',
    num: '05',
    title: 'Prohibited Conduct',
    content: (
      <>
        <p className="mb-3">When using any Vakar Games service, you agree not to:</p>
        <ul className="space-y-2">
          {[
            'Harass, threaten, or intimidate other players',
            'Impersonate Vakar Games staff or other players',
            'Spam, advertise third-party services, or distribute malicious links',
            'Attempt to circumvent rate limits, security measures, or API protections',
            'Reverse-engineer, scrape, or systematically copy our backend services or content',
            'Use our services for any unlawful purpose',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'ip',
    num: '06',
    title: 'Intellectual Property',
    content: (
      <>
        <p>All content on this website and in our games — including but not limited to artwork, source code, music, logos, and written content — is the property of Vakar Games and is protected by applicable copyright and intellectual property laws. You may not copy, redistribute, modify, or use our content without explicit written permission from Vakar Games.</p>
      </>
    ),
  },
  {
    id: 'warranty',
    num: '07',
    title: 'Disclaimer of Warranties',
    content: (
      <>
        <p>Our website and games are provided <strong className="text-white">"as is"</strong> and <strong className="text-white">"as available"</strong> without warranties of any kind. We do not guarantee uninterrupted access, freedom from errors, or that our services will meet your specific expectations. We reserve the right to modify, suspend, or discontinue any service at any time without notice.</p>
      </>
    ),
  },
  {
    id: 'liability',
    num: '08',
    title: 'Limitation of Liability',
    content: (
      <>
        <p>To the fullest extent permitted by applicable law, Vakar Games shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of — or inability to use — our services, even if we have been advised of the possibility of such damages.</p>
      </>
    ),
  },
  {
    id: 'changes',
    num: '09',
    title: 'Changes to These Terms',
    content: (
      <>
        <p>We may revise these Terms of Service at any time. When we do, we will update the date at the top of this page. Continued use of our services after any changes constitutes your acceptance of the updated terms.</p>
      </>
    ),
  },
  {
    id: 'law',
    num: '10',
    title: 'Governing Law',
    content: (
      <>
        <p>These Terms of Service are governed by and construed in accordance with the laws of <strong className="text-white">France</strong>. Any dispute arising out of or related to these terms shall be subject to the exclusive jurisdiction of the courts of France.</p>
      </>
    ),
  },
  {
    id: 'contact',
    num: '11',
    title: 'Contact',
    content: (
      <>
        <p className="mb-2">If you have questions about these Terms of Service, please reach out to our legal and support team:</p>
        <a
          href="mailto:support@vakargames.com"
          className="inline-flex items-center gap-1.5 text-[#FF6600] hover:underline font-mono text-sm"
        >
          <EnvelopeSimple size={15} />
          support@vakargames.com
        </a>
      </>
    ),
  },
];

const TermsOfService = () => {
  const [activeSection, setActiveSection] = useState('acceptance');

  useEffect(() => {
    document.title = 'Terms of Service — Vakar Games';
  }, []);

  const scrollTo = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav />

      {/* Hero */}
      <section style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: '90px', paddingBottom: '3.5rem' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <p className="kefir-label mb-3" style={{ color: '#FF6600' }}>// LEGAL & COMPLIANCE</p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1
                className="font-black uppercase text-white"
                style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}
              >
                Terms of<br className="hidden sm:block" /> Service.
              </h1>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '54ch' }}>
                Please review the terms and conditions governing your access to and use of the Vakar Games platform, store, and game services.
              </p>
            </div>

            <div
              className="px-5 py-4 flex items-center gap-3.5 shrink-0 self-start lg:self-auto"
              style={{ backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Scales size={22} style={{ color: '#FF6600' }} />
              <div>
                <p className="font-mono text-xs text-white font-bold tracking-wider uppercase">Last Revision</p>
                <p className="text-[11px] font-mono text-white/40 mt-0.5">September 2026 · France</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-[1100px] mx-auto px-6 py-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Sticky Table of Contents sidebar */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-28 space-y-1 p-4 bg-[#111111] border border-white/[0.06]">
              <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/[0.06]">
                <BookOpen size={15} className="text-[#FF6600]" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/80">Table of Contents</span>
              </div>
              <nav className="space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto">
                {SECTIONS.map((s) => {
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-mono transition-colors flex items-center gap-2 ${
                        isActive
                          ? 'text-[#FF6600] bg-[#FF6600]/10 font-bold'
                          : 'text-white/40 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="opacity-50 text-[10px]">{s.num}.</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Document Content */}
          <div className="lg:col-span-8 space-y-6">
            {SECTIONS.map((s) => (
              <article
                key={s.id}
                id={s.id}
                className="scroll-mt-28 p-6 sm:p-8 bg-[#111111] border border-white/[0.06] transition-all hover:border-white/[0.12]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                    // {s.num}
                  </span>
                  <h2 className="font-black uppercase text-base sm:text-lg text-white tracking-tight">
                    {s.title}
                  </h2>
                </div>
                <div className="text-sm text-white/70 leading-relaxed font-sans mt-3">
                  {s.content}
                </div>
              </article>
            ))}

            {/* Quick links to Privacy Policy */}
            <div className="p-6 bg-[#141414] border border-white/[0.08] flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#FF6600]">// PRIVACY</p>
                <p className="text-sm font-bold text-white mt-0.5">Looking for our Privacy Policy?</p>
                <p className="text-xs text-white/40 mt-0.5">Learn how we process, store, and protect your data.</p>
              </div>
              <a
                href="/privacy"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-black bg-[#FF6600] hover:bg-[#e05a00] transition-colors"
              >
                <span>Read Policy</span>
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default TermsOfService;

