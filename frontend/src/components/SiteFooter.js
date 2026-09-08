import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';
const DEFAULT_SUPPORT_EMAIL = 'support@vakargames.com';

export const SiteFooter = ({ onAbout }) => {
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/settings`)
      .then(r => { if (r.data.support_email) setSupportEmail(r.data.support_email); })
      .catch(() => {});
  }, []);

  return (
    <footer style={{ backgroundColor: '#0A0A0A', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-[1100px] mx-auto px-6 pt-14 pb-10">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-10 pb-10 border-b border-white/[0.07]">
          {/* Brand */}
          <div>
            <Link
              to="/"
              className="font-black text-white tracking-[0.08em] uppercase text-[18px] hover:text-[#4ECDC4] transition-colors block mb-3"
            >
              Vakar Games
            </Link>
            <p className="text-white/35 text-xs leading-relaxed max-w-[22ch]">
              Independent video game studio.<br />Based in France.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-4">Studio</h4>
              <ul className="space-y-2.5">
                <li>
                  {onAbout ? (
                    <button onClick={onAbout} className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-[0.08em] font-medium">About</button>
                  ) : (
                    <Link to="/" className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-[0.08em] font-medium">About</Link>
                  )}
                </li>
                <li><Link to="/blog" className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-[0.08em] font-medium">Blog</Link></li>
                <li><Link to="/careers" className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-[0.08em] font-medium">Careers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-4">Games</h4>
              <ul className="space-y-2.5">
                <li><Link to="/games" className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-[0.08em] font-medium">All Games</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-4">Contact</h4>
              <ul className="space-y-2.5">
                <li><Link to="/contact" className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-[0.08em] font-medium">Support</Link></li>
                <li>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="text-xs text-white/50 hover:text-[#4ECDC4] transition-colors"
                  >
                    {supportEmail}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-[10px] text-white/20 uppercase tracking-[0.1em]">
            © {new Date().getFullYear()} Vakar Games. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="text-[10px] text-white/25 hover:text-white/60 transition-colors uppercase tracking-[0.1em]">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-[10px] text-white/25 hover:text-white/60 transition-colors uppercase tracking-[0.1em]">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
