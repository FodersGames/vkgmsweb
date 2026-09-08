import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, User, CircleNotch } from '@phosphor-icons/react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const imgUrl = (url) => url?.startsWith('/') ? `${API_URL}${url}` : url;


export const BlogList = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Blog — Vakar Games';
    axios.get(`${API_URL}/api/website/blog/public`)
      .then(r => { setPosts(r.data.posts); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh' }}>
      <PublicNav />

      {/* Page header */}
      <div style={{ paddingTop: '60px', backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <p className="kefir-label mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Studio</p>
          <h1
            className="font-black uppercase text-white"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            Blog
          </h1>
          <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            News, updates and announcements from the studio.
          </p>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-14">
        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <CircleNotch size={32} className="animate-spin mx-auto mb-4" />
            Loading…
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="font-black uppercase text-white/40 text-2xl tracking-tight mb-2">
              No Posts Yet
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.3)' }}>Check back soon for updates.</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="blog-posts-list">
            {posts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block overflow-hidden transition-all"
                style={{
                  backgroundColor: '#111111',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'border-color 0.3s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(78,205,196,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                data-testid={`blog-post-${post.slug}`}
              >
                <div className="flex flex-col sm:flex-row">
                  {post.image_url && (
                    <div className="sm:w-56 h-44 sm:h-auto flex-shrink-0 overflow-hidden">
                      <img
                        src={imgUrl(post.image_url)}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-7 flex-1 flex flex-col justify-between">
                    <div>
                      <h2
                        className="font-black uppercase text-white group-hover:text-[#4ECDC4] transition-colors mb-3 leading-tight"
                        style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', letterSpacing: '-0.01em' }}
                      >
                        {post.title}
                      </h2>
                      <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {post.content?.replace(/<[^>]*>/g, '').substring(0, 220)}…
                      </p>
                    </div>
                    <div className="flex items-center gap-5 mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
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
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
};

export const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/blog/${slug}`)
      .then(r => {
        setPost(r.data.post);
        document.title = `${r.data.post.title} — Vakar Games`;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircleNotch size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
    </div>
  );
  if (!post) return (
    <div style={{ backgroundColor: '#0D0D0D', color: 'rgba(255,255,255,0.3)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Post not found
    </div>
  );

  return (
    <div style={{ backgroundColor: '#0D0D0D', color: '#FFFFFF', minHeight: '100vh' }}>
      <PublicNav />

      <div style={{ paddingTop: '60px' }}>
        <div className="max-w-2xl mx-auto px-6 py-14">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm mb-10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
          >
            <ArrowLeft size={14} />
            <span className="text-[11px] font-bold uppercase tracking-wide">Back to Blog</span>
          </Link>

          {post.image_url && (
            <img
              src={imgUrl(post.image_url)}
              alt={post.title}
              className="w-full mb-10 object-cover"
              style={{ maxHeight: '360px', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          )}

          <h1
            className="font-black uppercase text-white mb-4 leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 3.5rem)', letterSpacing: '-0.02em' }}
          >
            {post.title}
          </h1>

          <div
            className="flex items-center gap-5 text-xs mb-10 pb-10"
            style={{ color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
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

          <div
            className="leading-relaxed whitespace-pre-wrap"
            style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', lineHeight: 1.8 }}
            data-testid="blog-content"
          >
            {post.content}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};
