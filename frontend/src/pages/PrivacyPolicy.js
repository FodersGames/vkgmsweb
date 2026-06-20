import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Section = ({ title, children }) => (
  <div>
    <h2 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>{title}</h2>
    <div className="text-white/60 leading-relaxed space-y-3" style={{ fontFamily: "'Inter', sans-serif" }}>{children}</div>
  </div>
);

const PrivacyPolicy = () => {
  useEffect(() => { document.title = 'Privacy Policy — Vakar Games'; }, []);

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
        <p className="text-xs font-bold tracking-[0.2em] text-[#4ECDC4] uppercase mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>Legal</p>
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>PRIVACY POLICY</h1>
        <p className="text-sm text-white/30 mb-16" style={{ fontFamily: "'Inter', sans-serif" }}>Last updated: June 21, 2026</p>

        <div className="space-y-12">
          <Section title="1. Who We Are">
            <p>Vakar Games is an independent French video game studio. This Privacy Policy explains how we handle information when you visit <strong className="text-white/80">vakargames.com</strong> or use features within our games, such as the in-game chat system.</p>
          </Section>

          <Section title="2. What Data We Collect">
            <p>When you use our in-game chat system, the following data may be stored:</p>
            <ul className="list-disc list-inside space-y-1 text-white/50 mt-2">
              <li>Your in-game username (set by you within the game)</li>
              <li>Your chat messages (up to 200 characters each)</li>
              <li>Your player level (optional — only if the game sends it)</li>
              <li>The timestamp of each message</li>
            </ul>
            <p>We do not require account registration for website visitors. We do not collect your real name, email address, or payment information from players.</p>
          </Section>

          <Section title="3. How We Use Your Data">
            <p>Chat messages are stored solely to display them to other players in the same game. We may review chat content to moderate violations of our community guidelines. We do not use chat data for advertising, profiling, or any purpose beyond what is described here.</p>
          </Section>

          <Section title="4. Data Retention">
            <p>Chat messages are subject to automatic rolling deletion: each game project retains at most 100 messages. When the limit is exceeded, the oldest messages are deleted first. No long-term chat history is kept.</p>
          </Section>

          <Section title="5. Cookies & Analytics">
            <p>This website does not use tracking cookies or third-party analytics services. Technical session cookies may be used for site functionality, but no personal browsing data is collected or sold.</p>
          </Section>

          <Section title="6. Third-Party Services">
            <p>Background images on this site are served via <strong className="text-white/80">Unsplash</strong>. Their CDN may log request data; please refer to Unsplash's privacy policy for details. We do not embed third-party advertising, social media trackers, or analytics scripts.</p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>Our games and website are not directed at children under the age of 13. We do not knowingly collect data from children under 13. If you believe a child has submitted data through our chat system, please contact us and we will remove it promptly.</p>
          </Section>

          <Section title="8. Your Rights (GDPR)">
            <p>If you are located in the European Union, you have the following rights under the General Data Protection Regulation (GDPR):</p>
            <ul className="list-disc list-inside space-y-1 text-white/50 mt-2">
              <li>The right to access data we hold about you</li>
              <li>The right to request correction or deletion of your data</li>
              <li>The right to object to processing</li>
              <li>The right to lodge a complaint with your national data protection authority</li>
            </ul>
            <p>Because chat data is linked only to in-game usernames (not real identities), we may not always be able to identify a specific individual's data. Contact us to discuss your situation.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this policy as our services evolve. Any changes will be posted on this page with an updated date. We encourage you to review this page periodically.</p>
          </Section>

          <Section title="10. Contact">
            <p>For any privacy-related questions or data requests, please contact us at:</p>
            <a href="mailto:vakargames@gmail.com" className="text-[#4ECDC4] hover:text-white transition-colors font-medium">vakargames@gmail.com</a>
          </Section>
        </div>
      </div>

      <footer className="border-t border-white/10 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="text-base font-black tracking-[0.2em] text-white/50 hover:text-white transition-colors" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</Link>
          <div className="flex items-center gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            <Link to="/privacy" className="text-xs text-[#4ECDC4]">Privacy Policy</Link>
            <Link to="/terms" className="text-xs text-white/40 hover:text-white transition-colors">Terms of Service</Link>
          </div>
          <p className="text-xs text-white/20" style={{ fontFamily: "'Inter', sans-serif" }}>&copy; {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
