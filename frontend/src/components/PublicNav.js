import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Gamepad2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SupportWidget } from './SupportWidget';

export const PublicNav = ({ onAbout }) => {
  const [open,    setOpen]    = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { to: '/games', label: 'Games' },
    { to: '/shop',  label: 'Shop'  },
    { to: '/blog',  label: 'Blog'  },
  ];

  const active = (to) => pathname === to || pathname.startsWith(to + '/');

  const navBase = 'fixed top-0 left-0 right-0 z-50 transition-all duration-300';
  const navBg   = scrolled
    ? 'bg-white/90 backdrop-blur-md border-b border-black/[0.06] shadow-[0_1px_16px_rgba(0,0,0,0.06)]'
    : 'bg-transparent';

  return (
    <>
      <nav className={`${navBase} ${navBg}`}>
        <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center justify-between gap-8">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <span className="text-[#4ECDC4] text-lg leading-none select-none">✦</span>
            <span className="text-[15px] font-black tracking-[0.12em] text-[#0A0A10] group-hover:text-[#4ECDC4] transition-colors"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.16em' }}>
              VAKAR GAMES
            </span>
          </Link>

          {/* Center links */}
          <div className="hidden md:flex items-center gap-7 flex-1 justify-center">
            {onAbout && (
              <button
                onClick={() => { onAbout(); setOpen(false); }}
                className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 hover:text-[#0A0A10] transition-colors"
              >
                About
              </button>
            )}
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  active(to) ? 'text-[#0A0A10]' : 'text-gray-500 hover:text-[#0A0A10]'
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/contact"
              className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 hover:text-[#0A0A10] transition-colors"
            >
              Contact
            </Link>
          </div>

          {/* Right */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {user ? (
              <>
                {isAdmin && isAdmin() && (
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 hover:text-[#0A0A10] transition-colors px-3 py-2 border border-black/10 hover:border-black/25 rounded-lg"
                  >
                    <LayoutDashboard size={12} />
                    Admin
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 hover:text-[#0A0A10] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[11px] font-bold text-[#4ECDC4]">
                    {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  {user.firstName || user.username}
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 hover:text-[#0A0A10] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/games"
                  className="flex items-center gap-1.5 bg-[#0A0A10] hover:bg-[#1a1a24] text-white text-[11px] font-bold uppercase tracking-[0.12em] px-4 py-2.5 rounded-lg transition-colors"
                >
                  Play Now
                  <span className="text-[10px]">↗</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 -mr-1 text-gray-600 hover:text-[#0A0A10] transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-black/[0.06] px-6 py-4 space-y-1">
            {onAbout && (
              <button
                onClick={() => { onAbout(); setOpen(false); }}
                className="block w-full text-left text-[12px] font-bold uppercase tracking-[0.14em] text-gray-500 hover:text-[#0A0A10] py-3 transition-colors"
              >
                About
              </button>
            )}
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`block text-[12px] font-bold uppercase tracking-[0.14em] py-3 transition-colors ${
                  active(to) ? 'text-[#0A0A10]' : 'text-gray-500 hover:text-[#0A0A10]'
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/contact"
              onClick={() => setOpen(false)}
              className="block text-[12px] font-bold uppercase tracking-[0.14em] text-gray-500 hover:text-[#0A0A10] py-3 transition-colors"
            >
              Contact
            </Link>
            <div className="border-t border-black/[0.06] pt-3 mt-2 flex flex-col gap-2">
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setOpen(false)} className="block text-[12px] font-bold uppercase tracking-[0.14em] text-gray-500 py-2">
                    My Account
                  </Link>
                  {isAdmin && isAdmin() && (
                    <Link to="/dashboard" onClick={() => setOpen(false)} className="block text-[12px] font-bold uppercase tracking-[0.14em] text-gray-500 py-2">
                      Admin Dashboard
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="block text-[12px] font-bold uppercase tracking-[0.14em] text-gray-500 py-2">
                    Sign In
                  </Link>
                  <Link
                    to="/games"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center justify-center gap-1.5 bg-[#0A0A10] text-white text-[12px] font-bold uppercase tracking-[0.12em] px-4 py-2.5 rounded-lg"
                  >
                    Play Now ↗
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
      <SupportWidget user={user} />
    </>
  );
};
