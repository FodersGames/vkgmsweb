import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Scales, EnvelopeSimple, BookOpen, ArrowUpRight } from '@phosphor-icons/react';

const Em = ({ children }) => (
  <strong className="text-[#1D1D1F] dark:text-white font-semibold">{children}</strong>
);

const Ext = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#1D1D1F] dark:text-white font-medium underline underline-offset-2 decoration-[#1D1D1F]/30 dark:decoration-white/30 hover:decoration-[#1D1D1F] dark:hover:decoration-white transition-colors"
  >
    {children}
  </a>
);

const Sub = ({ children }) => (
  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white mt-5 mb-2 first:mt-0">
    {children}
  </h3>
);

const Bullets = ({ items, warning = false }) => (
  <ul className="space-y-2 my-3">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5 text-sm text-[#6E6E73] dark:text-[#a1a1aa]">
        <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${warning ? 'bg-red-400' : 'bg-[#1D1D1F] dark:bg-white'}`} />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const Callout = ({ title, children }) => (
  <div className="mt-4 p-4 rounded-xl bg-white dark:bg-[#181824] border border-[#E5E5EA] dark:border-[#2a2a3c] border-l-2 border-l-[#1D1D1F] dark:border-l-white text-xs text-[#6E6E73] dark:text-[#a1a1aa] space-y-1.5">
    {title && <p className="font-semibold text-[#1D1D1F] dark:text-white">{title}</p>}
    {children}
  </div>
);

const SECTIONS = [
  {
    id: 'about',
    num: '01',
    title: 'About These Terms & Publisher',
    content: (
      <>
        <p>
          <Em>Vakar Games</Em> is an independent video game studio established in France (“Vakar Games”, “we”, “us”, or “our”). These Terms of Service (“Terms”) govern your access to and use of <Em>vakargames.com</Em>, your Vakar Games account, our support and community pages, and our mobile game <Em>Dino Clicker: Evolution</Em> distributed on Google Play (together, the “Services”).
        </p>
        <p className="mt-3">
          By creating an account, downloading, installing, accessing, or using the Services, you agree to these Terms. If you do not agree, you must not use the Services.
        </p>
        <p className="mt-3">
          These Terms are written in English. A French translation can be provided on request at <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext>. Where mandatory French consumer law requires a French version, we will provide one and the French version will prevail.
        </p>
        <Callout title="Publisher">
          <p>Vakar Games — independent video game studio — France</p>
          <p>
            Contact: <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext>
          </p>
          <p>For legal notices, please use the subject “Legal notice”.</p>
        </Callout>
      </>
    ),
  },
  {
    id: 'eligibility',
    num: '02',
    title: 'Eligibility & Minors',
    content: (
      <>
        <p>
          Website accounts are intended for users aged <Em>15 or older</Em>, the age of digital consent in France. If you are under 15, you may only create an account or use account features with the consent and supervision of a parent or legal guardian.
        </p>
        <p className="mt-3">
          <Em>Dino Clicker: Evolution</Em> is designed for a general audience, including families, but it is not specifically directed at children under 15 for the purposes of data protection law. If a child under 15 plays the game, a parent or guardian must consent to the processing of the child’s game data and to any in-app purchase, and should supervise the child’s use of the game.
        </p>
        <p className="mt-3">
          By using the Services, you represent that you have the legal capacity to enter into these Terms, or that a parent or guardian has consented on your behalf. We may ask for reasonable proof of age or parental consent and may suspend account features until it is provided. Parents and guardians can use Android and Google Play parental controls to restrict purchases and limit ad personalisation.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    num: '03',
    title: 'Website Accounts & Security',
    content: (
      <>
        <p>
          Some website features, such as support tickets, surveys, recruitment applications, and profile customisation, require an account. You agree to provide accurate information, keep it up to date, and use only one account per person unless we authorise otherwise.
        </p>
        <p className="mt-3">
          You are responsible for keeping your credentials confidential and for all activity carried out through your account. Do not share, sell, rent, or transfer your account. If you suspect unauthorised access, change your password and contact us immediately at <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext>.
        </p>
        <p className="mt-3">
          We may suspend or terminate an account if you materially breach these Terms, engage in fraud or illegal activity, compromise the security of the Services, or repeatedly violate the rights of other users. Where practicable, we will explain the reason and give you an opportunity to respond.
        </p>
      </>
    ),
  },
  {
    id: 'game-licence',
    num: '04',
    title: 'Dino Clicker: Evolution — Licence & Game Account',
    content: (
      <>
        <p>
          Subject to these Terms, we grant you a <Em>personal, non-exclusive, non-transferable, revocable, limited licence</Em> to install and use <Em>Dino Clicker: Evolution</Em> for your own non-commercial entertainment. You do not acquire ownership of the game, its content, or your game account.
        </p>

        <Sub>How the game account works</Sub>
        <p>
          The game creates a PlayFab game account automatically. On first launch, it uses your device’s unique identifier (the Android device ID) or, if that is unavailable, a random identifier. This identifier is stored locally and sent to PlayFab. You may optionally connect a Google Play Games account to link your progress and display name. You do not need a Vakar Games website account or an email address to play.
        </p>
        <p className="mt-3">
          Your progress is saved locally and in the PlayFab cloud. Cloud saves are provided as a convenience, not as a guaranteed backup service. If you change device, reinstall the game, or clear your data, your progress may be recoverable only if it was successfully synced to PlayFab and, where applicable, linked to Google Play Games.
        </p>

        <Sub>Licence conditions</Sub>
        <Bullets
          items={[
            'Do not copy, reproduce, distribute, sell, rent, lease, sublicense, or commercially exploit the game or any part of it.',
            'Do not reverse engineer, decompile, disassemble, modify, or create derivative works from the game, except where such restriction is prohibited by mandatory law.',
            'Do not use cheats, bots, automation, macros, unauthorised third-party tools, or exploits to gain an unfair advantage or bypass the game’s intended progression.',
            'Do not bypass, disable, or manipulate purchases, advertisements, rewards, parental controls, regional restrictions, or security measures.',
            'Do not use unauthorised servers, private servers, or modified clients to access the game or its data.',
            'Do not scrape, data-mine, or extract data from the game or its services except as expressly permitted by law.',
            'Do not buy, sell, trade, or transfer game accounts, virtual items, or currencies outside the game.',
          ]}
        />
        <p className="mt-3">
          We may use anti-cheat, fraud-prevention, and moderation tools. If we detect a breach, we may remove illegitimate items, reset progress, suspend features, or ban the account. You may appeal a ban by contacting support with your PlayFab ID and the reason shown in the game.
        </p>
        <p className="mt-3">
          Updates may be mandatory. The game requires an internet connection for account creation, cloud saves, purchases, ads, and some features. Older versions may stop working after an update.
        </p>
      </>
    ),
  },
  {
    id: 'virtual-items',
    num: '05',
    title: 'Virtual Currency, Items & Purchases',
    content: (
      <>
        <p>
          The game may include virtual currency (such as gems and DNA), dinosaurs, eggs, chests, items, boosts, a season pass, a no-ads option, and other digital content (together, “Virtual Items”). Virtual Items are a <Em>limited licence to use digital content within the game</Em>. They are not money, property, or a financial asset.
        </p>
        <Bullets
          items={[
            'Virtual Items have no cash value and cannot be exchanged for real money, goods, or services.',
            'Virtual Items are non-transferable and may not be sold, traded, gifted, or exchanged outside the game unless we expressly allow it.',
            'Virtual Items are tied to your game account and may be lost if the account is deleted, banned, or inaccessible.',
            'We may adjust, rebalance, replace, or remove Virtual Items for maintenance, game balance, technical, or legal reasons. Where the law requires it, we will provide appropriate notice or remedy.',
          ]}
        />

        <Sub>Real-money purchases</Sub>
        <p>
          Purchases are processed by <Em>Google Play Billing</Em>. Google displays the price, currency, and applicable taxes, and processes your payment. We do not receive or store your payment card number, bank details, or full billing address. We receive a purchase confirmation, the product identifier, and the entitlement needed to deliver the Virtual Item or perk.
        </p>
        <p className="mt-3">
          Your purchase is also subject to Google Play’s terms and refund policy. You can use the “Restore purchases” option in the game where available. If a purchase fails, is interrupted, or does not deliver the item, contact us with your PlayFab ID, product name, date, and Google Play order number so we can investigate.
        </p>

        <Sub>Right of withdrawal</Sub>
        <p>
          If you are a consumer in the European Union, you normally have 14 days to withdraw from a distance contract. For digital content supplied immediately, this right does not apply where you have given your express consent to immediate performance and acknowledged that you lose your right of withdrawal. Where the purchase flow asks you to confirm it, by purchasing Virtual Items and requesting immediate delivery, you expressly consent to immediate performance and acknowledge the loss of your withdrawal right to the extent permitted by law. This does not affect any mandatory rights you have, or Google Play’s own refund policy.
        </p>

        <Sub>Prices and errors</Sub>
        <p>
          We may change prices, offers, and availability at any time. Price changes do not affect purchases that have already been completed. If a price or product is displayed incorrectly, we may cancel the affected order and refund the amount paid, where permitted by law. We are not obliged to honour an obvious pricing error.
        </p>
      </>
    ),
  },
  {
    id: 'advertising',
    num: '06',
    title: 'Advertising',
    content: (
      <>
        <p>
          The game may offer optional rewarded video ads through <Em>Unity Ads</Em>. Watching an ad is voluntary and is usually rewarded with an in-game benefit. If you purchase the no-ads option, rewarded ads are skipped where the game supports it.
        </p>
        <p className="mt-3">
          Ads may be personalised based on your advertising ID, device information, and approximate location derived from your IP address, where permitted by law and your device settings. You can limit ad personalisation or reset your advertising ID in your Android or Google settings. Our <Link to="/privacy" className="text-[#1D1D1F] dark:text-white font-medium underline underline-offset-2 decoration-[#1D1D1F]/30 dark:decoration-white/30 hover:decoration-[#1D1D1F] dark:hover:decoration-white transition-colors">Privacy Policy</Link> explains the data processed by Unity Ads.
        </p>
        <p className="mt-3">
          Ad content is provided by third parties. We do not control or endorse every advertisement, but we choose our advertising partners carefully. If you see an ad that is illegal, misleading, or inappropriate, please report it to us with a screenshot and the approximate date and time.
        </p>
        <p className="mt-3">
          Ad availability is not guaranteed. If an ad fails to load or is interrupted, we may not be able to grant the reward. We do not compensate for missed rewards caused by network or ad-provider failures, except where required by law.
        </p>
      </>
    ),
  },
  {
    id: 'conduct',
    num: '07',
    title: 'Acceptable Use',
    content: (
      <>
        <p>
          When using the Services, you must not:
        </p>
        <Bullets
          warning
          items={[
            'Break any law or encourage others to do so.',
            'Post or transmit content that is illegal, fraudulent, hateful, discriminatory, harassing, threatening, defamatory, obscene, or sexualises minors.',
            'Impersonate another person, a Vakar Games team member, or a platform representative.',
            'Publish another person’s private information without their consent, including doxxing or sharing home addresses, phone numbers, or private messages.',
            'Send spam, chain messages, scams, phishing attempts, malware, viruses, or malicious links.',
            'Attempt to gain unauthorised access to accounts, servers, databases, APIs, or other users’ data.',
            'Use bots, scrapers, crawlers, automated scripts, or denial-of-service techniques to access or disrupt the Services.',
            'Cheat, exploit bugs, manipulate game data, or use unauthorised tools to obtain Virtual Items or advantages.',
            'Circumvent purchases, ads, parental controls, age gates, regional restrictions, or security measures.',
            'Use the Services for commercial purposes, including account boosting, item selling, or advertising, without our written permission.',
            'Violate the terms of Google Play or any other platform used to access the Services.',
          ]}
        />
        <p className="mt-3">
          We may remove content, restrict features, suspend, or terminate accounts that violate these rules. Serious violations may be reported to the relevant authorities or platform providers. We may also preserve and disclose data where required by law or necessary to protect our rights, users, or the public.
        </p>
      </>
    ),
  },
  {
    id: 'user-content',
    num: '08',
    title: 'User Content & Display Names',
    content: (
      <>
        <p>
          You may be able to choose a display name, avatar dinosaur, profile frame, submit survey answers, send support messages, or provide feedback (“User Content”). You retain ownership of your User Content.
        </p>
        <p className="mt-3">
          To operate the Services, you grant Vakar Games a worldwide, non-exclusive, royalty-free licence, for the duration of your use of the Services, to host, store, reproduce, display, moderate, and use your User Content as necessary to provide, secure, and improve the Services. This licence may be sublicensed to our service providers acting on our behalf. It does not transfer your moral rights.
        </p>
        <p className="mt-3">
          You represent that you have the rights needed to submit your User Content and that it does not infringe anyone else’s rights or violate the law. Do not use your real name, email address, phone number, or sensitive information as your display name or avatar.
        </p>
        <p className="mt-3">
          Display names, avatars, profile frames, and some progress or leaderboard information may be visible to other players. We may remove or modify User Content that violates these Terms or the law, and we may suspend or terminate repeat infringers. We are not obliged to monitor all User Content.
        </p>
        <p className="mt-3">
          If you send us suggestions or feedback, you allow us to use them without compensation or attribution. This does not give us ownership of your pre-existing intellectual property.
        </p>
      </>
    ),
  },
  {
    id: 'ip',
    num: '09',
    title: 'Intellectual Property',
    content: (
      <>
        <p>
          The Services, including the game, website, our proprietary source code, visual artwork, dinosaur designs, characters, logos, trademarks, animations, music, sound effects, text, user interface, and game mechanics, are owned by Vakar Games or its licensors and are protected by French, European, and international intellectual property laws.
        </p>
        <p className="mt-3">
          These Terms grant you only the limited licence described above. You may not use our trademarks, logos, or branding in a way that suggests endorsement, partnership, or official status without our prior written permission.
        </p>

        <Sub>Fan content</Sub>
        <p>
          You may create and share non-commercial videos, streams, screenshots, and fan art of the game, provided that you clearly credit Vakar Games and do not imply that your content is official. You may not sell merchandise bearing our trademarks or artwork without a licence. We may ask you to remove content that is harmful, misleading, or infringing.
        </p>

        <Sub>Reporting infringement</Sub>
        <p>
          If you believe that content on our Services infringes your intellectual property, contact us at <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext> with the subject “IP notice”. Please include your contact details, a description of the protected work, the location of the allegedly infringing content, and a statement that you have a good-faith belief that the use is unauthorised.
        </p>
      </>
    ),
  },
  {
    id: 'third-parties',
    num: '10',
    title: 'Third-Party Platforms & Services',
    content: (
      <>
        <p>
          The Services rely on third-party platforms and services, including:
        </p>
        <Bullets
          items={[
            'Google Play and Google Play Games, for distribution, updates, billing, optional sign-in, and platform services.',
            'PlayFab / Microsoft, for game accounts, cloud saves, entitlements, moderation data, and technical logs.',
            'Unity Ads, for rewarded advertising and ad measurement.',
            'Cloudflare and World Time API, for connectivity and time-verification requests.',
            'Discord, for our external community server if you choose to join it.',
            'Your device manufacturer and operating system, for hardware, software, and app-store services.',
          ]}
        />
        <p className="mt-3">
          These third parties have their own terms and privacy policies. We do not control their services and are not responsible for their content, availability, or data practices. Your purchases, refunds, and account issues with Google Play are governed by Google’s terms and policies, without prejudice to your statutory rights.
        </p>
        <p className="mt-3">
          If a third-party service is unavailable or changes its rules, some features of the game may stop working. We will try to restore them or provide a reasonable alternative, but we do not guarantee that third-party services will remain available.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    num: '11',
    title: 'Availability, Updates & Termination',
    content: (
      <>
        <Sub>Availability</Sub>
        <p>
          The Services are online services. We may perform maintenance, deploy updates, change features, or temporarily suspend access. We aim to give reasonable notice of planned maintenance, but urgent security or technical work may require immediate action. We do not guarantee uninterrupted, error-free, or permanently available access.
        </p>
        <p className="mt-3">
          We may change, update, or discontinue features of the game or website. If we permanently discontinue a paid service, we will consider appropriate remedies where required by law. Virtual Items are subject to the rules in section 05.
        </p>

        <Sub>Termination by you</Sub>
        <p>
          You may stop using the Services at any time. To delete your website account or request deletion of your game data, contact <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext>. Deletion may result in the permanent loss of your progress and Virtual Items. Some data may be retained where required by law, as explained in our Privacy Policy.
        </p>

        <Sub>Termination by us</Sub>
        <p>
          We may suspend or terminate your access if you materially breach these Terms, engage in fraud, cheating, harassment, illegal activity, or behaviour that threatens the security or integrity of the Services. Where practicable, we will notify you and give you an opportunity to appeal. If we terminate without cause, we will consider a refund for unused paid Virtual Items where required by law.
        </p>
        <p className="mt-3">
          Sections that by their nature should survive termination will continue to apply, including intellectual property, liability, and governing-law provisions. We are not liable for events beyond our reasonable control, such as natural disasters, network failures, platform outages, or government action.
        </p>
      </>
    ),
  },
  {
    id: 'warranty',
    num: '12',
    title: 'Warranties & Liability',
    content: (
      <>
        <Sub>Our commitment</Sub>
        <p>
          We provide the Services with reasonable skill and care. If you are a consumer in France or the European Union, you benefit from the legal guarantee of conformity (Articles L217-3 and following of the French Consumer Code) and the guarantee against hidden defects (Article 1641 of the French Civil Code), under the conditions provided by law.
        </p>
        <p className="mt-3">
          Except for those mandatory guarantees, the Services are provided “as is” and “as available”. We do not guarantee that the game will always be uninterrupted, error-free, compatible with every device, or free from loss of data. Beta, experimental, or preview features may be changed or withdrawn.
        </p>

        <Sub>Limitation of liability</Sub>
        <p>
          To the fullest extent permitted by law, Vakar Games is not liable for indirect or consequential losses, including loss of profits, loss of business, loss of goodwill, or business interruption. We are liable for direct and foreseeable damage caused by our breach of these Terms or our negligence.
        </p>
        <p className="mt-3">
          Nothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence, fraud or intentional misconduct, gross negligence, or any other liability that cannot be excluded or limited under mandatory law. Nothing in these Terms limits your statutory consumer rights.
        </p>
        <p className="mt-3">
          You are responsible for keeping your device, accounts, and credentials secure. Cloud saves are a convenience, not a guaranteed backup. To the extent permitted by law, we are not liable for loss of progress caused by clearing your device, changing device without linking an account, or a platform outage.
        </p>
      </>
    ),
  },
  {
    id: 'consumer-rights',
    num: '13',
    title: 'Consumer Rights, Withdrawal & Mediation',
    content: (
      <>
        <p>
          If you are a consumer, you benefit from mandatory protections under French and European consumer law. Nothing in these Terms is intended to waive or limit those protections.
        </p>

        <Sub>Withdrawal right</Sub>
        <p>
          Subject to the digital-content exception described in section 05, you normally have 14 days from the conclusion of a distance contract to withdraw without giving a reason. To exercise your right, contact us at <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext> with your order details. If you have already received and used digital content after expressly consenting to immediate performance and acknowledging the loss of your withdrawal right, the right no longer applies to that content.
        </p>

        <Sub>Complaints</Sub>
        <p>
          If you have a problem, please contact us first at <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext>. Include your account or PlayFab ID, a description of the issue, the date, and any order number. We will try to resolve the matter within a reasonable time, generally within 30 days.
        </p>

        <Sub>Consumer mediation</Sub>
        <p>
          Vakar Games has not yet designated a consumer mediator within the meaning of Article L612-1 of the French Consumer Code. Until the mediator’s details are published in this section, you may:
        </p>
        <Bullets
          items={[
            <>contact the <Ext href="https://www.europe-consommateurs.eu">Centre Européen des Consommateurs France</Ext> for cross-border consumer disputes;</>,
            'contact a recognised consumer association; or',
            'bring the matter before the competent court.',
          ]}
        />
        <p className="mt-3">
          Once a mediator is designated, we will publish the mediator’s name, postal address, and website here, and you will be able to refer the dispute free of charge after first contacting us.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    num: '14',
    title: 'Changes, Governing Law & Contact',
    content: (
      <>
        <Sub>Changes to these Terms</Sub>
        <p>
          We may update these Terms to reflect changes in our services, technology, or the law. The new version will be published on this page with a new “Last updated” date. If a change materially affects your rights or obligations, we will give reasonable notice, for example through a website or in-game notice. For new users, the updated Terms apply immediately. For existing users, the updated Terms take effect at the end of the notice period, unless you accept them earlier. If you do not agree, you must stop using the Services.
        </p>

        <Sub>Governing law and jurisdiction</Sub>
        <p>
          These Terms are governed by French law, without prejudice to the mandatory consumer protections of your country of habitual residence and applicable European Union law. If you are a consumer, you may bring proceedings before the courts of your place of residence or the competent French courts. If you are acting for a business, the competent courts in France have exclusive jurisdiction, subject to any mandatory rule to the contrary.
        </p>

        <Sub>General</Sub>
        <p>
          If any provision of these Terms is found invalid or unenforceable, the remaining provisions will continue to apply. Our failure to enforce a provision is not a waiver of our right to do so later. You may not assign or transfer your rights under these Terms without our written consent. We may assign our rights in connection with a merger, acquisition, or transfer of the studio. These Terms, together with our Privacy Policy and any additional terms shown in the game or on a platform, are the entire agreement between you and Vakar Games regarding the Services.
        </p>

        <Sub>Contact</Sub>
        <p>
          Questions, complaints, or legal notices: <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext> — subject “Legal notice”. You can also use the support form on our website.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
          <a
            href="mailto:support@vakargames.com"
            className="inline-flex items-center gap-1.5 text-[#1D1D1F] dark:text-white hover:underline font-medium text-sm"
          >
            <EnvelopeSimple size={16} />
            support@vakargames.com
          </a>
          <span className="hidden sm:inline text-[#86868B]">·</span>
          <span className="text-xs text-[#86868B] dark:text-[#71717a]">
            Vakar Games Studio · France, European Union
          </span>
        </div>
        <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-3">
          Last updated: 24 November 2026 · Version 2.0
        </p>
      </>
    ),
  },
];

const TermsOfService = () => {
  const [activeSection, setActiveSection] = useState('about');

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
              <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-white mb-2">Legal & Governance</p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F] dark:text-white">
                Terms of Service
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#6E6E73] dark:text-[#a1a1aa] max-w-xl">
                The rules that apply to vakargames.com, your account, and Dino Clicker: Evolution, including purchases and virtual items.
              </p>
              <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-2">
                Last updated: 24 November 2026 · Version 2.0
              </p>
            </div>

            <div className="px-5 py-3.5 flex items-center gap-3 shrink-0 self-start lg:self-auto bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
              <Scales size={22} className="text-[#1D1D1F] dark:text-white" />
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
                <BookOpen size={16} className="text-[#1D1D1F] dark:text-white" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">Table of Contents</span>
              </div>
              <nav className="space-y-1 max-h-[calc(100vh-13rem)] overflow-y-auto pr-1">
                {SECTIONS.map((s) => {
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition-colors flex items-center gap-2 ${
                        isActive
                          ? 'bg-white dark:bg-[#1c1c2b] text-[#1D1D1F] dark:text-white font-semibold shadow-xs'
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
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-white dark:bg-[#1d1d2b] text-[#1D1D1F] dark:text-white rounded-lg border border-[#E5E5EA] dark:border-[#2a2a3c]">
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
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">DATA PRIVACY</p>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white mt-0.5">Looking for our Privacy Policy?</p>
                <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-0.5">Learn what we collect on the website and in Dino Clicker: Evolution, and how to exercise your GDPR rights.</p>
              </div>
              <Link
                to="/privacy"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1D1D1F] text-white hover:bg-[#333336] dark:bg-white dark:text-[#1D1D1F] dark:hover:bg-[#E5E5EA] transition-colors"
              >
                <span>Read Privacy Policy</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default TermsOfService;
