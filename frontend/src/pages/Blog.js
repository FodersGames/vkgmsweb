import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, User, Menu, X as XIcon, FileText, ArrowRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PublicNav = ({ active }) => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'glass border-b border-white/[0.08] shadow-[0_0_60px_rgba(0,0,0,0.8)]' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8" style={{ perspective: '120px' }}>
              <div style={{ width:'100%',height:'100%',background:'linear-gradient(135deg,#FFFFFF 0%,#A0A0A8 100%)',borderRadius:'6px',transform:'rotateX(12deg) rotateY(-16deg)',boxShadow:'3px 5px 0px rgba(255,255,255,0.25)',transition:'transform 0.4s ease' }} className="group-hover:[transform:rotateX(18deg)_rotateY(-24deg)]" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white font-display">VAKAR GAMES</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {[{to:'/',label:'Home'},{to:'/games',label:'Games'},{to:'/blog',label:'Blog'}].map(({to,label}) => (
              <Link key={label} to={to}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 font-body
                  ${active===label?'text-white bg-white/10 border border-white/15':'text-[#A1A1A6] hover:text-white hover:bg-white/06'}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button className="md:hidden btn-icon" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
          {mobileMenu ? <XIcon size={16} className="text-white"/> : <Menu size={16} className="text-white"/>}
        </button>
      </div>
      {mobileMenu && (
        <div className="md:hidden glass border-t border-white/08 px-6 py-4 space-y-1" data-testid="mobile-menu">
          {[{to:'/',label:'Home'},{to:'/games',label:'Games'},{to:'/blog',label:'Blog'}].map(({to,label}) => (
            <Link key={label} to={to} className="block px-4 py-3 text-sm text-[#A1A1A6] hover:text-white hover:bg-white/06 rounded-xl transition-all" onClick={() => setMobileMenu(false)}>{label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
};

const Footer = () => (
  <footer style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'#040404' }}>
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</Link>
        <Link to="/games" className="text-xs text-[#6E6E73] hover:text-white transition-colors uppercase tracking-wider font-body">Games</Link>
        <Link to="/blog" className="text-xs text-[#6E6E73] hover:text-white transition-colors uppercase tracking-wider font-body">Blog</Link>
      </div>
      <p className="text-xs text-[#3A3A3C] font-body">&copy; {new Date().getFullYear()} Vakar Games</p>
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
    <div style={{ background:'#080808', color:'#F5F5F7', minHeight:'100vh' }} className="font-body">
      <PublicNav active="Blog" />

      {/* Header */}
      <div className="relative pt-32 pb-20 overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-60 pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-6 h-px bg-white/30" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#6E6E73]">Studio Updates</span>
          </div>
          <h1 className="font-display font-bold gradient-text-bright mb-4"
            style={{ fontSize:'clamp(3rem,7vw,5.5rem)', letterSpacing:'-0.03em', lineHeight:0.92 }}>
            BLOG
          </h1>
          <p className="text-[#6E6E73] text-lg max-w-xl" style={{ fontWeight:300 }}>
            News, announcements, and devlogs from the Vakar Games studio.
          </p>
        </div>
      </div>

      <div className="section-divider" />

      {/* Posts */}
      <div className="max-w-4xl mx-auto px-6 py-20">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-[#6E6E73]">Loading posts...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-32">
            <div className="w-16 h-16 glass glass-strong rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText size={24} className="text-[#3A3A3C]" />
            </div>
            <h3 className="font-display font-bold text-3xl gradient-text mb-3" style={{ letterSpacing:'-0.02em' }}>No posts yet</h3>
            <p className="text-[#6E6E73]">Check back soon for studio updates.</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="blog-posts-list">
            {posts.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group block" data-testid={`blog-post-${post.slug}`}>
                <div className="glass glass-hover rounded-2xl overflow-hidden relative" style={{ transition:'all 0.3s ease' }}>
                  <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)' }} />
                  <div className="flex flex-col md:flex-row">
                    {post.image_url && (
                      <div className="md:w-56 h-44 md:h-auto flex-shrink-0 overflow-hidden" style={{ borderRight:'1px solid rgba(255,255,255,0.06)' }}>
                        <img
                          src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
                          alt={post.title}
                          className="w-full h-full object-cover"
                          style={{ transition:'transform 0.5s ease' }}
                          onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'}
                          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                        />
                      </div>
                    )}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[10px] font-semibold tracking-widest uppercase text-white/50 glass px-2 py-0.5 rounded-full border border-white/10">Article</span>
                          <span className="text-xs text-[#6E6E73] flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(post.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                          </span>
                        </div>
                        <h2 className="text-lg font-semibold text-white group-hover:text-[#A1A1A6] transition-colors mb-2 font-display leading-snug" style={{ letterSpacing:'-0.01em' }}>
                          {post.title}
                        </h2>
                        <p className="text-sm text-[#6E6E73] line-clamp-2 leading-relaxed" style={{ fontWeight:300 }}>
                          {post.content?.replace(/<[^>]*>/g, '').substring(0, 200)}...
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-xs text-[#6E6E73] flex items-center gap-1">
                          <User size={11} />{post.author}
                        </span>
                        <span className="text-xs text-[#A1A1A6] flex items-center gap-1 font-medium group-hover:gap-2 transition-all">
                          Read more <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/website/blog/${slug}`)
      .then(r => { setPost(r.data.post); document.title = `${r.data.post.title} — Vakar Games`; setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ background:'#080808', minHeight:'100vh' }} className="flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="text-sm text-[#6E6E73] font-body">Loading...</span>
      </div>
    </div>
  );

  if (!post) return (
    <div style={{ background:'#080808', minHeight:'100vh' }} className="flex items-center justify-center">
      <div className="text-center">
        <h2 className="font-display font-bold text-3xl gradient-text mb-3" style={{ letterSpacing:'-0.02em' }}>Post not found</h2>
        <Link to="/blog" className="text-sm text-[#A1A1A6] hover:text-white transition-colors">← Back to Blog</Link>
      </div>
    </div>
  );

  return (
    <div style={{ background:'#080808', color:'#F5F5F7', minHeight:'100vh' }} className="font-body">
      <PublicNav active="Blog" />

      {/* Article header */}
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-6">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-[#6E6E73] hover:text-white transition-colors mb-10">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-white/50 glass px-2 py-0.5 rounded-full border border-white/10">Article</span>
          </div>
          <h1 className="font-display font-bold gradient-text-bright mb-5" style={{ fontSize:'clamp(2rem,5vw,3.5rem)', letterSpacing:'-0.03em', lineHeight:1.1 }}>
            {post.title}
          </h1>
          <div className="flex items-center gap-5 text-xs text-[#6E6E73]">
            <span className="flex items-center gap-1.5"><User size={12} />{post.author}</span>
            <span className="flex items-center gap-1.5"><Calendar size={12} />
              {new Date(post.created_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <div className="section-divider" />

      {/* Cover image */}
      {post.image_url && (
        <div className="max-w-3xl mx-auto px-6 pt-12">
          <div className="glass rounded-2xl overflow-hidden">
            <img
              src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
              alt={post.title}
              className="w-full max-h-80 object-cover"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="text-base text-[#A1A1A6] leading-8 whitespace-pre-wrap font-body" style={{ maxWidth:'68ch', fontWeight:300 }} data-testid="blog-content">
          {post.content}
        </div>
        <div className="mt-16 pt-8" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <Link to="/blog" className="btn-ghost inline-flex items-center gap-2 text-sm">
            <ArrowLeft size={14} /> All posts
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
};
