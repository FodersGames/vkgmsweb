import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, User, Menu, X as XIcon } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const BlogList = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.title = 'Blog — Vakar Games';
    axios.get(`${API_URL}/api/website/blog/public`).then(r => { setPosts(r.data.posts); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-black tracking-[0.2em] text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</Link>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/games" className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase">Games</Link>
              <Link to="/blog" className="text-xs font-bold tracking-[0.15em] text-white uppercase">Blog</Link>
            </div>
          </div>
          <button className="md:hidden p-2 text-white" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <XIcon size={22}/> : <Menu size={22}/>}</button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-[#111118] border-t border-white/5 px-6 py-4 space-y-3">
            <Link to="/" className="block text-sm text-[#8A8A9A] hover:text-white py-2" onClick={() => setMobileMenu(false)}>Home</Link>
            <Link to="/games" className="block text-sm text-[#8A8A9A] hover:text-white py-2" onClick={() => setMobileMenu(false)}>Games</Link>
            <Link to="/blog" className="block text-sm text-white py-2" onClick={() => setMobileMenu(false)}>Blog</Link>
          </div>
        )}
      </nav>

      <div className="pt-16">
        <div className="py-16 sm:py-24 px-4 sm:px-6 text-center vakar-soft-grid" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0a0a0f 100%)' }}>
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight mb-4 vakar-gradient-title" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>BLOG</h1>
          <p className="text-lg text-white/50 max-w-xl mx-auto">News, updates and announcements from Vakar Games.</p>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          {loading ? (
            <div className="text-center py-20 text-white/30">Loading...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-2xl font-bold text-white/20 mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>NO POSTS YET</p>
              <p className="text-white/40">Check back soon for updates.</p>
            </div>
          ) : (
            <div className="space-y-8" data-testid="blog-posts-list">
              {posts.map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`}
                  className="block vakar-glass rounded-2xl overflow-hidden hover:border-[#4ECDC4]/40 transition-all group vakar-card-hover duration-300"
                  data-testid={`blog-post-${post.slug}`}>
                  <div className="flex flex-col md:flex-row">
                    {post.image_url && (
                      <div className="md:w-64 h-48 md:h-auto flex-shrink-0">
                        <img src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
                          alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-5 sm:p-6 flex-1">
                      <h2 className="text-xl font-bold text-white group-hover:text-[#4ECDC4] transition-colors mb-2">{post.title}</h2>
                      <p className="text-white/50 text-sm line-clamp-2 mb-4">{post.content?.replace(/<[^>]*>/g, '').substring(0, 200)}...</p>
                      <div className="flex items-center gap-4 text-xs text-white/30">
                        <span className="flex items-center gap-1"><User size={12} />{post.author}</span>
                        <span className="flex items-center gap-1"><Calendar size={12} />{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-white/10 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-lg font-black tracking-[0.2em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</Link>
            <Link to="/games" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase">Games</Link>
            <Link to="/blog" className="text-xs tracking-[0.1em] text-[#8A8A9A] hover:text-white transition-colors uppercase">Blog</Link>
          </div>
          <p className="text-xs text-[#8A8A9A]">&copy; VAKAR GAMES {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};

export const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/blog/${slug}`).then(r => {
      setPost(r.data.post);
      document.title = `${r.data.post.title} — Vakar Games`;
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="bg-[#0a0a0f] min-h-screen flex items-center justify-center text-white/30">Loading...</div>;
  if (!post) return <div className="bg-[#0a0a0f] min-h-screen flex items-center justify-center text-white/30">Post not found</div>;

  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-black tracking-[0.2em] text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</Link>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/games" className="text-xs font-bold tracking-[0.15em] text-[#8A8A9A] hover:text-white transition-colors uppercase">Games</Link>
              <Link to="/blog" className="text-xs font-bold tracking-[0.15em] text-white uppercase">Blog</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16 max-w-3xl mx-auto px-6 py-16">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-[#4ECDC4] hover:text-[#45b8b0] mb-8">
          <ArrowLeft size={16} /> Back to Blog
        </Link>

        {post.image_url && (
          <img src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
            alt={post.title} className="w-full rounded-xl mb-8 max-h-96 object-cover" />
        )}

        <h1 className="text-3xl md:text-5xl font-black mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{post.title}</h1>

        <div className="flex items-center gap-4 text-sm text-white/40 mb-8 pb-8 border-b border-white/10">
          <span className="flex items-center gap-1"><User size={14} />{post.author}</span>
          <span className="flex items-center gap-1"><Calendar size={14} />{new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="prose prose-invert max-w-none text-white/70 leading-relaxed whitespace-pre-wrap" data-testid="blog-content">
          {post.content}
        </div>
      </div>

      <footer className="border-t border-white/10 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <Link to="/" className="text-lg font-black tracking-[0.2em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>VAKAR GAMES</Link>
          <p className="text-xs text-[#8A8A9A]">&copy; VAKAR GAMES {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};
