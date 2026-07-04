import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SupportWidget } from './SupportWidget';

export const PublicNav = ({ onAbout }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { to: '/games', label: 'Games' },
    { to: '/shop',  label: 'Shop'  },
    { to: '/blog',  label: 'Blog'  },
  ];

  const active = (to) => pathname === to || pathname.startsWith(to + '/');

  return (
    <>
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-sm border-b border-[#E8E3DB]' : 'border-b border-[#F0EDE8]'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link
            to="/"
            className="text-lg font-black tracking-[0.18em] text-[#1C1917] hover:text-[#2D2926] transition-colors"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            VAKAR GAMES
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {onAbout && (
              <button
                onClick={() => { onAbout(); setOpen(false); }}
                className="text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
              >
                About
              </button>
            )}
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition-colors ${
                  active(to) ? 'text-[#1C1917]' : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            to="/contact"
            className="text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
          >
            Contact
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/play"
                className={`text-sm font-medium transition-colors ${
                  active('/play') ? 'text-[#1C1917]' : 'text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                Play
              </Link>
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-[#1C1917] border border-[#E8E3DB] hover:border-[#C9C3BB] rounded px-2.5 py-1.5 transition-all"
                >
                  <LayoutDashboard size={12} />
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4]">
                  {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || <User size={12} />}
                </div>
                <span>{user.firstName || user.username}</span>
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold text-[#1C1917] hover:text-[#4ECDC4] transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>

        <button
          className="md:hidden p-2 -mr-1 text-[#78716C] hover:text-[#1C1917] transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-[#E8E3DB] px-6 py-3 space-y-0.5">
          {onAbout && (
            <button
              onClick={() => { onAbout(); setOpen(false); }}
              className="block w-full text-left text-sm text-[#78716C] hover:text-[#1C1917] py-2.5 transition-colors"
            >
              About
            </button>
          )}
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`block text-sm py-2.5 transition-colors ${
                active(to) ? 'text-[#1C1917] font-semibold' : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="block text-sm text-[#78716C] hover:text-[#1C1917] py-2.5 transition-colors"
          >
            Contact
          </Link>

          {user ? (
            <>
              <Link
                to="/play"
                onClick={() => setOpen(false)}
                className={`block text-sm py-2.5 transition-colors ${active('/play') ? 'text-[#1C1917] font-semibold' : 'text-[#78716C] hover:text-[#1C1917]'}`}
              >
                Play
              </Link>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="block text-sm text-[#78716C] hover:text-[#1C1917] py-2.5 font-medium transition-colors"
              >
                My Account ({user.firstName || user.username})
              </Link>
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block text-sm text-[#78716C] hover:text-[#1C1917] py-2.5 transition-colors"
                >
                  Admin Dashboard
                </Link>
              )}
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block text-sm font-semibold text-[#1C1917] py-2.5 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
    <SupportWidget user={user} />
    </>
  );
};
