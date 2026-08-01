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

  const linkCls = 'text-xs text-[#6E6E73] hover:text-[#1D1D1F] transition-colors';

  return (
  <footer className="bg-[#F5F5F7]">
    <div className="max-w-[1040px] mx-auto px-6 pt-10 pb-14">
      <div className="pb-6 border-b border-[#D2D2D7] text-xs text-[#6E6E73]">
        Vakar Games — Independent software company, based in France.
      </div>

      <div className="pt-7 grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div>
          <h4 className="text-[12.5px] font-semibold text-[#1D1D1F] mb-3.5">Products</h4>
          <ul className="flex flex-col gap-2.5">
            <li><Link to="/games" className={linkCls}>Games</Link></li>
            <li><Link to="/shop" className={linkCls}>Shop</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[12.5px] font-semibold text-[#1D1D1F] mb-3.5">Company</h4>
          <ul className="flex flex-col gap-2.5">
            <li>
              {onAbout ? (
                <button onClick={onAbout} className={linkCls}>About</button>
              ) : (
                <Link to="/" className={linkCls}>About</Link>
              )}
            </li>
            <li><Link to="/blog" className={linkCls}>Blog</Link></li>
            <li><Link to="/careers" className={linkCls}>Careers</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[12.5px] font-semibold text-[#1D1D1F] mb-3.5">Support</h4>
          <ul className="flex flex-col gap-2.5">
            <li><Link to="/contact" className={linkCls}>Contact</Link></li>
            <li><a href={`mailto:${supportEmail}`} className={linkCls}>{supportEmail}</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[12.5px] font-semibold text-[#1D1D1F] mb-3.5">Legal</h4>
          <ul className="flex flex-col gap-2.5">
            <li><Link to="/privacy" className={linkCls}>Privacy Policy</Link></li>
            <li><Link to="/terms" className={linkCls}>Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      <div className="mt-8 pt-5 border-t border-[#D2D2D7] text-[11.5px] text-[#A1A1A6]">
        © {new Date().getFullYear()} Vakar Games. All rights reserved.
      </div>
    </div>
  </footer>
  );
};
