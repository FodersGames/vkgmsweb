import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const DEFAULT_SUPPORT_EMAIL = 'support@vakargames.com';

export const SiteFooter = ({ onAbout }) => {
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/settings`)
      .then(r => { if (r.data.support_email) setSupportEmail(r.data.support_email); })
      .catch(() => {});
  }, []);

  return (
  <footer className="bg-[#1D1D1F]">
    <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 pt-16 pb-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-14">
        <div>
          <span
            className="text-base font-black tracking-[0.18em] text-white"
          >
            VAKAR GAMES
          </span>
          <p className="mt-4 text-sm text-[#6E6E73] leading-relaxed">
            Independent game studio.<br />Based in France.
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="inline-block mt-5 text-xs text-[#4ECDC4] hover:text-[#45b8b0] transition-colors"
          >
            {supportEmail}
          </a>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[#3A3A3C] tracking-[0.14em] uppercase mb-5">
            Explore
          </h4>
          <ul className="space-y-3">
            <li>
              {onAbout ? (
                <button
                  onClick={onAbout}
                  className="text-sm text-[#6E6E73] hover:text-white transition-colors"
                >
                  About
                </button>
              ) : (
                <Link to="/" className="text-sm text-[#6E6E73] hover:text-white transition-colors">
                  About
                </Link>
              )}
            </li>
            <li>
              <Link to="/games" className="text-sm text-[#6E6E73] hover:text-white transition-colors">
                Games
              </Link>
            </li>
            <li>
              <Link to="/shop" className="text-sm text-[#6E6E73] hover:text-white transition-colors">
                Shop
              </Link>
            </li>
            <li>
              <Link to="/blog" className="text-sm text-[#6E6E73] hover:text-white transition-colors">
                Blog
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${supportEmail}`}
                className="text-sm text-[#6E6E73] hover:text-white transition-colors"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[#3A3A3C] tracking-[0.14em] uppercase mb-5">
            Legal
          </h4>
          <ul className="space-y-3">
            <li>
              <Link to="/privacy" className="text-sm text-[#6E6E73] hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-sm text-[#6E6E73] hover:text-white transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#3A3A3C] pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-[#3A3A3C]">
          &copy; {new Date().getFullYear()} Vakar Games. All rights reserved.
        </p>
        <p className="text-xs text-[#3A3A3C]">Made with ❤️ in France.</p>
      </div>
    </div>
  </footer>
  );
};
