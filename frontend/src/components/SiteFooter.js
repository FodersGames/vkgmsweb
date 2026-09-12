import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWebsiteSettings } from '../utils/publicCache';

const DEFAULT_SUPPORT_EMAIL = 'support@vakargames.com';

export const SiteFooter = ({ onAbout }) => {
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => {
    getWebsiteSettings()
      .then(data => { if (data.support_email) setSupportEmail(data.support_email); })
      .catch(() => {});
  }, []);

  return (
    <footer style={{ backgroundColor: '#1D1D1F', color: '#86868B' }} className="border-t border-black/10">
      <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-10">
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-white/10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              to="/"
              className="flex items-center gap-2 group mb-3"
            >
              <img
                src="/logo.png"
                alt="Vakar Games"
                className="h-5 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <span className="font-semibold text-white tracking-tight text-[15px]">
                Vakar Games
              </span>
            </Link>
            <p className="text-[#86868B] text-[12px] leading-relaxed max-w-[24ch]">
              Independent video game studio.<br />Forged in Passion.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-[12px] font-semibold text-white mb-3">Studio</h4>
            <ul className="space-y-2 text-[12px]">
              <li>
                {onAbout ? (
                  <button onClick={onAbout} className="text-[#86868B] hover:text-white transition-colors">
                    About
                  </button>
                ) : (
                  <Link to="/" className="text-[#86868B] hover:text-white transition-colors">
                    About
                  </Link>
                )}
              </li>
              <li><Link to="/blog" className="text-[#86868B] hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/careers" className="text-[#86868B] hover:text-white transition-colors">Careers</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[12px] font-semibold text-white mb-3">Games</h4>
            <ul className="space-y-2 text-[12px]">
              <li><Link to="/games" className="text-[#86868B] hover:text-white transition-colors">All Games</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[12px] font-semibold text-white mb-3">Support</h4>
            <ul className="space-y-2 text-[12px]">
              <li><Link to="/contact" className="text-[#86868B] hover:text-white transition-colors">Contact Studio</Link></li>
              <li>
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-[#86868B] hover:text-[#FF6600] transition-colors"
                >
                  {supportEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-[#86868B]">
          <p>
            Copyright © {new Date().getFullYear()} Vakar Games. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
