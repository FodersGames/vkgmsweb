import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { PublicNav } from '../components/PublicNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PageFooter = () => (
  <footer className="bg-[#1C1917] mt-24">
    <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-base font-black tracking-[0.18em] text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          VAKAR GAMES
        </Link>
        <Link to="/games" className="text-xs text-[#78716C] hover:text-white transition-colors">Games</Link>
        <Link to="/blog"  className="text-xs text-[#78716C] hover:text-white transition-colors">Blog</Link>
      </div>
      <p className="text-xs text-[#44403C]">&copy; Vakar Games {new Date().getFullYear()}</p>
    </div>
  </footer>
);

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
    <div className="bg-[#F9F7F4] min-h-screen">
      <PublicNav />

      <div className="pt-16">
        {/* Page header */}
        <div className="bg-white border-b border-[#E8E3DB] py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-semibold text-[#A8A29E] tracking-[0.14em] uppercase mb-3">
              Vakar Games
            </p>
            <h1
              className="text-5xl sm:text-7xl md:text-8xl font-black text-[#1C1917] leading-tight"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              BLOG
            </h1>
            <p className="text-[#78716C] mt-3">
              News, updates and announcements from the studio.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-14">
          {loading ? (
            <div className="text-center py-20 text-[#A8A29E]">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <h2
                className="text-3xl font-black text-[#A8A29E] mb-2"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                NO POSTS YET
              </h2>
              <p className="text-[#78716C]">Check back soon for updates.</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="blog-posts-list">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group block bg-white border border-[#E8E3DB] hover:border-[#C9C3BB] hover:shadow-sm transition-all overflow-hidden"
                  data-testid={`blog-post-${post.slug}`}
                >
                  <div className="flex flex-col sm:flex-row">
                    {post.image_url && (
                      <div className="sm:w-52 h-44 sm:h-auto flex-shrink-0">
                        <img
                          src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6 flex-1">
                      <h2 className="text-lg font-bold text-[#1C1917] group-hover:text-[#4ECDC4] transition-colors mb-2 leading-snug">
                        {post.title}
                      </h2>
                      <p className="text-[#78716C] text-sm line-clamp-2 mb-4 leading-relaxed">
                        {post.content?.replace(/<[^>]*>/g, '').substring(0, 220)}…
                      </p>
                      <div className="flex items-center gap-4 text-xs text-[#A8A29E]">
                        <span className="flex items-center gap-1.5">
                          <User size={11} />{post.author}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar size={11} />
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
      </div>

      <PageFooter />
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
    <div className="bg-[#F9F7F4] min-h-screen flex items-center justify-center text-[#A8A29E]">
      Loading…
    </div>
  );
  if (!post) return (
    <div className="bg-[#F9F7F4] min-h-screen flex items-center justify-center text-[#A8A29E]">
      Post not found
    </div>
  );

  return (
    <div className="bg-[#F9F7F4] min-h-screen">
      <PublicNav />

      <div className="pt-16">
        <div className="max-w-2xl mx-auto px-6 py-14">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-[#78716C] hover:text-[#1C1917] mb-10 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Blog
          </Link>

          {post.image_url && (
            <img
              src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
              alt={post.title}
              className="w-full rounded-lg mb-10 max-h-80 object-cover border border-[#E8E3DB]"
            />
          )}

          <h1
            className="text-3xl sm:text-5xl font-black text-[#1C1917] mb-4 leading-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {post.title}
          </h1>

          <div className="flex items-center gap-5 text-sm text-[#A8A29E] mb-10 pb-10 border-b border-[#E8E3DB]">
            <span className="flex items-center gap-1.5"><User size={13} />{post.author}</span>
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              {new Date(post.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>

          <div
            className="text-[#44403C] leading-relaxed whitespace-pre-wrap text-base"
            data-testid="blog-content"
          >
            {post.content}
          </div>
        </div>
      </div>

      <PageFooter />
    </div>
  );
};
