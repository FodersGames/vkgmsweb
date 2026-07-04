import React from 'react';
import { Link } from 'react-router-dom';

export const SiteFooter = ({ onAbout }) => (
  <footer className="bg-[#1C1917]">
    <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 pt-16 pb-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-14">
        <div>
          <span
            className="text-base font-black tracking-[0.18em] text-white"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            VAKAR GAMES
          </span>
          <p className="mt-4 text-sm text-[#78716C] leading-relaxed">
            Independent game studio.<br />Based in France.
          </p>
          <a
            href="mailto:support@vakargames.com"
            className="inline-block mt-5 text-xs text-[#4ECDC4] hover:text-[#45b8b0] transition-colors"
          >
            support@vakargames.com
          </a>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[#44403C] tracking-[0.14em] uppercase mb-5">
            Explore
          </h4>
          <ul className="space-y-3">
            <li>
              {onAbout ? (
                <button
                  onClick={onAbout}
                  className="text-sm text-[#78716C] hover:text-white transition-colors"
                >
                  About
                </button>
              ) : (
                <Link to="/" className="text-sm text-[#78716C] hover:text-white transition-colors">
                  About
                </Link>
              )}
            </li>
            <li>
              <Link to="/games" className="text-sm text-[#78716C] hover:text-white transition-colors">
                Games
              </Link>
            </li>
            <li>
              <Link to="/shop" className="text-sm text-[#78716C] hover:text-white transition-colors">
                Shop
              </Link>
            </li>
            <li>
              <Link to="/blog" className="text-sm text-[#78716C] hover:text-white transition-colors">
                Blog
              </Link>
            </li>
            <li>
              <Link to="/careers" className="text-sm text-[#78716C] hover:text-white transition-colors">
                Careers
              </Link>
            </li>
            <li>
              <a
                href="mailto:support@vakargames.com"
                className="text-sm text-[#78716C] hover:text-white transition-colors"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[#44403C] tracking-[0.14em] uppercase mb-5">
            Legal
          </h4>
          <ul className="space-y-3">
            <li>
              <Link to="/privacy" className="text-sm text-[#78716C] hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-sm text-[#78716C] hover:text-white transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#292524] pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-[#44403C]">
          &copy; {new Date().getFullYear()} Vakar Games. All rights reserved.
        </p>
        <p className="text-xs text-[#44403C]">Made with ❤️ in France.</p>
      </div>
    </div>
  </footer>
);
