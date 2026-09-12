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
        By accessing or using the Vakar Games website (<strong className="text-[#1D1D1F]">vakargames.com</strong>) or any of our games, you agree to be bound by these Terms of Service. If you do not agree, please stop using our services.
      </p>
    ),
  },
  {
    id: 'services',
    num: '02',
    title: 'Our Services',
    content: (
      <p>
        Vakar Games provides a public website to showcase our game catalogue, a development blog, an online shop for games and in-game items, and backend tools that support in-game features such as real-time global chat. Our games are primarily distributed through platforms such as TurboWarp and PC releases.
      </p>
    ),
  },
  {
    id: 'accounts',
    num: '03',
    title: 'Accounts & Purchases',
    content: (
      <p>
        Some features require a free account. You are responsible for keeping your credentials secure. Purchases are processed by Stripe; in-game items are delivered to the player ID you provide at checkout. Except where required by law, purchases of digital items are final and non-refundable once delivered.
      </p>
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
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73]">
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
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73]">
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
      <p>
        All content on this website and in our games (including but not limited to artwork, source code, music, logos, and written content) is the property of Vakar Games and is protected by applicable copyright and intellectual property laws. You may not copy, redistribute, modify, or use our content without explicit written permission from Vakar Games.
      </p>
    ),
  },
  {
    id: 'warranty',
    num: '07',
    title: 'Disclaimer of Warranties',
    content: (
      <p>
        Our website and games are provided <strong className="text-[#1D1D1F]">"as is"</strong> and <strong className="text-[#1D1D1F]">"as available"</strong> without warranties of any kind. We do not guarantee uninterrupted access, freedom from errors, or that our services will meet your specific expectations. We reserve the right to modify, suspend, or discontinue any service at any time without notice.
      </p>
    ),
  },
  {
    id: 'liability',
    num: '08',
    title: 'Limitation of Liability',
    content: (
      <p>
        To the fullest extent permitted by applicable law, Vakar Games shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, our services, even if we have been advised of the possibility of such damages.
      </p>
    ),
  },
  {
    id: 'changes',
    num: '09',
    title: 'Changes to These Terms',
    content: (
      <p>
        We may revise these Terms of Service at any time. When we do, we will update the date at the top of this page. Continued use of our services after any changes constitutes your acceptance of the updated terms.
      </p>
    ),
  },
  {
    id: 'law',
    num: '10',
    title: 'Governing Law',
    content: (
      <p>
        These Terms of Service are governed by and construed in accordance with the laws of <strong className="text-[#1D1D1F]">France</strong>. Any dispute arising out of or related to these terms shall be subject to the exclusive jurisdiction of the courts of France.
      </p>
    ),
  },
  {
    id: 'contact',
    num: '11',
    title: 'Contact',
    content: (
      <>
        <p className="mb-2">If you have questions about these Terms of Service, please reach out to our team:</p>
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
    <div className="bg-white text-[#1D1D1F] min-h-screen flex flex-col">
      <PublicNav />

      {/* Hero Header */}
      <section className="pt-28 pb-12 border-b border-[#E5E5EA]">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-[#FF6600] mb-2">Legal</p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F]">
                Terms of Service
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#6E6E73] max-w-xl">
                Please review the terms and conditions governing your access to and use of Vakar Games services.
              </p>
            </div>

            <div className="px-5 py-3.5 flex items-center gap-3 shrink-0 self-start lg:self-auto bg-[#F5F5F7] rounded-xl border border-[#E5E5EA]">
              <Scales size={22} className="text-[#FF6600]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">Jurisdiction</p>
                <p className="text-[11px] text-[#86868B]">France · European Union</p>
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

            {/* Quick links to Privacy Policy */}
            <div className="p-6 bg-white rounded-2xl border border-[#E5E5EA] flex items-center justify-between gap-4 flex-wrap shadow-xs">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6600]">PRIVACY</p>
                <p className="text-sm font-semibold text-[#1D1D1F] mt-0.5">Looking for our Privacy Policy?</p>
                <p className="text-xs text-[#86868B] mt-0.5">Learn how we process, store, and protect your data.</p>
              </div>
              <a
                href="/privacy"
                className="btn-apple text-xs"
              >
                <span>Read Policy</span>
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

export default TermsOfService;
