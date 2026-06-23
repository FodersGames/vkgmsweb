import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV_LINK = 'text-xs font-bold tracking-[0.15em] transition-colors uppercase';

export const PublicNav = ({ onAbout }) => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const links = [
    { to: '/games', label: 'Games' },
    { to: '/blog',  label: 'Blog'  },
  ];

  const active = (to) => pathname === to || pathname.startsWith(to + '/');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-xl font-black tracking-[0.2em] text-white hover:text-white/90 transition-colors"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            VAKAR GAMES
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {onAbout && (
              <button
                onClick={() => { onAbout(); setOpen(false); }}
                className={`${NAV_LINK} text-[#8A8A9A] hover:text-white`}
              >
                About
              </button>
            )}
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`${NAV_LINK} ${active(to) ? 'text-white' : 'text-[#8A8A9A] hover:text-white'}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <button
          className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#111118] border-t border-white/5 px-6 py-4 space-y-1">
          {onAbout && (
            <button
              onClick={() => { onAbout(); setOpen(false); }}
              className="block w-full text-left text-sm text-[#8A8A9A] hover:text-white py-2.5 transition-colors"
            >
              About
            </button>
          )}
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`block text-sm py-2.5 transition-colors ${active(to) ? 'text-white font-medium' : 'text-[#8A8A9A] hover:text-white'}`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};
