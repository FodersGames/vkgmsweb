import React, { useEffect } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';

const Section = ({ title, children }) => (
  <div>
    <h2 className="text-lg font-bold text-[#1D1D1F] mb-3">{title}</h2>
    <div className="text-sm text-[#6E6E73] leading-relaxed space-y-3">{children}</div>
  </div>
);

const TermsOfService = () => {
  useEffect(() => { document.title = 'Terms of Service — Vakar Games'; }, []);

  return (
    <div className="bg-[#F5F5F7] min-h-screen">
      <PublicNav />

      <div className="pt-[52px]">
        <div className="bg-white border-b border-[#D2D2D7] px-6 md:px-10 lg:px-16 pt-16 pb-12">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-[#4ECDC4] mb-4">Legal</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.02em] text-[#1D1D1F] mb-3">
              Terms of Service
            </h1>
            <p className="text-sm text-[#A1A1A6]">Last updated: June 21, 2026</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-14 space-y-10">
          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the Vakar Games website (<strong className="text-[#1D1D1F]">vakargames.com</strong>) or any of our games, you agree to be bound by these Terms of Service. If you do not agree, please stop using our services.</p>
          </Section>

          <Section title="2. Our Services">
            <p>Vakar Games provides a public website to showcase our game catalogue, a development blog, an online shop for games and in-game items, and backend tools that support in-game features such as real-time global chat. Our games are primarily distributed through platforms such as TurboWarp.</p>
          </Section>

          <Section title="3. Accounts & Purchases">
            <p>Some features require a free account. You are responsible for keeping your credentials secure. Purchases are processed by Stripe; in-game items are delivered to the player ID you provide at checkout. Except where required by law, purchases of digital items are final and non-refundable once delivered.</p>
          </Section>

          <Section title="4. Chat System">
            <p>Some of our games include a real-time in-game chat. By using the chat system, you agree to the following:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Use an appropriate, non-offensive username</li>
              <li>Not post hateful, discriminatory, threatening, or sexually explicit content</li>
              <li>Understand that messages are visible to all players of the same game in real time</li>
              <li>Accept that messages may be moderated or removed without prior notice</li>
              <li>Acknowledge that banned words are automatically filtered and replaced with asterisks</li>
            </ul>
          </Section>

          <Section title="5. Prohibited Conduct">
            <p>When using any Vakar Games service, you agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Harass, threaten, or intimidate other players</li>
              <li>Impersonate Vakar Games staff or other players</li>
              <li>Spam, advertise third-party services, or distribute malicious links</li>
              <li>Attempt to circumvent rate limits, security measures, or API protections</li>
              <li>Reverse-engineer, scrape, or systematically copy our backend services or content</li>
              <li>Use our services for any unlawful purpose</li>
            </ul>
          </Section>

          <Section title="6. Intellectual Property">
            <p>All content on this website and in our games — including but not limited to artwork, source code, music, logos, and written content — is the property of Vakar Games and is protected by applicable copyright and intellectual property laws. You may not copy, redistribute, modify, or use our content without explicit written permission from Vakar Games.</p>
          </Section>

          <Section title="7. Disclaimer of Warranties">
            <p>Our website and games are provided <strong className="text-[#1D1D1F]">"as is"</strong> and <strong className="text-[#1D1D1F]">"as available"</strong> without warranties of any kind. We do not guarantee uninterrupted access, freedom from errors, or that our services will meet your specific expectations. We reserve the right to modify, suspend, or discontinue any service at any time without notice.</p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>To the fullest extent permitted by applicable law, Vakar Games shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of — or inability to use — our services, even if we have been advised of the possibility of such damages.</p>
          </Section>

          <Section title="9. Changes to These Terms">
            <p>We may revise these Terms of Service at any time. When we do, we will update the date at the top of this page. Continued use of our services after any changes constitutes your acceptance of the updated terms.</p>
          </Section>

          <Section title="10. Governing Law">
            <p>These Terms of Service are governed by and construed in accordance with the laws of <strong className="text-[#1D1D1F]">France</strong>. Any dispute arising out of or related to these terms shall be subject to the exclusive jurisdiction of the courts of France.</p>
          </Section>

          <Section title="11. Contact">
            <p>If you have questions about these Terms of Service, please contact us at:</p>
            <a href="mailto:support@vakargames.com" className="text-[#4ECDC4] hover:underline font-medium">support@vakargames.com</a>
          </Section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default TermsOfService;
