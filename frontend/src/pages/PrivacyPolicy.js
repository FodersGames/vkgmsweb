import React, { useEffect, useState } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { ShieldCheck, ArrowUpRight, LockKey, EnvelopeSimple, BookOpen, UserCircle } from '@phosphor-icons/react';

const SECTIONS = [
  {
    id: 'who',
    num: '01',
    title: 'Who We Are',
    content: (
      <>
        <p>Vakar Games is an independent French video game studio. This Privacy Policy explains how we handle information when you visit <strong className="text-white">vakargames.com</strong>, create an account, make purchases, or use features within our games such as the in-game chat system.</p>
      </>
    ),
  },
  {
    id: 'data',
    num: '02',
    title: 'What Data We Collect',
    content: (
      <>
        <p className="mb-3">Depending on how you use our services, we may store:</p>
        <ul className="space-y-2 mb-3">
          {[
            'Account information: email address, username, display name',
            'Optional profile picture, if you upload one (stored securely with instant cloud delivery)',
            'Purchase history linked to your account (product, amount, date)',
            'In-game chat messages (up to 200 characters each) and your in-game username',
            'Support ticket contents and staff replies',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6600] mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-white/50 border-l-2 border-[#FF6600]/50 pl-3 py-1">
          Payment card details are processed directly by <strong className="text-white">Stripe</strong> and never touch our servers. See Stripe's privacy policy for details on payment processing.
        </p>
      </>
    ),
  },
  {
    id: 'usage',
    num: '03',
    title: 'How We Use Your Data',
    content: (
      <>
        <p>Your data is used solely to operate the services: authenticating your account, delivering purchased items, displaying chat messages to other players, answering support requests, and applying loyalty discounts. We do not use your data for advertising or profiling, and we never sell it to third parties.</p>
      </>
    ),
  },
  {
    id: 'retention',
    num: '04',
    title: 'Data Retention',
    content: (
      <>
        <p>Chat messages are subject to automatic rolling deletion: each game project retains at most 100 messages, with the oldest deleted first. Account and purchase data is retained while your account is active. You can request deletion of your account and associated data at any time.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    num: '05',
    title: 'Cookies & Storage',
    content: (
      <>
        <p>We use a small number of technical cookies and local storage entries required for the site to function, such as keeping you signed in and remembering your cookie consent choice. We do not use third-party tracking or advertising cookies. You can manage your preference through the cookie banner shown on your first visit.</p>
      </>
    ),
  },
  {
    id: 'third-party',
    num: '06',
    title: 'Third-Party Services',
    content: (
      <>
        <p>Payments are processed by <strong className="text-white">Stripe</strong>. Stripe may process your payment information according to its own privacy policy. We do not embed third-party advertising, social media trackers, or analytics scripts.</p>
      </>
    ),
  },
  {
    id: 'children',
    num: '07',
    title: "Children's Privacy",
    content: (
      <>
        <p>Our games and website are not directed at children under the age of 13. We do not knowingly collect data from children under 13. If you believe a child has submitted data through our services, please contact us and we will remove it promptly.</p>
      </>
    ),
  },
  {
    id: 'gdpr',
    num: '08',
    title: 'Your Rights (GDPR)',
    content: (
      <>
        <p className="mb-3">If you are located in the European Union, you have the following rights under the General Data Protection Regulation (GDPR):</p>
        <ul className="space-y-2 mb-3">
          {[
            'The right to access data we hold about you (downloadable from your profile or admin request)',
            'The right to request correction or update of your data',
            'The right to request deletion of your account and all associated personal data',
            'The right to object to or restrict processing',
            'The right to lodge a complaint with your national data protection authority (such as the CNIL in France)',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6600] mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-white/50">To exercise any of these rights, please email us directly or submit a ticket from your account.</p>
      </>
    ),
  },
  {
    id: 'changes',
    num: '09',
    title: 'Changes to This Policy',
    content: (
      <>
        <p>We may update this policy as our services evolve. Any changes will be posted on this page with an updated date. We encourage you to review this page periodically.</p>
      </>
    ),
  },
  {
    id: 'contact',
    num: '10',
    title: 'Contact',
    content: (
      <>
        <p className="mb-2">For any privacy-related questions, data export requests, or inquiries, please contact our data officer:</p>
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

const PrivacyPolicy = () => {
  const [activeSection, setActiveSection] = useState('who');

  useEffect(() => {
    document.title = 'Privacy Policy — Vakar Games';
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
          <p className="kefir-label mb-3" style={{ color: '#FF6600' }}>// DATA & PRIVACY</p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1
                className="font-black uppercase text-white"
                style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}
              >
                Privacy<br className="hidden sm:block" /> Policy.
              </h1>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '54ch' }}>
                We respect your privacy and design our systems with data minimization and transparency in mind. Here is how we protect your personal information.
              </p>
            </div>

            <div
              className="px-5 py-4 flex items-center gap-3.5 shrink-0 self-start lg:self-auto"
              style={{ backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <LockKey size={22} style={{ color: '#FF6600' }} />
              <div>
                <p className="font-mono text-xs text-white font-bold tracking-wider uppercase">GDPR Compliant</p>
                <p className="text-[11px] font-mono text-white/40 mt-0.5">September 2026 · European Union</p>
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

            {/* Quick links to Terms of Service */}
            <div className="p-6 bg-[#141414] border border-white/[0.08] flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#FF6600]">// TERMS</p>
                <p className="text-sm font-bold text-white mt-0.5">Need to check our Terms of Service?</p>
                <p className="text-xs text-white/40 mt-0.5">Review user obligations, rules, and store terms.</p>
              </div>
              <a
                href="/terms"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-black bg-[#FF6600] hover:bg-[#e05a00] transition-colors"
              >
                <span>Read Terms</span>
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

export default PrivacyPolicy;
