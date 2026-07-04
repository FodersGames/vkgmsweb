import React, { useEffect } from 'react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';

const Section = ({ title, children }) => (
  <div>
    <h2 className="text-lg font-bold text-[#1C1917] mb-3">{title}</h2>
    <div className="text-sm text-[#78716C] leading-relaxed space-y-3">{children}</div>
  </div>
);

const PrivacyPolicy = () => {
  useEffect(() => { document.title = 'Privacy Policy — Vakar Games'; }, []);

  return (
    <div className="bg-[#F9F7F4] min-h-screen">
      <PublicNav />

      <div className="pt-16">
        <div className="bg-white border-b border-[#E8E3DB] px-6 md:px-10 lg:px-16 pt-16 pb-12">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-[#4ECDC4] tracking-[0.16em] uppercase mb-4">Legal</p>
            <h1
              className="text-5xl sm:text-6xl font-black text-[#1C1917] leading-tight mb-3"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              PRIVACY POLICY
            </h1>
            <p className="text-sm text-[#A8A29E]">Last updated: June 21, 2026</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-14 space-y-10">
          <Section title="1. Who We Are">
            <p>Vakar Games is an independent French video game studio. This Privacy Policy explains how we handle information when you visit <strong className="text-[#1C1917]">vakargames.com</strong>, create an account, make purchases, or use features within our games such as the in-game chat system.</p>
          </Section>

          <Section title="2. What Data We Collect">
            <p>Depending on how you use our services, we may store:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Account information: email address, username, first and last name</li>
              <li>Optional profile picture, if you upload one</li>
              <li>Purchase history linked to your account (product, amount, date)</li>
              <li>In-game chat messages (up to 200 characters each) and your in-game username</li>
              <li>Support ticket contents and replies</li>
            </ul>
            <p>Payment card details are processed directly by Stripe and never touch our servers. See Stripe's privacy policy for details on payment processing.</p>
          </Section>

          <Section title="3. How We Use Your Data">
            <p>Your data is used solely to operate the services: authenticating your account, delivering purchased items, displaying chat messages to other players, answering support requests, and applying loyalty discounts. We do not use your data for advertising or profiling, and we never sell it to third parties.</p>
          </Section>

          <Section title="4. Data Retention">
            <p>Chat messages are subject to automatic rolling deletion: each game project retains at most 100 messages, with the oldest deleted first. Account and purchase data is retained while your account is active. You can request deletion of your account and associated data at any time.</p>
          </Section>

          <Section title="5. Cookies">
            <p>We use a small number of technical cookies and local storage entries required for the site to function, such as keeping you signed in and remembering your cookie consent choice. We do not use third-party tracking or advertising cookies. You can manage your preference through the cookie banner shown on your first visit.</p>
          </Section>

          <Section title="6. Third-Party Services">
            <p>Payments are processed by <strong className="text-[#1C1917]">Stripe</strong>. Stripe may process your payment information according to its own privacy policy. We do not embed third-party advertising, social media trackers, or analytics scripts.</p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>Our games and website are not directed at children under the age of 13. We do not knowingly collect data from children under 13. If you believe a child has submitted data through our services, please contact us and we will remove it promptly.</p>
          </Section>

          <Section title="8. Your Rights (GDPR)">
            <p>If you are located in the European Union, you have the following rights under the General Data Protection Regulation (GDPR):</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>The right to access data we hold about you</li>
              <li>The right to request correction or deletion of your data</li>
              <li>The right to object to processing</li>
              <li>The right to lodge a complaint with your national data protection authority</li>
            </ul>
            <p>To exercise any of these rights, contact us at the address below.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this policy as our services evolve. Any changes will be posted on this page with an updated date. We encourage you to review this page periodically.</p>
          </Section>

          <Section title="10. Contact">
            <p>For any privacy-related questions or data requests, please contact us at:</p>
            <a href="mailto:support@vakargames.com" className="text-[#4ECDC4] hover:underline font-medium">support@vakargames.com</a>
          </Section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default PrivacyPolicy;
