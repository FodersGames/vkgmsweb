import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { List, X, SquaresFour, User } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { SupportWidget } from './SupportWidget';
import { AnnouncementBanner } from './AnnouncementBanner';
import { API_URL } from '../utils/api';

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
    { to: '/games', label: 'Games' },
    { to: '/blog',  label: 'Blog'  },
  ];

  const active = (to) => pathname === to || pathname.startsWith(to + '/');

  return (
    <>
    <AnnouncementBanner />
    <nav
      className="fixed left-0 right-0 z-50 transition-[top,background] duration-200"
      style={{
        top: 'var(--vkg-banner-h, 0px)',
        backgroundColor: scrolled ? '#FAFAF7' : 'rgba(250,250,247,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link
            to="/"
            className="flex items-center gap-2.5 group transition-colors"
          >
            <img
              src="/logo.png"
              alt="Vakar Games"
              className="h-6 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-black text-[#1A1A1A] tracking-[0.08em] uppercase text-[17px] group-hover:text-[#FF6600] transition-colors">
              Vakar Games
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  active(to) ? 'text-[#FF6600]' : 'text-[#1A1A1A]/70 hover:text-[#1A1A1A]'
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/contact"
              className={`text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                active('/contact') ? 'text-[#FF6600]' : 'text-[#1A1A1A]/70 hover:text-[#1A1A1A]'
              }`}
            >
              Contact
            </Link>
          </div>
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1A1A1A]/70 hover:text-[#1A1A1A] border border-black/15 hover:border-black/40 px-3 py-1.5 rounded-full transition-colors"
                >
                  <SquaresFour size={11} />
                  Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-[#FF6600]/20 border border-[#FF6600]/40 flex items-center justify-center text-[10px] font-bold text-[#FF6600] overflow-hidden">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.name?.charAt(0)?.toUpperCase() || user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || <User size={10} />
                  )}
                </div>
                <span>{user.name || user.firstName || user.username}</span>
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="btn-kefir text-[10px] py-2 px-5"
            >
              Sign In
            </Link>
          )}
        </div>

        <button
          className="md:hidden p-2 -mr-1 text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <List size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-6 py-4 space-y-1"
          style={{ backgroundColor: '#FAFAF7', borderTop: '1px solid rgba(0,0,0,0.07)' }}
        >
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`block text-[11px] font-bold uppercase tracking-[0.12em] py-3 transition-colors ${
                active(to) ? 'text-[#FF6600]' : 'text-[#1A1A1A]/70 hover:text-[#1A1A1A]'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#1A1A1A]/70 hover:text-[#1A1A1A] py-3 transition-colors"
          >
            Contact
          </Link>

          {user ? (
            <>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#1A1A1A]/70 hover:text-[#1A1A1A] py-3 transition-colors"
              >
                My Account ({user.name || user.firstName || user.username})
              </Link>
              {isAdmin && isAdmin() && (
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#1A1A1A]/70 hover:text-[#1A1A1A] py-3 transition-colors"
                >
                  Admin Dashboard
                </Link>
              )}
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6600] py-3 transition-colors"
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
