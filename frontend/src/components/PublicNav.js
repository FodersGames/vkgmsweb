import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { List, X, SquaresFour, User } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { AnnouncementBanner } from './AnnouncementBanner';
import { API_URL } from '../utils/api';

export const PublicNav = ({ onAbout }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { to: '/games', label: 'Games' },
    { to: '/blog',  label: 'Blog'  },
    { to: '/contact', label: 'Contact' },
  ];

  const isHomeHero = pathname === '/' && !scrolled;
  const active = (to) => pathname === to || pathname.startsWith(to + '/');

  return (
    <>
      <AnnouncementBanner />
      <nav
        className="fixed left-0 right-0 z-50 transition-all duration-300"
        style={{
          top: 'var(--vkg-banner-h, 0px)',
          backgroundColor: isHomeHero
            ? 'rgba(0, 0, 0, 0.25)'
            : 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: isHomeHero
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        <div className="max-w-[1120px] mx-auto px-6 h-[54px] flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link
              to="/"
              className="flex items-center gap-2.5 group transition-opacity hover:opacity-80"
            >
              <img
                src="/logo.png"
                alt="Vakar Games"
                className="h-5 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <span
                className={`font-semibold tracking-tight text-[15px] transition-colors ${
                  isHomeHero ? 'text-white' : 'text-[#1D1D1F]'
                }`}
              >
                Vakar Games
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-7">
              {links.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`text-[13px] font-normal transition-colors ${
                    active(to)
                      ? 'text-[#FF6600] font-medium'
                      : isHomeHero
                      ? 'text-white/80 hover:text-white'
                      : 'text-[#1D1D1F]/80 hover:text-[#1D1D1F]'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {isAdmin && isAdmin() && (
                  <Link
                    to="/dashboard"
                    className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded transition-colors ${
                      isHomeHero
                        ? 'text-white/70 hover:text-white border border-white/20 hover:border-white/40'
                        : 'text-[#1D1D1F]/70 hover:text-[#1D1D1F] border border-[#D2D2D7] hover:border-[#1D1D1F]'
                    }`}
                  >
                    <SquaresFour size={13} />
                    Admin
                  </Link>
                )}
                <Link
                  to="/profile"
                  className={`inline-flex items-center gap-2 text-[13px] font-normal transition-colors ${
                    isHomeHero ? 'text-white/90 hover:text-white' : 'text-[#1D1D1F]/90 hover:text-[#1D1D1F]'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-[#FF6600]/15 border border-[#FF6600]/30 flex items-center justify-center text-[11px] font-medium text-[#FF6600] overflow-hidden">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url.startsWith('/') ? `${API_URL}${user.avatar_url}` : user.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.name?.charAt(0)?.toUpperCase() || user.firstName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || <User size={11} />
                    )}
                  </div>
                  <span>{user.name || user.firstName || user.username}</span>
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                className={isHomeHero ? 'btn-apple-light !py-1.5 !px-3.5 !text-[12px]' : 'btn-apple !py-1.5 !px-3.5 !text-[12px]'}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={`md:hidden p-1.5 transition-colors ${
              isHomeHero ? 'text-white' : 'text-[#1D1D1F]'
            }`}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <List size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            className="md:hidden px-6 py-5 space-y-2 border-t"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E5E5EA',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`block text-[14px] py-2 transition-colors ${
                  active(to) ? 'text-[#FF6600] font-medium' : 'text-[#1D1D1F]/80 hover:text-[#1D1D1F]'
                }`}
              >
                {label}
              </Link>
            ))}

            <div className="pt-3 border-t border-[#E5E5EA]">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="block text-[14px] text-[#1D1D1F] py-2"
                  >
                    My Account ({user.name || user.firstName || user.username})
                  </Link>
                  {isAdmin && isAdmin() && (
                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      className="block text-[14px] text-[#1D1D1F]/70 hover:text-[#1D1D1F] py-2"
                    >
                      Admin Dashboard
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="btn-apple w-full text-center mt-2 !py-2.5"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
};
