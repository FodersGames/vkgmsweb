import React from 'react';
import { Link } from 'react-router-dom';

export const SiteFooter = ({ onAbout }) => (
  <footer className="bg-[#0A0A10] border-t border-white/[0.06]">
    <div className="max-w-7xl mx-auto px-6 pt-14 pb-8">

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-12">

        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#4ECDC4] text-base">✦</span>
            <span
              className="text-[15px] font-black tracking-[0.16em] text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              VAKAR GAMES
            </span>
          </div>
          <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
            Independent game studio.<br />Based in France.
          </p>
          <a
            href="mailto:support@vakargames.com"
            className="text-[12px] font-semibold text-[#4ECDC4] hover:text-[#45b8b0] transition-colors uppercase tracking-[0.08em]"
          >
            support@vakargames.com
          </a>
        </div>

        {/* Explore */}
        <div>
          <h4 className="text-[10px] font-bold text-gray-600 tracking-[0.18em] uppercase mb-5">
            Explore
          </h4>
          <ul className="space-y-3">
            <li>
              {onAbout ? (
                <button
                  onClick={onAbout}
                  className="text-[13px] text-gray-500 hover:text-white transition-colors"
                >
                  About
                </button>
              ) : (
                <Link to="/" className="text-[13px] text-gray-500 hover:text-white transition-colors">
                  About
                </Link>
              )}
            </li>
            {[
              { to: '/games', label: 'Games'   },
              { to: '/shop',  label: 'Shop'    },
              { to: '/blog',  label: 'Blog'    },
            ].map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="text-[13px] text-gray-500 hover:text-white transition-colors">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <a href="mailto:support@vakargames.com" className="text-[13px] text-gray-500 hover:text-white transition-colors">
                Contact
              </a>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-[10px] font-bold text-gray-600 tracking-[0.18em] uppercase mb-5">
            Legal
          </h4>
          <ul className="space-y-3">
            <li>
              <Link to="/privacy" className="text-[13px] text-gray-500 hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-[13px] text-gray-500 hover:text-white transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t pt-7 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <p className="text-[11px] text-gray-700">
          &copy; {new Date().getFullYear()} Vakar Games. All rights reserved.
        </p>
        <p className="text-[11px] text-gray-700">Made with intention in France.</p>
      </div>
    </div>
  </footer>
);
