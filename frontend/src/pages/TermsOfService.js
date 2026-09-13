import React, { useEffect, useState } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Scales, EnvelopeSimple, BookOpen, ArrowUpRight } from '@phosphor-icons/react';

const SECTIONS = [
  {
    id: 'acceptance',
    num: '01',
    title: 'Acceptance of Terms',
    content: (
      <p>
        By accessing or using the Vakar Games website (<strong className="text-[#1D1D1F] dark:text-white">vakargames.com</strong>) or any video games, applications, or online services operated by Vakar Games, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must discontinue your use of our website and services immediately.
      </p>
    ),
  },
  {
    id: 'services',
    num: '02',
    title: 'Studio Services & Game Catalogue',
    content: (
      <p>
        Vakar Games is an independent video game studio based in France. Our website provides a showcase of our current and upcoming video games, development updates, blog articles, studio recruitment opportunities, community surveys, and direct player support. Our games are distributed through authorized third-party platforms including Steam, the Google Play Store, the Apple App Store, and verified PC or web versions.
      </p>
    ),
  },
  {
    id: 'distribution',
    num: '03',
    title: 'External Distribution & Purchases',
    content: (
      <>
        <p className="mb-3">
          Vakar Games does not directly sell video games or process payment transactions on this website. All game purchases, license acquisitions, and software downloads are processed through authorized digital distribution storefronts:
        </p>
        <ul className="space-y-2 mb-3">
          {[
            'Valve Corporation (Steam) for desktop titles',
            'Google LLC (Google Play Store) for Android releases',
            'Apple Inc. (App Store) for iOS and macOS releases',
            'Official verified publisher partners and web portals',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6600] mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          Any financial transaction, billing inquiry, refund request, or software licensing is governed exclusively by the terms, refund policies, and user agreements of the applicable third-party platform through which the game was obtained.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    num: '04',
    title: 'User Accounts & Security',
    content: (
      <p>
        Certain features of our website (such as submitting support tickets, participating in community feedback surveys, or personalizing your profile) allow or require creating a user account. You are solely responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account. You agree to notify Vakar Games immediately of any unauthorized access or security breach regarding your account.
      </p>
    ),
  },
  {
    id: 'conduct',
    num: '05',
    title: 'Acceptable Use & Conduct',
    content: (
      <>
        <p className="mb-3">When accessing our website, community tools, or customer support, you agree not to:</p>
        <ul className="space-y-2">
          {[
            'Impersonate any person, entity, or Vakar Games studio team member',
            'Submit fraudulent, abusive, threatening, defamatory, or harassing messages via our support or feedback forms',
            'Attempt to circumvent security measures, API authentication, rate limits, or access controls',
            'Use automated bots, scrapers, crawlers, or extraction scripts to harvest data or disrupt our systems',
            'Distribute malware, viruses, trojans, or malicious links through any of our services',
            'Engage in any activity that interferes with or disrupts the integrity of our backend infrastructure',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[#86868B] dark:text-[#71717a]">
          Vakar Games reserves the right to suspend or terminate accounts that violate these conduct principles without prior notice.
        </p>
      </>
    ),
  },
  {
    id: 'ip',
    num: '06',
    title: 'Intellectual Property Rights',
    content: (
      <p>
        All original content featured on this website and in our video games (including, without limitation, visual artwork, character designs, logos, trademarks, animations, source code, game mechanics, audio, music compositions, written lore, and studio branding) is the exclusive property of Vakar Games and is protected by French, European, and international intellectual property and copyright laws. You may not copy, reproduce, modify, redistribute, reverse-engineer, or create derivative works from our intellectual property without prior written authorization from Vakar Games.
      </p>
    ),
  },
  {
    id: 'warranty',
    num: '07',
    title: 'Disclaimer of Warranties',
    content: (
      <p>
        Our website, community tools, and game services are provided on an <strong className="text-[#1D1D1F] dark:text-white">"as is"</strong> and <strong className="text-[#1D1D1F] dark:text-white">"as available"</strong> basis, without warranties or representations of any kind, whether express, implied, or statutory. Vakar Games makes no guarantee that our services will operate continuously, error-free, or entirely secure from unauthorized interruptions.
      </p>
    ),
  },
  {
    id: 'liability',
    num: '08',
    title: 'Limitation of Liability',
    content: (
      <p>
        To the fullest extent permissible under applicable French and European law, Vakar Games and its directors, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data loss, or service interruption arising out of or related to your access to or inability to use our services.
      </p>
    ),
  },
  {
    id: 'changes',
    num: '09',
    title: 'Modifications to These Terms',
    content: (
      <p>
        We reserve the right to revise or update these Terms of Service at any time to reflect operational, legal, or technical changes. Any revisions will take effect immediately upon posting on this page, indicated by the "Last updated" date. Your continued use of our website and services following any revisions constitutes your acceptance of the updated terms.
      </p>
    ),
  },
  {
    id: 'law',
    num: '10',
    title: 'Governing Law & Jurisdiction',
    content: (
      <p>
        These Terms of Service shall be governed by and construed in accordance with the laws of <strong className="text-[#1D1D1F] dark:text-white">France</strong> and the regulations of the European Union. In the event of any controversy or dispute arising out of or relating to these terms, the competent courts of France shall have exclusive jurisdiction.
      </p>
    ),
  },
  {
    id: 'contact',
    num: '11',
    title: 'Contact & Inquiries',
    content: (
      <>
        <p className="mb-2">If you have any questions or require legal clarification regarding these Terms of Service, please contact our team:</p>
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

const TermsOfService = () => {
  const [activeSection, setActiveSection] = useState('acceptance');

  useEffect(() => {
    document.title = 'Terms of Service | Vakar Games';
  }, []);

  const scrollTo = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="bg-white dark:bg-[#0c0c12] text-[#1D1D1F] dark:text-[#e4e4e7] min-h-screen flex flex-col transition-colors">
      <PublicNav />

      {/* Hero Header */}
      <section className="pt-28 pb-12 border-b border-[#E5E5EA] dark:border-[#20202e] bg-[#FAFAFA] dark:bg-[#0e0e16]">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-[#FF6600] mb-2">Legal & Governance</p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F] dark:text-white">
                Terms of Service
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#6E6E73] dark:text-[#a1a1aa] max-w-xl">
                Please review the terms and conditions governing your access to and use of Vakar Games services and titles.
              </p>
              <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-2">
                Last updated: September 2026
              </p>
            </div>

            <div className="px-5 py-3.5 flex items-center gap-3 shrink-0 self-start lg:self-auto bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
              <Scales size={22} className="text-[#FF6600]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">Jurisdiction</p>
                <p className="text-[11px] text-[#86868B] dark:text-[#71717a]">France · European Union</p>
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
            <div className="sticky top-24 p-5 bg-[#F5F5F7] dark:bg-[#13131c] rounded-2xl border border-[#E5E5EA] dark:border-[#252536]">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#E5E5EA] dark:border-[#252536]">
                <BookOpen size={16} className="text-[#FF6600]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">Table of Contents</span>
              </div>
              <nav className="space-y-1">
                {SECTIONS.map((s) => {
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition-colors flex items-center gap-2 ${
                        isActive
                          ? 'bg-white dark:bg-[#1c1c2b] text-[#FF6600] font-semibold shadow-xs'
                          : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white'
                      }`}
                    >
                      <span className="text-[#86868B] dark:text-[#71717a] text-[10px] font-mono">{s.num}.</span>
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
                className="scroll-mt-28 p-7 sm:p-8 bg-[#F5F5F7] dark:bg-[#13131c] rounded-2xl border border-[#E5E5EA] dark:border-[#252536] transition-all hover:border-[#D2D2D7] dark:hover:border-[#35354a]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-white dark:bg-[#1d1d2b] text-[#FF6600] rounded-lg border border-[#E5E5EA] dark:border-[#2a2a3c]">
                    {s.num}
                  </span>
                  <h2 className="font-semibold text-lg text-[#1D1D1F] dark:text-white">
                    {s.title}
                  </h2>
                </div>
                <div className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed mt-3">
                  {s.content}
                </div>
              </article>
            ))}

            {/* Quick link to Privacy Policy */}
            <div className="p-6 bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#252536] flex items-center justify-between gap-4 flex-wrap shadow-xs">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6600]">DATA PRIVACY</p>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white mt-0.5">Looking for our Privacy Policy?</p>
                <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-0.5">Learn how we process, store, and safeguard your personal information under GDPR.</p>
              </div>
              <a
                href="/privacy"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6600] text-white hover:bg-[#E05A00] transition-colors"
              >
                <span>Read Privacy Policy</span>
                <ArrowUpRight size={14} />
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
