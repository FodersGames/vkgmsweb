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
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-sm border-b border-gray-200' : 'border-b border-gray-100'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link
            to="/"
            className="text-lg font-black tracking-[0.18em] text-gray-900 hover:text-[#2D2926] transition-colors"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            VAKAR GAMES
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {onAbout && (
              <button
                onClick={() => { onAbout(); setOpen(false); }}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                About
              </button>
            )}
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition-colors ${
                  active(to) ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
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
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Contact
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded px-2.5 py-1.5 transition-all"
                >
                  <LayoutDashboard size={12} />
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-[11px] font-bold text-brand-400">
                  {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || <User size={12} />}
                </div>
                <span>{user.firstName || user.username}</span>
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold text-gray-900 hover:text-brand-400 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>

        <button
          className="md:hidden p-2 -mr-1 text-gray-500 hover:text-gray-900 transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-200 px-6 py-3 space-y-0.5">
          {onAbout && (
            <button
              onClick={() => { onAbout(); setOpen(false); }}
              className="block w-full text-left text-sm text-gray-500 hover:text-gray-900 py-2.5 transition-colors"
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
                active(to) ? 'text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="block text-sm text-gray-500 hover:text-gray-900 py-2.5 transition-colors"
          >
            Contact
          </Link>

          {user ? (
            <>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="block text-sm text-gray-500 hover:text-gray-900 py-2.5 font-medium transition-colors"
              >
                My Account ({user.firstName || user.username})
              </Link>
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block text-sm text-gray-500 hover:text-gray-900 py-2.5 transition-colors"
                >
                  Admin Dashboard
                </Link>
              )}
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block text-sm font-semibold text-gray-900 py-2.5 transition-colors"
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
