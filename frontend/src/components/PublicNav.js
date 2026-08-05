import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { List, X, SquaresFour, User } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { SupportWidget } from './SupportWidget';
import { PublicButton } from '../ui/PublicButton';
import { AnnouncementBanner } from './AnnouncementBanner';

export const PublicNav = ({ onAbout }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { to: '/applications', label: 'Applications' },
    { to: '/my-apps',      label: 'My Apps'      },
    { to: '/blog',         label: 'Blog'         },
    { to: '/vakar-plus',   label: 'Vakar+'       },
  ];

  const active = (to) => pathname === to || pathname.startsWith(to + '/');

  return (
    <>
    <AnnouncementBanner />
    <nav
      className="fixed left-0 right-0 z-50 liquid-glass rounded-none transition-[top,box-shadow] duration-200"
      style={{ top: 'var(--vkg-banner-h, 0px)', ...(scrolled ? {} : { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }) }}
    >
      <div className="max-w-[1040px] mx-auto px-6 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="font-display text-[16px] font-medium tracking-tight text-[#1D1D1F] transition-colors"
          >
            Vakar Games
          </Link>

          <div className="hidden md:flex items-center gap-[26px]">
            {onAbout && (
              <button
                onClick={() => { onAbout(); setOpen(false); }}
                className="text-[12.5px] text-[#1D1D1F] hover:text-[#6E6E73] transition-colors"
              >
                About
              </button>
            )}
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-[12.5px] transition-colors ${
                  active(to) ? 'text-[#4ECDC4] font-medium' : 'text-[#1D1D1F] hover:text-[#6E6E73]'
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
            className={`text-[12.5px] transition-colors ${active('/contact') ? 'text-[#4ECDC4] font-medium' : 'text-[#1D1D1F] hover:text-[#6E6E73]'}`}
          >
            Contact
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#BFBFC4] px-2.5 py-1.5 transition-colors"
                >
                  <SquaresFour size={12} />
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[#1D1D1F] hover:text-[#6E6E73] transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-[#4ECDC4]/15 flex items-center justify-center text-[10.5px] font-bold text-[#4ECDC4]">
                  {user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || <User size={11} />}
                </div>
                <span>{user.firstName || user.username}</span>
              </Link>
            </div>
          ) : (
            <PublicButton as={Link} to="/login" size="sm">
              Sign In
            </PublicButton>
          )}
        </div>

        <button
          className="md:hidden p-2 -mr-1 text-[#1D1D1F] hover:text-[#6E6E73] transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <List size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden liquid-glass rounded-none px-6 py-3 space-y-0.5">
          {onAbout && (
            <button
              onClick={() => { onAbout(); setOpen(false); }}
              className="block w-full text-left text-sm text-[#6E6E73] hover:text-[#1D1D1F] py-2.5 transition-colors"
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
                active(to) ? 'text-[#4ECDC4] font-semibold' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] py-2.5 transition-colors"
          >
            Contact
          </Link>

          {user ? (
            <>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] py-2.5 font-medium transition-colors"
              >
                My Account ({user.firstName || user.username})
              </Link>
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] py-2.5 transition-colors"
                >
                  Admin Dashboard
                </Link>
              )}
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block text-sm font-semibold text-[#1D1D1F] py-2.5 transition-colors"
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
