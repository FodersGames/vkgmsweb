import React, { useEffect } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';

const Section = ({ title, children }) => (
  <div>
    <h2 className="font-display text-lg font-medium text-[#1D1D1F] mb-3">{title}</h2>
    <div className="text-sm text-[#6E6E73] leading-relaxed space-y-3">{children}</div>
  </div>
);

// Draft — flagged to the app's owner as not yet legally reviewed. Modeled on
// the structure/tone of TermsOfService.js so it reads consistently with the
// rest of the site's legal pages once it's been checked over.
const StudioPublisherCharter = () => {
  useEffect(() => { document.title = 'Studio Publisher Charter — Vakar Games'; }, []);

  return (
    <div className="bg-[#F5F5F7] min-h-screen">
      <PublicNav />

      <div className="pt-[52px]">
        <div className="bg-white border-b border-[#D2D2D7] px-6 md:px-10 lg:px-16 pt-16 pb-12">
          <div className="max-w-3xl mx-auto">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-4">// legal — draft</p>
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.02em] text-[#1D1D1F] mb-3">
              Studio Publisher Charter
            </h1>
            <p className="text-sm text-[#A1A1A6]">Last updated: August 7, 2026</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-14 space-y-10">
          <Section title="1. Scope">
            <p>This charter applies to anyone who submits an app built with Vakar Studio to the public Vakar Games Applications catalog. It sits alongside, and does not replace, our general <a href="/terms" className="text-[#4ECDC4] hover:underline">Terms of Service</a>. By submitting an app for review, you agree to both.</p>
          </Section>

          <Section title="2. You own your app, we host and showcase it">
            <p>You retain ownership of the app you build. By submitting it for publication, you grant Vakar Games a non-exclusive license to host, distribute, run, and showcase it (including screenshots, name, and description) inside the Applications catalog and its promotional pages, for as long as it stays published.</p>
          </Section>

          <Section title="3. Content standards">
            <p>An app submitted to the public catalog must not:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Contain illegal, hateful, discriminatory, sexually explicit, or gratuitously violent content</li>
              <li>Impersonate another person, brand, or the Vakar Games team</li>
              <li>Infringe someone else's copyright, trademark, or other intellectual property rights</li>
              <li>Mislead users about what the app does, who made it, or what it costs</li>
              <li>Collect personal data from its users without a clear, honest disclosure of what's collected and why</li>
            </ul>
          </Section>

          <Section title="4. Security & abuse">
            <p>Some Vakar Studio blocks let your app talk to external services. You agree not to use these — or any other part of the app builder — to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Attack, overload, or scan third-party services or the Vakar Games infrastructure itself</li>
              <li>Attempt to access data, sessions, or accounts that don't belong to your app's own users</li>
              <li>Distribute malware, or code designed to damage or gain unauthorized access to a device</li>
              <li>Circumvent the sandboxing or rate limits Vakar Studio applies to network requests</li>
            </ul>
          </Section>

          <Section title="5. Review & moderation">
            <p>Submitting an app sends it for review before it appears in the public catalog. Review confirms the app meets this charter — it isn't a guarantee of quality, availability, or approval, and we may reject or request changes to any submission at our discretion. Once published, an app that's later found to violate this charter may be delisted or suspended, with a reason shown to you, as already described in the app's moderation status.</p>
          </Section>

          <Section title="6. No warranty">
            <p>The Applications catalog and the Vakar Studio build tools are provided "as is." We don't guarantee that publishing will drive installs, revenue, or any particular outcome, and we aren't responsible for how end users use, or are affected by, an app you publish.</p>
          </Section>

          <Section title="7. Changes to this charter">
            <p>We may update this charter as the app builder evolves. Continuing to publish or update apps after a change means you accept the revised charter.</p>
          </Section>

          <Section title="8. Contact">
            <p>Questions about this charter, or about a moderation decision on your app, can be sent to:</p>
            <a href="mailto:support@vakargames.com" className="text-[#4ECDC4] hover:underline font-medium">support@vakargames.com</a>
          </Section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default StudioPublisherCharter;
