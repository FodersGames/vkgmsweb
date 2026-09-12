import React, { useEffect, useState } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { LockKey, EnvelopeSimple, BookOpen, ArrowUpRight } from '@phosphor-icons/react';

const SECTIONS = [
  {
    id: 'who',
    num: '01',
    title: 'Who We Are',
    content: (
      <p>
        Vakar Games is an independent French video game studio. This Privacy Policy explains how we handle information when you visit <strong className="text-[#1D1D1F]">vakargames.com</strong>, create an account, make purchases, or use features within our games such as the in-game chat system.
      </p>
    ),
  },
  {
    id: 'data',
    num: '02',
    title: 'What Data We Collect',
    content: (
      <>
        <p className="mb-3">Depending on how you use our services, we may store:</p>
        <ul className="space-y-2 mb-4">
          {[
            'Account information: email address, username, display name',
            'Optional profile picture, if you upload one (stored securely with cloud delivery)',
            'Purchase history linked to your account (product, amount, date)',
            'In-game chat messages (up to 200 characters each) and your in-game username',
            'Support ticket contents and staff replies',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6600] mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#86868B] border-l-2 border-[#FF6600]/40 pl-3 py-1">
          Payment card details are processed directly by <strong className="text-[#1D1D1F]">Stripe</strong> and never touch our servers. See Stripe's privacy policy for details on payment processing.
        </p>
      </>
    ),
  },
  {
    id: 'usage',
    num: '03',
    title: 'How We Use Your Data',
    content: (
      <p>
        Your data is used solely to operate the services: authenticating your account, delivering purchased items, displaying chat messages to other players, answering support requests, and applying loyalty discounts. We do not use your data for advertising or profiling, and we never sell it to third parties.
      </p>
    ),
  },
  {
    id: 'retention',
    num: '04',
    title: 'Data Retention',
    content: (
      <p>
        Chat messages are subject to automatic rolling deletion: each game project retains at most 100 messages, with the oldest deleted first. Account and purchase data is retained while your account is active. You can request deletion of your account and associated data at any time.
      </p>
    ),
  },
  {
    id: 'cookies',
    num: '05',
    title: 'Cookies & Storage',
    content: (
      <p>
        We use a small number of technical cookies and local storage entries required for the site to function, such as keeping you signed in and remembering your cookie consent choice. We do not use third-party tracking or advertising cookies. You can manage your preference through the cookie banner shown on your first visit.
      </p>
    ),
  },
  {
    id: 'third-party',
    num: '06',
    title: 'Third-Party Services',
    content: (
      <p>
        Payments are processed by <strong className="text-[#1D1D1F]">Stripe</strong>. Stripe may process your payment information according to its own privacy policy. We do not embed third-party advertising, social media trackers, or external analytics scripts.
      </p>
    ),
  },
  {
    id: 'children',
    num: '07',
    title: "Children's Privacy",
    content: (
      <p>
        Our games and website are not directed at children under the age of 13. We do not knowingly collect data from children under 13. If you believe a child has submitted data through our services, please contact us and we will remove it promptly.
      </p>
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
            'Right of access: request a copy of the personal data we hold about you',
            'Right to rectification: request correction of inaccurate data',
            'Right to erasure ("right to be forgotten"): request deletion of your account and data',
            'Right to data portability: receive your data in a structured, machine-readable format',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F] mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'changes',
    num: '09',
    title: 'Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.
      </p>
    ),
  },
  {
    id: 'contact',
    num: '10',
    title: 'Contact',
    content: (
      <>
        <p className="mb-2">For any privacy-related questions, data export requests, or inquiries, please contact our team:</p>
        <a
          href="mailto:support@vakargames.com"
          className="inline-flex items-center gap-1.5 text-[#FF6600] hover:underline font-medium text-sm"
        >
          <EnvelopeSimple size={16} />
          support@vakargames.com
        </a>
      </>
    ),
  },
];

const PrivacyPolicy = () => {
  const [activeSection, setActiveSection] = useState('who');

  useEffect(() => {
    document.title = 'Privacy Policy | Vakar Games';
  }, []);

  const scrollTo = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="bg-white text-[#1D1D1F] min-h-screen flex flex-col">
      <PublicNav />

      {/* Hero Header */}
      <section className="pt-28 pb-12 border-b border-[#E5E5EA]">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-[#FF6600] mb-2">Legal</p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F]">
                Privacy Policy
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#6E6E73] max-w-xl">
                We respect your privacy and design our systems with data minimization and transparency in mind.
              </p>
            </div>

            <div className="px-5 py-3.5 flex items-center gap-3 shrink-0 self-start lg:self-auto bg-[#F5F5F7] rounded-xl border border-[#E5E5EA]">
              <LockKey size={22} className="text-[#FF6600]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">GDPR Compliant</p>
                <p className="text-[11px] text-[#86868B]">European Union · Standard</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-[1120px] mx-auto px-6 py-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Sticky Table of Contents sidebar */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-24 p-5 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA]">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#E5E5EA]">
                <BookOpen size={16} className="text-[#FF6600]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">Table of Contents</span>
              </div>
              <nav className="space-y-1">
                {SECTIONS.map((s) => {
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-2 ${
                        isActive
                          ? 'bg-white text-[#FF6600] font-semibold shadow-xs'
                          : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      <span className="text-[#86868B] text-[10px]">{s.num}.</span>
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
                className="scroll-mt-28 p-7 sm:p-8 bg-[#F5F5F7] rounded-2xl border border-[#E5E5EA] transition-all hover:border-[#D2D2D7]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-white text-[#FF6600] rounded-md border border-[#E5E5EA]">
                    {s.num}
                  </span>
                  <h2 className="font-semibold text-lg text-[#1D1D1F]">
                    {s.title}
                  </h2>
                </div>
                <div className="text-sm text-[#6E6E73] leading-relaxed mt-3">
                  {s.content}
                </div>
              </article>
            ))}

            {/* Quick links to Terms of Service */}
            <div className="p-6 bg-white rounded-2xl border border-[#E5E5EA] flex items-center justify-between gap-4 flex-wrap shadow-xs">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6600]">TERMS</p>
                <p className="text-sm font-semibold text-[#1D1D1F] mt-0.5">Need to check our Terms of Service?</p>
                <p className="text-xs text-[#86868B] mt-0.5">Review user obligations, rules, and store terms.</p>
              </div>
              <a
                href="/terms"
                className="btn-apple text-xs"
              >
                <span>Read Terms</span>
                <ArrowUpRight size={14} className="ml-1" />
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
