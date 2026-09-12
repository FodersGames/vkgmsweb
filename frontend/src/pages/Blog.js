import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, User, CircleNotch, Lock, ShieldCheck, SignIn } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import headerForestTrail from '../assets/photos/header-forest-trail.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const imgUrl = (url) => url?.startsWith('/') ? `${API_URL}${url}` : url;

const DEFAULT_ROLES_MAP = {
  admin: { name: 'Admin', color: '#EF4444' },
  moderator: { name: 'Moderator', color: '#3B82F6' },
  game_dev: { name: 'Game Developer', color: '#10B981' },
  community_manager: { name: 'Community Manager', color: '#EC4899' },
  vip: { name: 'VIP Player', color: '#F59E0B' },
  tester: { name: 'Tester', color: '#8B5CF6' },
};

export const BlogList = () => {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [rolesMap, setRolesMap] = useState(DEFAULT_ROLES_MAP);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Blog — Vakar Games';
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    axios.get(`${API_URL}/api/website/blog/public`, { headers })
      .then(r => { setPosts(r.data.posts || []); setLoading(false); })
      .catch(() => setLoading(false));

    axios.get(`${API_URL}/api/roles`)
      .then(r => {
        if (r.data?.roles) {
          const map = { ...DEFAULT_ROLES_MAP };
          r.data.roles.forEach(role => {
            map[role.id] = { name: role.name, color: role.color };
          });
          setRolesMap(map);
        }
      })
      .catch(() => {});
  }, [token]);

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0A0A0A', minHeight: '100vh' }}>
      <PublicNav />

      {/* Page header with cinematic backdrop */}
      <div
        className="relative overflow-hidden"
        style={{ paddingTop: '60px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={headerForestTrail}
            alt=""
            className="w-full h-full object-cover object-center"
            style={{ filter: 'brightness(1.05) contrast(1.02) saturate(1.1)', transform: 'scale(1.03)', opacity: 0.55 }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 40%, #FFFFFF 100%)' }}
          />
        </div>
        <div className="relative z-10 max-w-[1100px] mx-auto px-6 py-16 sm:py-20">
          <h1
            className="font-black uppercase text-[#0A0A0A]"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            Blog
          </h1>
          <p className="mt-4 text-sm max-w-md text-[#52525B]">
            News, updates and announcements from the studio.
          </p>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-14">
        {loading ? (
          <div className="text-center py-20 text-[#71717A]">
            <CircleNotch size={32} className="animate-spin mx-auto mb-4 text-[#FF6600]" />
            Loading…
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="font-black uppercase text-[#A1A1AA] text-2xl tracking-tight mb-2">
              No Posts Yet
            </h2>
            <p className="text-[#71717A]">Check back soon for updates.</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="blog-posts-list">
            {posts.map((post) => {
              const isLocked = !!post.is_locked;
              const allowed = post.allowed_roles || [];
              return (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group block overflow-hidden transition-all bg-white"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: isLocked ? '1px solid rgba(245,158,11,0.4)' : '1px solid #E5E7EB',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = isLocked ? '#F59E0B' : '#FF6600';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = isLocked ? 'rgba(245,158,11,0.4)' : '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  data-testid={`blog-post-${post.slug}`}
                >
                  <div className="flex flex-col sm:flex-row">
                    {post.image_url && (
                      <div className="sm:w-56 h-44 sm:h-auto flex-shrink-0 overflow-hidden relative bg-[#F8F9FA]">
                        <img
                          src={imgUrl(post.image_url)}
                          alt={post.title}
                          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                            isLocked ? 'brightness-75 saturate-50' : ''
                          }`}
                        />
                        {isLocked && (
                          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="p-2.5 rounded bg-black/70 border border-amber-500/40 text-amber-400">
                              <Lock size={20} weight="duotone" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-7 flex-1 flex flex-col justify-between">
                      <div>
                        {isLocked && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300 mb-3">
                            <Lock size={12} weight="bold" />
                            <span>
                              Restricted: {allowed.map(r => rolesMap[r]?.name || r).join(', ') || 'Staff only'}
                            </span>
                          </div>
                        )}
                        <h2
                          className="font-black uppercase text-[#0A0A0A] group-hover:text-[#FF6600] transition-colors mb-3 leading-tight"
                          style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', letterSpacing: '-0.01em' }}
                        >
                          {post.title}
                        </h2>
                        <p className="text-sm leading-relaxed line-clamp-2" style={{ color: isLocked ? '#9CA3AF' : '#52525B' }}>
                          {isLocked ? (
                            <span className="italic">
                              🔒 This article is restricted to specific studio roles ({allowed.map(r => rolesMap[r]?.name || r).join(', ')}). Click to view details.
                            </span>
                          ) : (
                            `${post.content?.replace(/<[^>]*>/g, '').substring(0, 220)}…`
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-5 mt-4 text-xs text-[#71717A]">
                        <span className="flex items-center gap-1.5 uppercase tracking-wide font-bold" style={{ fontSize: '0.65rem' }}>
                          <User size={10} />{post.author}
                        </span>
                        <span className="flex items-center gap-1.5 uppercase tracking-wide font-bold" style={{ fontSize: '0.65rem' }}>
                          <Calendar size={10} />
                          {new Date(post.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
};

export const BlogPost = () => {
  const { slug } = useParams();
  const { user, token } = useAuth();
  const [post, setPost] = useState(null);
  const [rolesMap, setRolesMap] = useState(DEFAULT_ROLES_MAP);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios.get(`${API_URL}/api/website/blog/${slug}`, { headers })
      .then(r => {
        setPost(r.data.post);
        document.title = `${r.data.post.title} — Vakar Games`;
        setLoading(false);
      })
      .catch(() => setLoading(false));

    axios.get(`${API_URL}/api/roles`)
      .then(r => {
        if (r.data?.roles) {
          const map = { ...DEFAULT_ROLES_MAP };
          r.data.roles.forEach(role => {
            map[role.id] = { name: role.name, color: role.color };
          });
          setRolesMap(map);
        }
      })
      .catch(() => {});
  }, [slug, token]);

  if (loading) return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0A0A0A', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircleNotch size={32} className="animate-spin text-[#FF6600]" />
    </div>
  );
  if (!post) return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#71717A', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Post not found
    </div>
  );

  const isLocked = !!post.is_locked;
  const allowed = post.allowed_roles || [];

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0A0A0A', minHeight: '100vh' }}>
      <PublicNav />

      <div style={{ paddingTop: '60px' }}>
        <div className="max-w-2xl mx-auto px-6 py-14">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm mb-10 transition-colors text-[#71717A] hover:text-[#0A0A0A]"
          >
            <ArrowLeft size={14} />
            <span className="text-[11px] font-bold uppercase tracking-wide">Back to Blog</span>
          </Link>

          {post.image_url && (
            <div className="relative mb-10 overflow-hidden bg-[#F8F9FA]">
              <img
                src={imgUrl(post.image_url)}
                alt={post.title}
                className={`w-full object-cover ${isLocked ? 'brightness-75 saturate-50' : ''}`}
                style={{ maxHeight: '360px', border: '1px solid #E5E7EB' }}
              />
              {isLocked && (
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="p-3.5 bg-black/70 border border-amber-500/40 text-amber-400 shadow-xl">
                    <Lock size={28} weight="duotone" />
                  </div>
                </div>
              )}
            </div>
          )}

          <h1
            className="font-black uppercase text-[#0A0A0A] mb-4 leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 3.5rem)', letterSpacing: '-0.02em' }}
          >
            {post.title}
          </h1>

          <div
            className="flex items-center gap-5 text-xs mb-10 pb-10 text-[#71717A]"
            style={{ borderBottom: '1px solid #E5E7EB' }}
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold" style={{ fontSize: '0.65rem' }}>
              <User size={11} />{post.author}
            </span>
            <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold" style={{ fontSize: '0.65rem' }}>
              <Calendar size={11} />
              {new Date(post.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>

          {isLocked ? (
            <div
              className="p-8 sm:p-12 text-center border"
              style={{
                backgroundColor: '#F8F9FA',
                borderColor: '#F59E0B',
              }}
            >
              <div
                className="w-16 h-16 mx-auto mb-6 flex items-center justify-center border"
                style={{
                  backgroundColor: '#FEF3C7',
                  borderColor: '#FCD34D',
                  color: '#D97706',
                }}
              >
                <Lock size={32} weight="duotone" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black uppercase text-[#0A0A0A] tracking-tight mb-2">
                Restricted Article
              </h2>
              <p className="text-sm max-w-md mx-auto text-[#52525B] mb-6 leading-relaxed">
                This post is confidential and reserved exclusively for studio members holding at least one of the following roles:
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                {allowed.map(r => {
                  const roleInfo = rolesMap[r] || { name: r, color: '#FF6600' };
                  return (
                    <span
                      key={r}
                      className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E7EB',
                        color: roleInfo.color,
                      }}
                    >
                      <ShieldCheck size={14} weight="bold" />
                      {roleInfo.name}
                    </span>
                  );
                })}
              </div>

              {!user ? (
                <div className="space-y-4">
                  <Link
                    to={`/login?redirect=/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider bg-[#FF6600] text-white hover:bg-[#e05a00] transition-colors"
                  >
                    <SignIn size={16} weight="bold" />
                    Log in to access
                  </Link>
                  <p className="text-xs text-[#71717A]">
                    Sign in with an authorized account to unlock this post.
                  </p>
                </div>
              ) : (
                <div className="p-4 max-w-md mx-auto bg-white border border-[#E5E7EB] text-xs text-[#52525B] leading-relaxed">
                  Logged in as <span className="text-[#0A0A0A] font-semibold">@{user.username}</span>. Your account does not currently possess the required role(s) to view this article.
                </div>
              )}
            </div>
          ) : (
            <div
              className="leading-relaxed whitespace-pre-wrap text-[#1F2937]"
              style={{ fontSize: '1.05rem', lineHeight: 1.85 }}
              data-testid="blog-content"
            >
              {post.content}
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

