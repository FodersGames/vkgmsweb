import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { EnvelopeSimple, BookOpen, ArrowUpRight, ShieldCheck } from '@phosphor-icons/react';

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

const Rows = ({ rows }) => (
  <div className="mt-3 divide-y divide-[#E5E5EA] dark:divide-[#252536] rounded-xl border border-[#E5E5EA] dark:border-[#252536] overflow-hidden">
    {rows.map(([label, value]) => (
      <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 px-4 py-3 bg-white dark:bg-[#181824]">
        <p className="text-xs font-semibold text-[#1D1D1F] dark:text-white">{label}</p>
        <p className="sm:col-span-2 text-xs text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed">{value}</p>
      </div>
    ))}
  </div>
);

const SECTIONS = [
  {
    id: 'who',
    num: '01',
    title: 'Who We Are & Scope',
    content: (
      <>
        <p>
          <Em>Vakar Games</Em> is an independent video game studio established in France. We act as the <Em>data controller</Em> for the personal data described in this Privacy Policy.
        </p>
        <p className="mt-3">
          This policy applies to <Em>vakargames.com</Em>, the Vakar Games account and support area, our community surveys and recruitment pages, and our mobile game <Em>Dino Clicker: Evolution</Em> distributed on Google Play (together, the “Services”).
        </p>
        <p className="mt-3">
          It does not apply to third-party platforms such as Google Play, Discord, or the services of our technology providers. Those services have their own privacy policies, which we encourage you to read.
        </p>
        <Callout title="Privacy contact">
          <p>Vakar Games — France</p>
          <p>
            Email: <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext> — please use the subject “Privacy request”.
          </p>
          <p>We have not appointed a separate Data Protection Officer. Privacy requests are handled directly by the studio team.</p>
        </Callout>
      </>
    ),
  },
  {
    id: 'website-data',
    num: '02',
    title: 'Data We Collect on the Website',
    content: (
      <>
        <p>
          We keep website data minimal. You can browse the public pages without creating an account. We collect the following categories when you choose to use account, support, survey, or recruitment features:
        </p>
        <Rows
          rows={[
            ['Account & profile', 'Email address, password hash (never the password itself), display name, first and last name where provided, username/pseudo, avatar image, account role and permissions, account status, registration date, last login date, and name/username change cooldown dates.'],
            ['Support tickets', 'Ticket number, subject, category, message and reply history, your email address, username, ticket status, priority, and any job posting linked to a recruitment ticket.'],
            ['Job applications', 'Name, email address, portfolio or social links, cover letter, and the position applied for. Applications are submitted through our support ticket system.'],
            ['Community surveys', 'Your answers to survey questions, an optional username, your account ID if you are signed in, a truncated SHA-256 hash of your IP address used only to detect duplicate or abusive submissions, and the submission date. Surveys that allow anonymous responses do not require an account.'],
            ['Security & audit logs', 'Login and registration events, profile changes, support actions, administrative actions, usernames/emails involved, and timestamps. These logs help us detect abuse and investigate incidents.'],
            ['Technical connection data', 'IP address, browser and device type, requested page, timestamp, HTTP status, and similar metadata processed by our hosting and security providers when you access the website.'],
            ['Browser storage', 'Your session token, theme preference, cookie-choice record, banner dismissal, dashboard layout preferences, and, for staff accounts, recent-player shortcuts. See section 06 for details.'],
          ]}
        />
        <Callout title="What we do not collect on the website">
          <p>• Payment card or bank details. Website payments, if any, are handled by the relevant store or payment provider.</p>
          <p>• Passwords in clear text. Passwords are stored only as bcrypt hashes.</p>
          <p>• Your contacts, photo library, precise GPS location, biometric data, or health data.</p>
          <p>• Private chat messages. The website does not provide a chat feature.</p>
          <p>• Google Analytics, advertising pixels, or cross-site behavioural profiles. We do not run these on the website.</p>
        </Callout>
      </>
    ),
  },
  {
    id: 'game-data',
    num: '03',
    title: 'Dino Clicker: Evolution — What We Collect',
    content: (
      <>
        <p>
          <Em>Dino Clicker: Evolution</Em> is designed to be playable without a Vakar Games website account and without giving us your name or email address. The game uses <Em>PlayFab</Em> (a Microsoft service) to create a game account and store your progress in the cloud.
        </p>

        <Sub>Game account and identifiers</Sub>
        <Bullets
          items={[
            'A PlayFab ID generated by PlayFab when your game account is created.',
            'A custom account identifier. On first launch, the game uses your device’s unique identifier (the Android device ID) or, if that is unavailable, a random identifier. It is stored on your device and sent to PlayFab so the game can recognise your account.',
            'If you choose to connect Google Play Games: your Google Play Games player ID, your Google Play Games display name, and a server authentication code used to link that account to your PlayFab account. We never receive your Google password.',
            'The display name/pseudo you choose in the game, your selected avatar dinosaur, and your profile frame.',
            'App version, language, platform, IP address, connection timestamps, and technical logs processed by PlayFab and Google to operate the service and prevent abuse.',
          ]}
        />

        <Sub>Game progress and cloud saves</Sub>
        <p>
          Your game save is stored in PlayFab so you can recover your progress after reinstalling the game or changing device. It can include:
        </p>
        <Bullets
          items={[
            'DNA, gems, rebirth level, rebirth points, and rebirth count.',
            'Owned and equipped dinosaurs, dinosaur levels, and collection progress.',
            'Inventory items, eggs, chests, buildings, quests, claimed milestones, daily-login progress, expeditions, season-pass progress, and lucky-wheel state.',
            'Save version, save timestamp, last cloud sync date, and technical state needed to restore your progress.',
            'Purchase entitlements and perks, such as the no-ads pass, laboratory speed bonus, auto-clicker, bonus slots, and permanent DNA multiplier, together with the relevant product IDs. We do not receive your card or bank details.',
            'Moderation data, such as a ban status and ban reason, and support gifts or messages sent to your account by our team.',
          ]}
        />

        <Sub>Local data on your device</Sub>
        <Bullets
          items={[
            'Game progress and settings stored locally by Unity PlayerPrefs: music and sound volume, FPS preference, language, tutorial state, purchase flags, reward and ad cooldown flags, notification permission, the custom account identifier, and a local ban flag if applicable.',
            'Local notifications (for example, expedition or laboratory reminders) are scheduled on your device. They are not sent from our servers.',
            'The game does not access your contacts, photos, camera, microphone, precise GPS location, or health data.',
          ]}
        />

        <Sub>Visibility to other players</Sub>
        <p>
          Your display name, avatar dinosaur, profile frame, and weekly tournament trophy count may be visible to other players on leaderboards and in online features. Support gifts and messages are intended to be private to your account. The game does not provide in-game chat, private messaging, friends lists, or access to your contacts. Please do not use your real name, email address, or sensitive information as your display name.
        </p>

        <Callout title="Dino Clicker: Evolution — data at a glance">
          <Rows
            rows={[
              ['Identity', 'PlayFab ID, device ID or random custom identifier, optional Google Play Games player ID and display name, chosen in-game display name, avatar, and profile frame.'],
              ['Progress', 'DNA, gems, rebirth data, dinosaurs, inventory, buildings, quests, daily login, expeditions, season pass, lucky wheel, save timestamps, and cloud-save data.'],
              ['Purchases', 'Product IDs, purchase confirmation, entitlements and perks, and purchase status. No card or bank details.'],
              ['Advertising', 'Advertising ID, IP address, device and operating-system information, language, and ad interaction data collected by Unity Ads.'],
              ['Moderation', 'Ban status and reason, support gifts and messages, and related timestamps.'],
              ['Technical', 'IP address, device model and OS, app version, language, connection timestamps, and technical logs.'],
            ]}
          />
        </Callout>

        <p className="mt-3">
          If you contact us about the game, we also process your email address and the content of your message so we can answer you and, where relevant, locate your game account.
        </p>
      </>
    ),
  },
  {
    id: 'purchases-ads',
    num: '04',
    title: 'Purchases, Advertising & Platform Data',
    content: (
      <>
        <Sub>In-app purchases</Sub>
        <p>
          Purchases in <Em>Dino Clicker: Evolution</Em> are processed by <Em>Google Play Billing</Em> through the Unity IAP system. Google processes your payment and billing information. We receive a purchase confirmation, the product identifier, and the entitlement needed to unlock the item or perk in your game save. We do not receive or store your payment card number, bank account, or full billing address.
        </p>
        <p className="mt-3">
          Purchase and entitlement records may be kept for accounting, tax, fraud-prevention, and customer-support purposes. Refund requests are handled by Google Play under its own refund policy, without prejudice to your statutory rights.
        </p>

        <Sub>Rewarded advertising</Sub>
        <p>
          The game may offer optional rewarded video ads through <Em>Unity Ads</Em> (Unity Technologies). Watching an ad is voluntary and is usually rewarded with an in-game benefit. If you purchase the no-ads option, rewarded ads are skipped where the game supports it.
        </p>
        <p className="mt-3">
          Unity Ads may collect or receive your advertising ID, IP address, device model and operating system, language, approximate location derived from your IP address, ad impressions, clicks, completion status, and fraud-prevention signals. This data is used to deliver and measure ads, limit repetition, prevent fraud, and comply with legal obligations. We do not receive your name or email address from Unity Ads.
        </p>
        <p className="mt-3">
          We only use personalised advertising where permitted by law and, where required, with your consent. You can limit ad personalisation or reset your advertising ID in your Android or Google settings. Withdrawing consent does not affect ads that are strictly necessary to deliver the game or to prevent fraud.
        </p>

        <Sub>Platform and technical services</Sub>
        <Bullets
          items={[
            'Google Play and Google Play Games: distribution, updates, billing, optional sign-in, and platform diagnostics. The game also contacts a Google connectivity-check endpoint to detect whether you are online.',
            'PlayFab / Microsoft: game accounts, cloud saves, entitlements, moderation data, and technical logs.',
            'Unity Ads: rewarded advertising and ad measurement.',
            'Cloudflare: a connectivity and time-verification request used by the game. Cloudflare receives your IP address and basic request information.',
            'World Time API: a fallback time-verification request used by the game. It receives your IP address and basic request information.',
            'Discord: an external community link. If you join our server, Discord processes your account data under its own policy.',
          ]}
        />
        <p className="mt-3">
          The game does not include a dedicated third-party crash-reporting or analytics SDK. Google Play, PlayFab, and the technical services above may still process technical logs and diagnostics as part of their normal operation.
        </p>
      </>
    ),
  },
  {
    id: 'purposes',
    num: '05',
    title: 'Why We Process Data & Legal Bases',
    content: (
      <>
        <p>
          Under the GDPR, each processing activity must have a legal basis. We rely on the following bases:
        </p>
        <Rows
          rows={[
            ['Contract', 'Creating and managing your website account, providing support tickets, operating the game, storing your cloud save, delivering purchases and entitlements, and answering your requests.'],
            ['Legitimate interests', 'Protecting the security and integrity of our services, preventing fraud and cheating, moderating abusive behaviour, keeping audit logs, improving features using aggregated or anonymised data, processing job applications and community survey responses where consent is not required, and defending legal claims.'],
            ['Consent', 'Personalised advertising where the law requires consent, and any optional survey, recruitment, or communication processing for which we specifically ask for your consent. You may withdraw consent at any time.'],
            ['Legal obligation', 'Keeping accounting, tax, and purchase records, responding to lawful requests from authorities, and meeting consumer-protection or security obligations.'],
          ]}
        />
        <p className="mt-3">
          We do not sell your personal data or rent it to data brokers, and we do not share website data for cross-context behavioural advertising. In the game, Unity Ads may process data for advertising as described in section 04. We do not make automated decisions that produce legal effects concerning you. Anti-cheat signals may be automated, but material account bans are reviewed by our team.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    num: '06',
    title: 'Cookies, Local Storage & Similar Technologies',
    content: (
      <>
        <p>
          The website uses browser <Em>local storage</Em> rather than cookies. These entries are strictly necessary for the site to work or to remember your choices:
        </p>
        <Bullets
          items={[
            'Authentication: a JSON Web Token stored under the key “token”, used to keep you signed in. It expires after 24 hours and is removed when you sign out.',
            'Cookie choice: a record of your cookie-banner choice so we do not ask again.',
            'Appearance and navigation: your light/dark theme, dismissed announcement banner, dashboard layout preferences, and, for staff accounts, recent-player shortcuts.',
          ]}
        />
        <p className="mt-3">
          We do not use Google Analytics, advertising cookies, tracking pixels, or behavioural profiling on the website. Because the website only uses strictly necessary storage, no consent is required for it. If we introduce optional analytics or advertising cookies in the future, we will ask for your consent first and update this policy.
        </p>
        <p className="mt-3">
          The website loads its typefaces from Google Fonts. This sends your IP address and basic browser information to Google when the page loads, but Google Fonts does not set cookies for this request. You can block third-party font requests in your browser if you prefer.
        </p>
        <p className="mt-3">
          In the game, local data is stored through Unity PlayerPrefs on your device. Google Play, Google Play Games, PlayFab, and Unity Ads may use their own identifiers or SDK storage as described in their privacy policies. You can clear local storage in your browser settings or clear the game’s data in Android settings; this may sign you out or reset local preferences.
        </p>
      </>
    ),
  },
  {
    id: 'recipients',
    num: '07',
    title: 'Who Receives Your Data',
    content: (
      <>
        <p>
          We share personal data only with service providers that help us operate the Services, and only as needed. They act under contracts that require appropriate confidentiality and security.
        </p>
        <Rows
          rows={[
            ['Microsoft / PlayFab', 'Game accounts, cloud saves, entitlements, moderation data, and technical logs.'],
            ['Google LLC', 'Google Play distribution, Google Play Games sign-in, billing, Android platform services, related diagnostics, the game’s connectivity check, and Google Fonts used to display the website.'],
            ['Unity Technologies', 'Rewarded advertising, ad measurement, and fraud prevention through Unity Ads.'],
            ['Cloudflare, Inc.', 'Connectivity and time-verification requests from the game.'],
            ['World Time API', 'Fallback time-verification requests from the game.'],
            ['Vercel Inc.', 'Hosting and operation of the website API and serverless functions.'],
            ['GitHub, Inc.', 'Hosting of the public website through GitHub Pages.'],
            ['MongoDB, Inc. (including MongoDB Atlas where used)', 'Database hosting for website accounts, support tickets, surveys, and related records.'],
            ['Email and support providers', 'Receiving, storing, and answering your emails, support requests, and legal notices.'],
            ['Discord Inc.', 'Only if you choose to open our community link or join our server.'],
            ['Professional advisers and authorities', 'Where necessary to comply with the law, respond to a court order, protect our rights, or investigate fraud or security incidents.'],
          ]}
        />
        <p className="mt-3">
          We do not sell personal data. We may disclose data if we are required by law, if we believe disclosure is necessary to protect the safety of a player or the public, or in connection with a merger, acquisition, or transfer of the studio, subject to appropriate safeguards.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    num: '08',
    title: 'International Transfers',
    content: (
      <>
        <p>
          Some of our providers are located in the United States or process data globally. Where personal data from the European Economic Area is transferred outside the EEA, we rely on appropriate safeguards, such as:
        </p>
        <Bullets
          items={[
            'an adequacy decision of the European Commission, including the EU-US Data Privacy Framework where the recipient is certified;',
            'Standard Contractual Clauses approved by the European Commission; and',
            'additional technical and organisational measures where needed.',
          ]}
        />
        <p className="mt-3">
          You can ask us for more information about the safeguards used for a specific transfer by contacting us at support@vakargames.com.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    num: '09',
    title: 'How Long We Keep Data',
    content: (
      <>
        <p>
          We keep personal data only for as long as necessary for the purposes described above, unless a longer period is required by law. Our usual retention periods are:
        </p>
        <Rows
          rows={[
            ['Website account', 'While your account is active, then up to 30 days after a verified deletion request so we can complete the deletion across systems. Backup copies, where they exist, are kept for up to 30 additional days.'],
            ['Security and audit logs', 'Up to 12 months, unless needed to investigate a specific incident or legal claim.'],
            ['Support tickets', 'Up to 3 years after the last exchange, for historical reference, dispute resolution, and fraud prevention.'],
            ['Job applications', 'Up to 2 years after the last contact, unless you consent to a longer retention period or a legal claim requires it.'],
            ['Survey responses', 'Up to 3 years after submission, then deleted or anonymised.'],
            ['Game cloud save', 'While your game account is active, then up to 30 days after a verified deletion request. Backup copies, where they exist, are kept for up to 30 additional days.'],
            ['Purchase and accounting records', 'Up to 10 years where required by French accounting and tax law.'],
            ['Moderation and ban records', 'Up to 3 years after the sanction or the last relevant incident, to prevent repeat abuse.'],
            ['Technical and connection logs', 'Up to 12 months, unless needed for security, fraud prevention, or legal proceedings.'],
            ['Advertising data', 'Retained according to Unity Ads’ own retention settings. Please see Unity’s privacy policy for details.'],
          ]}
        />
        <p className="mt-3">
          When a retention period ends, we delete the data or anonymise it so that it can no longer identify you. If a legal claim, investigation, or regulatory obligation requires it, we may keep relevant data for longer.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    num: '10',
    title: 'How We Protect Your Data',
    content: (
      <>
        <p>
          We use technical and organisational measures appropriate to the risk, including:
        </p>
        <Bullets
          items={[
            'HTTPS/TLS encryption for data in transit between your browser or game and our providers.',
            'Bcrypt password hashing and short-lived JSON Web Tokens for website authentication.',
            'Role-based access control, least-privilege accounts, rate limiting, input validation, and security headers on the API.',
            'Restricted database access, audit logs, and regular review of administrative permissions.',
            'Encryption at rest and access controls provided by our hosting, database, and game-backend providers.',
          ]}
        />
        <p className="mt-3">
          No system is completely secure. If you discover a vulnerability, please report it to <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext> with the subject “Security”. Please do not access, modify, or disclose other people’s data while investigating. We never ask for your password by email.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    num: '11',
    title: 'Children & Minors',
    content: (
      <>
        <p>
          Website accounts are intended for users aged <Em>15 or older</Em>, which is the age of digital consent in France. If you are under 15, you may only create an account or use account features with the consent and supervision of a parent or legal guardian.
        </p>
        <p className="mt-3">
          <Em>Dino Clicker: Evolution</Em> is designed for a general audience, including families, but it is not specifically directed at children under 15 for the purposes of data protection law. If a child under 15 plays the game, a parent or guardian must consent to the processing of the child’s game data and to any in-app purchase, and should supervise the child’s use of the game.
        </p>
        <p className="mt-3">
          We do not knowingly collect personal data from children under 15 without appropriate parental consent. If you believe that a child under 15 has created an account, linked a Google Play Games profile, or made a purchase without consent, please contact us at support@vakargames.com. We will investigate and delete the relevant data where appropriate. For purchase refunds, please also contact Google Play.
        </p>
        <p className="mt-3">
          Parents and guardians can use Android and Google Play parental controls to restrict purchases and limit ad personalisation on the device.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    num: '12',
    title: 'Your GDPR Rights',
    content: (
      <>
        <p>
          If you are in the European Economic Area, the United Kingdom, or another jurisdiction with similar laws, you have the following rights:
        </p>
        <Bullets
          items={[
            'Right of access: obtain a copy of the personal data we hold about you and information about how it is processed.',
            'Right to rectification: correct inaccurate or incomplete data.',
            'Right to erasure: request deletion of your account, game data, or other personal data, subject to legal retention obligations.',
            'Right to restriction: ask us to limit processing while a request or dispute is being resolved.',
            'Right to object: object to processing based on our legitimate interests, including profiling related to those interests.',
            'Right to data portability: receive data you provided to us in a structured, commonly used, machine-readable format, where technically feasible.',
            'Right to withdraw consent: withdraw consent at any time where processing is based on consent, without affecting processing carried out before the withdrawal.',
            'Right to give instructions about your data after death: under French law, you may give us instructions about the retention, deletion, and communication of your data after your death.',
            'Right to lodge a complaint: complain to a supervisory authority, in particular the CNIL in France.',
          ]}
        />
        <p className="mt-3">
          To exercise a right, email <Ext href="mailto:support@vakargames.com">support@vakargames.com</Ext> with the subject “Privacy request”. Please tell us which right you are exercising and enough information for us to locate your account. We may ask for proof of identity to protect your data. We will respond within one month; if the request is complex, we may extend this by up to two months and will tell you why.
        </p>
        <p className="mt-3">
          Requests are free of charge unless they are manifestly unfounded or excessive. If you ask us to delete your account, we will delete or anonymise the data that is no longer needed. Some data may be retained where the law requires it, for example accounting records or data needed to defend a legal claim.
        </p>
        <Callout title="CNIL — French supervisory authority">
          <p>Commission Nationale de l’Informatique et des Libertés (CNIL)</p>
          <p>3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, France</p>
          <p>
            Website: <Ext href="https://www.cnil.fr">www.cnil.fr</Ext>
          </p>
          <p>If you live in another EU country, you may also complain to your local data protection authority.</p>
        </Callout>
      </>
    ),
  },
  {
    id: 'changes',
    num: '13',
    title: 'Changes & Contact',
    content: (
      <>
        <p>
          We may update this Privacy Policy to reflect changes in our services, technology, or the law. The new version will be published on this page with a new “Last updated” date. If a change materially affects your rights, we will provide reasonable notice, for example through a website or in-game notice, and where required by law we will ask for your consent.
        </p>
        <p className="mt-3">
          If you have questions, concerns, or requests about this policy or your personal data, contact us:
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
          This policy is provided in English. A French translation can be provided on request.
        </p>
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
              <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-white mb-2">GDPR & Protection</p>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F] dark:text-white">
                Privacy Policy
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#6E6E73] dark:text-[#a1a1aa] max-w-xl">
                What Vakar Games collects on vakargames.com and in Dino Clicker: Evolution, why we collect it, and how you can exercise your rights.
              </p>
              <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-2">
                Last updated: 24 November 2026 · Version 2.0
              </p>
            </div>

            <div className="px-5 py-3.5 flex items-center gap-3 shrink-0 self-start lg:self-auto bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
              <ShieldCheck size={24} className="text-[#1D1D1F] dark:text-white" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">GDPR Rights</p>
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

            {/* Quick link to Terms */}
            <div className="p-6 bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#252536] flex items-center justify-between gap-4 flex-wrap shadow-xs">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F] dark:text-white">LEGAL TERMS</p>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white mt-0.5">Looking for our Terms of Service?</p>
                <p className="text-xs text-[#86868B] dark:text-[#71717a] mt-0.5">Read the conditions governing user accounts, game access, and purchases.</p>
              </div>
              <Link
                to="/terms"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1D1D1F] text-white hover:bg-[#333336] dark:bg-white dark:text-[#1D1D1F] dark:hover:bg-[#E5E5EA] transition-colors"
              >
                <span>Read Terms of Service</span>
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

export default PrivacyPolicy;
