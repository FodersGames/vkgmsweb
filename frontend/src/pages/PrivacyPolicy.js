import React, { useEffect, useState } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { LockKey, EnvelopeSimple, BookOpen, ArrowUpRight, ShieldCheck } from '@phosphor-icons/react';

const SECTIONS = [
  {
    id: 'who',
    num: '01',
    title: 'Who We Are & Scope',
    content: (
      <p>
        Vakar Games is an independent French video game development studio. We are committed to safeguarding the privacy and personal data of our players, website visitors, and community members in strict accordance with European data protection legislation, notably Regulation (EU) 2016/679 (General Data Protection Regulation or <strong className="text-[#1D1D1F] dark:text-white">GDPR</strong>) and the French Data Protection Act (Loi Informatique et Libertés). This Privacy Policy explains our practices regarding the collection, storage, and processing of your personal information when you visit <strong className="text-[#1D1D1F] dark:text-white">vakargames.com</strong>, interact with our community tools, or access our services.
      </p>
    ),
  },
  {
    id: 'data',
    num: '02',
    title: 'Personal Data We Collect',
    content: (
      <>
        <p className="mb-3">
          We adhere strictly to the principle of data minimization. We only collect personal information that is genuinely necessary to provide you with our services:
        </p>
        <ul className="space-y-2 mb-4">
          {[
            'Account Information: email address, username/pseudo, optional display name, and securely hashed passwords (using industry-standard cryptographic algorithms)',
            'Technical & Security Timestamps: account registration date, last login timestamp, and security audit logs for administrative actions',
            'Player Support Records: support ticket subject, description, category, and staff correspondence history to troubleshoot and resolve issues',
            'Community Feedback & Surveys: voluntary responses and gameplay ratings submitted through our public community surveys',
            'Career Applications: resume/CV, contact information, portfolio links, and cover messages submitted if you apply for an open studio position',
            'Essential Preferences: local storage tokens for active user authentication and interface appearance settings (dark mode / light mode)',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6600] mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="p-3.5 rounded-xl bg-[#F5F5F7] dark:bg-[#181824] border-l-2 border-[#FF6600] text-xs text-[#6E6E73] dark:text-[#a1a1aa] space-y-1">
          <p className="font-semibold text-[#1D1D1F] dark:text-white">What we never collect or store:</p>
          <p>
            • Payment card numbers or bank information (game downloads and transactions are handled entirely by verified third-party stores such as Steam, Google Play, or the Apple App Store).
          </p>
          <p>
            • In-game chat logs or unencrypted voice/text communication.
          </p>
          <p>
            • Invasive third-party advertising tracking profiles or cross-site browsing histories.
          </p>
        </div>
      </>
    ),
  },
  {
    id: 'usage',
    num: '03',
    title: 'How We Use Your Data & Legal Basis',
    content: (
      <>
        <p className="mb-3">
          Under the GDPR, every processing activity must rely on a recognized legal basis:
        </p>
        <ul className="space-y-2 mb-3">
          <li className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
            <strong className="text-[#1D1D1F] dark:text-white font-semibold">Contractual Necessity:</strong> Authenticating your user account, securing your session, and delivering customer support services you request.
          </li>
          <li className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
            <strong className="text-[#1D1D1F] dark:text-white font-semibold">Legitimate Interests:</strong> Protecting the security and integrity of our systems, preventing fraudulent account creation, monitoring service reliability, and evaluating gameplay feedback from voluntary surveys.
          </li>
          <li className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
            <strong className="text-[#1D1D1F] dark:text-white font-semibold">Consent:</strong> Where applicable, processing voluntary job applications or optional participation in specific community research.
          </li>
        </ul>
        <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
          We never sell, rent, or trade your personal data to commercial data brokers or marketing intermediaries.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    num: '04',
    title: 'Data Retention & Account Erasure',
    content: (
      <p>
        We retain your personal account data only for as long as your account remains active. Support ticket conversations are retained for historical reference and dispute resolution. Survey responses are stored in aggregate or anonymized form. You possess the right to delete your account and request complete erasure of your associated personal data at any time either directly via your profile tools or by contacting our support desk.
      </p>
    ),
  },
  {
    id: 'cookies',
    num: '05',
    title: 'Cookies & Local Storage',
    content: (
      <p>
        Our website uses only strictly necessary technical cookies and browser local storage entries. These are indispensable for user session authentication (storing your secure JSON Web Token), protecting against cross-site request forgery, and remembering your interface preference (such as dark/light display mode). We do not employ third-party tracking pixels, advertising cookies, or behavioral profiling trackers.
      </p>
    ),
  },
  {
    id: 'third-party',
    num: '06',
    title: 'Third-Party Platforms & Cloud Infrastructure',
    content: (
      <>
        <p className="mb-3">
          To provide high-quality games and secure online services, we rely on trusted technology partners operating under strict confidentiality and security standards:
        </p>
        <ul className="space-y-2 mb-3">
          <li className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
            <strong className="text-[#1D1D1F] dark:text-white font-semibold">Digital Storefronts (Steam, Google Play, Apple App Store):</strong> When acquiring our games through these platforms, transactions and software downloads are subject to their respective privacy policies and data collection frameworks.
          </li>
          <li className="text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
            <strong className="text-[#1D1D1F] dark:text-white font-semibold">Cloud & Server Infrastructure:</strong> Our web API, secure database, and file delivery are hosted in certified European data centers that comply with European privacy directives and industry security benchmarks.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'children',
    num: '07',
    title: "Children's Privacy Protection",
    content: (
      <p>
        Vakar Games takes the safety of young players seriously. Our website accounts and community tools are not intended for children under the age of 13 (or the applicable digital consent age established in your European member state, typically 15 or 16, without verified parental or legal guardian consent). We do not knowingly harvest personal information from children. If you believe a minor has registered an account without appropriate authorization, please contact us immediately and we will promptly erase the account and all associated records.
      </p>
    ),
  },
  {
    id: 'gdpr',
    num: '08',
    title: 'Your Rights Under GDPR (European Union)',
    content: (
      <>
        <p className="mb-3">
          Under the General Data Protection Regulation (GDPR), users located in the European Economic Area benefit from comprehensive legal rights regarding their personal data:
        </p>
        <ul className="space-y-2 mb-4">
          {[
            'Right of Access: You may request a complete copy of all personal data held about you in an easily readable format.',
            'Right to Rectification: You may correct or update any inaccurate or incomplete details in your account settings.',
            'Right to Erasure ("Right to be Forgotten"): You may request the permanent deletion of your account and related records.',
            'Right to Data Portability: You may receive your personal data in a structured, commonly used, and machine-readable format (JSON export).',
            'Right to Restrict or Object to Processing: You may oppose specific processing activities or request temporary restriction.',
            'Right to Lodge a Complaint: You have the right to lodge a formal complaint with a competent supervisory authority, such as the CNIL in France (Commission Nationale de l’Informatique et des Libertés - cnil.fr).',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D1D1F] dark:bg-white mt-2 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#86868B] dark:text-[#71717a]">
          To exercise any of these rights or request a full data export, simply contact our support team at <strong className="text-[#FF6600]">support@vakargames.com</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    num: '09',
    title: 'Modifications to This Privacy Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time to reflect evolving studio operations, technical improvements, or regulatory updates. Any changes will be published directly on this page along with an updated revision date. We encourage players to review this page periodically to remain informed about how we safeguard personal data.
      </p>
    ),
  },
  {
    id: 'contact',
    num: '10',
    title: 'Contact Us & Data Protection Office',
    content: (
      <>
        <p className="mb-2">
          If you have questions, feedback, or concerns regarding this Privacy Policy, or if you wish to exercise your data rights, please reach out to our team:
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
          <a
            href="mailto:support@vakargames.com"
            className="inline-flex items-center gap-1.5 text-[#FF6600] hover:underline font-medium text-sm"
          >
            <EnvelopeSimple size={16} />
            support@vakargames.com
          </a>
          <span className="hidden sm:inline text-[#86868B]">·</span>
          <span className="text-xs text-[#86868B] dark:text-[#71717a]">
            Vakar Games Studio · France, European Union
          </span>
        </div>
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
    <div className="bg-white dark:bg-[#0c0c12] text-[#1D1D1F] dark:text-[#e4e4e7] min-h-screen flex flex-col transition-colors">
      <PublicNav />

      {/* Hero Header */}
      <section className="pt-28 pb-12 border-b border-[#E5E5EA] dark:border-[#20202e] bg-[#FAFAFA] dark:bg-[#0e0e16]">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-[#FF6600] mb-2">GDPR & Protection</p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F] dark:text-white">
                Privacy Policy
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#6E6E73] dark:text-[#a1a1aa] max-w-xl">
                Discover how Vakar Games respects, collects, and secures your personal information in compliance with European standards.
              </p>
              <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-2">
                Last updated: September 2026
              </p>
            </div>

            <div className="px-5 py-3.5 flex items-center gap-3 shrink-0 self-start lg:self-auto bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
              <ShieldCheck size={24} className="text-[#FF6600]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">GDPR Compliant</p>
                <p className="text-[11px] text-[#86868B] dark:text-[#71717a]">Regulation (EU) 2016/679</p>
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

            {/* Quick link to Terms */}
            <div className="p-6 bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#252536] flex items-center justify-between gap-4 flex-wrap shadow-xs">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6600]">LEGAL TERMS</p>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white mt-0.5">Looking for our Terms of Service?</p>
                <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-0.5">Read the conditions governing user accounts and game access.</p>
              </div>
              <a
                href="/terms"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6600] text-white hover:bg-[#E05A00] transition-colors"
              >
                <span>Read Terms of Service</span>
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

export default PrivacyPolicy;
