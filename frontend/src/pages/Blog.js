import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, CircleNotch, Lock, ShieldCheck, SignIn, ShareNetwork, Check } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { BlogContentRenderer, stripMarkdownForExcerpt } from '../components/BlogContentRenderer';

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
  const [copiedSlug, setCopiedSlug] = useState(null);

  const handleShare = async (e, post) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/blog/${post.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: `Check out this post from Vakar Games: ${post.title}`,
          url,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(post.slug);
      setTimeout(() => setCopiedSlug(null), 2500);
    }
  };

  useEffect(() => {
    document.title = 'Blog | Vakar Games';
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
    <div className="bg-white text-[#1D1D1F] min-h-screen">
      <PublicNav />

      {/* Page Header: Apple Clean */}
      <div className="pt-28 pb-12 border-b border-[#E5E5EA]">
        <div className="max-w-[1120px] mx-auto px-6">
          <p className="text-[13px] font-medium text-[#FF6600] mb-2">
            Dispatches
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F]">
            Blog
          </h1>
          <p className="mt-3 text-base md:text-lg text-[#6E6E73] max-w-xl">
            News, development updates, and stories from the studio.
          </p>
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-6 py-14">
        {loading ? (
          <div className="text-center py-24 text-[#86868B]">
            <CircleNotch size={32} className="animate-spin mx-auto mb-4" />
            Loading dispatches…
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-[#F5F5F7] rounded-2xl p-16 text-center border border-[#E5E5EA]">
            <h2 className="text-xl font-semibold text-[#1D1D1F] mb-2">
              No Posts Yet
            </h2>
            <p className="text-sm text-[#6E6E73]">Check back soon for studio announcements and devlogs.</p>
          </div>
        ) : (
          <div className="space-y-6" data-testid="blog-posts-list">
            {posts.map((post) => {
              const isLocked = !!post.is_locked;
              const allowed = post.allowed_roles || [];
              return (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group block bg-[#F5F5F7] rounded-2xl overflow-hidden border border-[#E5E5EA] transition-all hover:border-[#D2D2D7] hover:shadow-sm"
                  data-testid={`blog-post-${post.slug}`}
                >
                  <div className="flex flex-col sm:flex-row">
                    {post.image_url && (
                      <div className="sm:w-64 h-48 sm:h-auto flex-shrink-0 overflow-hidden relative bg-[#E5E5EA]">
                        <img
                          src={imgUrl(post.image_url)}
                          alt={post.title}
                          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                            isLocked ? 'brightness-90 saturate-50' : ''
                          }`}
                        />
                        {isLocked && (
                          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="p-2.5 rounded-xl bg-white/90 text-amber-600 shadow-md">
                              <Lock size={18} weight="bold" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-7 flex-1 flex flex-col justify-between">
                      <div>
                        {isLocked && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 mb-3">
                            <Lock size={12} weight="bold" />
                            <span>
                              Restricted: {allowed.map(r => rolesMap[r]?.name || r).join(', ') || 'Staff only'}
                            </span>
                          </div>
                        )}
                        <h2 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] group-hover:text-[#FF6600] transition-colors mb-2 leading-snug">
                          {post.title}
                        </h2>
                        <p className="text-sm text-[#6E6E73] leading-relaxed line-clamp-2">
                          {isLocked ? (
                            <span className="italic">
                              This article is restricted to specific studio roles.
                            </span>
                          ) : (
                            `${stripMarkdownForExcerpt(post.content, 220)}…`
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-5 text-xs text-[#86868B]">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar size={12} />
                          {new Date(post.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleShare(e, post)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white hover:bg-[#E5E5EA] border border-[#E5E5EA] text-[#1D1D1F] transition-colors font-medium text-xs shadow-xs"
                          title="Share this post"
                        >
                          {copiedSlug === post.slug ? (
                            <>
                              <Check size={13} className="text-emerald-600" weight="bold" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <ShareNetwork size={13} />
                              <span>Share</span>
                            </>
                          )}
                        </button>
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
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title || 'Vakar Games Blog',
          text: `Check out this post from Vakar Games: ${post?.title}`,
          url,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios.get(`${API_URL}/api/website/blog/${slug}`, { headers })
      .then(r => {
        setPost(r.data.post);
        document.title = `${r.data.post.title} | Vakar Games`;
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
    <div className="bg-white text-[#1D1D1F] min-h-screen flex items-center justify-center">
      <CircleNotch size={32} className="animate-spin text-[#86868B]" />
    </div>
  );
  if (!post) return (
    <div className="bg-white text-[#86868B] min-h-screen flex items-center justify-center">
      Post not found
    </div>
  );

  const isLocked = !!post.is_locked;
  const allowed = post.allowed_roles || [];

  return (
    <div className="bg-white text-[#1D1D1F] min-h-screen">
      <PublicNav />

      <div className="pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-6">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-[#6E6E73] hover:text-[#1D1D1F] mb-8 transition-colors font-medium"
          >
            <ArrowLeft size={14} />
            <span>Back to Blog</span>
          </Link>

          {post.image_url && (
            <div className="relative mb-8 rounded-2xl overflow-hidden border border-[#E5E5EA]">
              <img
                src={imgUrl(post.image_url)}
                alt={post.title}
                className={`w-full object-cover max-h-96 ${isLocked ? 'brightness-90 saturate-50' : ''}`}
              />
              {isLocked && (
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="p-3.5 rounded-2xl bg-white text-amber-600 shadow-xl">
                    <Lock size={26} weight="bold" />
                  </div>
                </div>
              )}
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#1D1D1F] mb-4 leading-tight tracking-tight">
            {post.title}
          </h1>

          <div className="flex items-center justify-between text-xs text-[#86868B] mb-8 pb-6 border-b border-[#E5E5EA]">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar size={12} />
              {new Date(post.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] border border-[#E5E5EA] text-[#1D1D1F] transition-colors font-medium text-xs shadow-xs"
              title="Share this post"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-600" weight="bold" />
                  <span className="text-emerald-600 font-medium">Link copied!</span>
                </>
              ) : (
                <>
                  <ShareNetwork size={14} />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>

          {isLocked ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA]">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200">
                <Lock size={26} weight="bold" />
              </div>

              <h2 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] mb-2">
                Restricted Article
              </h2>
              <p className="text-sm max-w-md mx-auto text-[#6E6E73] mb-6 leading-relaxed">
                This post is confidential and reserved exclusively for studio members holding at least one of the following roles:
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                {allowed.map(r => {
                  const roleInfo = rolesMap[r] || { name: r, color: '#FF6600' };
                  return (
                    <span
                      key={r}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 bg-white"
                      style={{
                        borderColor: '#D2D2D7',
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
                    className="btn-apple"
                  >
                    <SignIn size={16} className="mr-2" />
                    Sign in to access
                  </Link>
                  <p className="text-xs text-[#86868B]">
                    Sign in with an authorized account to unlock this post.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl max-w-md mx-auto bg-white border border-[#E5E5EA] text-xs text-[#6E6E73] leading-relaxed">
                  Logged in as <span className="text-[#1D1D1F] font-semibold">@{user.username}</span>. Your account does not currently possess the required role to view this article.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8" data-testid="blog-content">
              <BlogContentRenderer content={post.content} />
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};
