import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter } from '../components/SiteFooter';

const Section = ({ title, children }) => (
  <div>
    <h2 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>{title}</h2>
    <div className="text-white/60 leading-relaxed space-y-3" style={{ fontFamily: "'Inter', sans-serif" }}>{children}</div>
  </div>
);

const TermsOfService = () => {
  useEffect(() => { document.title = 'Terms of Service — Vakar Games'; }, []);

  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-black tracking-[0.2em] text-white hover:text-white/80 transition-colors" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            VAKAR GAMES
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Inter', sans-serif" }}>
            <ArrowLeft size={15} /> Back to Home
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <p className="text-xs font-bold tracking-[0.2em] text-[#9B51E0] uppercase mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>Legal</p>
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TERMS OF SERVICE</h1>
        <p className="text-sm text-white/30 mb-16" style={{ fontFamily: "'Inter', sans-serif" }}>Last updated: June 21, 2026</p>

        <div className="space-y-12">
          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the Vakar Games website (<strong className="text-white/80">vakargames.com</strong>) or any of our games, you agree to be bound by these Terms of Service. If you do not agree, please stop using our services.</p>
          </Section>

          <Section title="2. Our Services">
            <p>Vakar Games provides a public website to showcase our game catalogue, a development blog, and backend tools that support in-game features such as real-time global chat. Our games are primarily distributed through platforms such as TurboWarp.</p>
          </Section>

          <Section title="3. Chat System">
            <p>Some of our games include a real-time in-game chat. By using the chat system, you agree to the following:</p>
            <ul className="list-disc list-inside space-y-1 text-white/50 mt-2">
              <li>Use an appropriate, non-offensive username</li>
              <li>Not post hateful, discriminatory, threatening, or sexually explicit content</li>
              <li>Understand that messages are visible to all players of the same game in real time</li>
              <li>Accept that messages may be moderated or removed without prior notice</li>
              <li>Acknowledge that banned words are automatically filtered and replaced with asterisks</li>
            </ul>
          </Section>

          <Section title="4. Prohibited Conduct">
            <p>When using any Vakar Games service, you agree not to:</p>
            <ul className="list-disc list-inside space-y-1 text-white/50 mt-2">
              <li>Harass, threaten, or intimidate other players</li>
              <li>Impersonate Vakar Games staff or other players</li>
              <li>Spam, advertise third-party services, or distribute malicious links</li>
              <li>Attempt to circumvent rate limits, security measures, or API protections</li>
              <li>Reverse-engineer, scrape, or systematically copy our backend services or content</li>
              <li>Use our services for any unlawful purpose</li>
            </ul>
          </Section>

          <Section title="5. Intellectual Property">
            <p>All content on this website and in our games — including but not limited to artwork, source code, music, logos, and written content — is the property of Vakar Games and is protected by applicable copyright and intellectual property laws. You may not copy, redistribute, modify, or use our content without explicit written permission from Vakar Games.</p>
          </Section>

          <Section title="6. Disclaimer of Warranties">
            <p>Our website and games are provided <strong className="text-white/80">"as is"</strong> and <strong className="text-white/80">"as available"</strong> without warranties of any kind. We do not guarantee uninterrupted access, freedom from errors, or that our services will meet your specific expectations. We reserve the right to modify, suspend, or discontinue any service at any time without notice.</p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>To the fullest extent permitted by applicable law, Vakar Games shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of — or inability to use — our services, even if we have been advised of the possibility of such damages.</p>
          </Section>

          <Section title="8. Changes to These Terms">
            <p>We may revise these Terms of Service at any time. When we do, we will update the date at the top of this page. Continued use of our services after any changes constitutes your acceptance of the updated terms.</p>
          </Section>

          <Section title="9. Governing Law">
            <p>These Terms of Service are governed by and construed in accordance with the laws of <strong className="text-white/80">France</strong>. Any dispute arising out of or related to these terms shall be subject to the exclusive jurisdiction of the courts of France.</p>
          </Section>

          <Section title="10. Contact">
            <p>If you have questions about these Terms of Service, please contact us at:</p>
            <a href="mailto:support@vakargames.com" className="text-[#9B51E0] hover:text-white transition-colors font-medium">support@vakargames.com</a>
          </Section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default TermsOfService;
