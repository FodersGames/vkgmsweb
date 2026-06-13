import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, User, Menu, X as XIcon, FileText, ArrowRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GridWires = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <svg width="100%" height="100%"><defs><pattern id="az-grid-b" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(0,120,212,0.06)" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#az-grid-b)"/></svg>
  </div>
);

const PublicNav = ({ active }) => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-200 ${scrolled ? 'border-b border-[#E1DFDD] shadow-sm' : 'border-b border-[#E1DFDD]'}`}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-6 h-6" style={{perspective:'60px'}}>
              <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#0078D4 0%,#40A9FF 100%)',borderRadius:'2px',transform:'rotateX(10deg) rotateY(-12deg)',boxShadow:'2px 3px 0px #005A9E'}}/>
            </div>
            <span className="text-sm font-bold tracking-tight text-[#201F1E] font-display">VAKAR GAMES</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {[{to:'/',label:'Home'},{to:'/games',label:'Games'},{to:'/blog',label:'Blog'}].map(({to,label}) => (
              <Link key={label} to={to}
                className={`px-3 py-1.5 text-[0.8125rem] font-medium rounded-sm transition-colors font-body ${
                  active === label ? 'text-[#0078D4] bg-[#EFF6FC]' : 'text-[#605E5C] hover:text-[#201F1E] hover:bg-[#F3F2F1]'
                }`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <button className="md:hidden p-2 text-[#605E5C]" onClick={() => setMobileMenu(!mobileMenu)} data-testid="mobile-menu-toggle">
          {mobileMenu ? <XIcon size={20}/> : <Menu size={20}/>}
        </button>
      </div>
      {mobileMenu && (
        <div className="md:hidden bg-white border-t border-[#E1DFDD] px-6 py-3 space-y-1" data-testid="mobile-menu">
          {[{to:'/',label:'Home'},{to:'/games',label:'Games'},{to:'/blog',label:'Blog'}].map(({to,label}) => (
            <Link key={label} to={to} className="block px-3 py-2 text-sm text-[#605E5C] hover:bg-[#F3F2F1] rounded-sm" onClick={() => setMobileMenu(false)}>{label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
};

const Footer = () => (
  <footer className="bg-[#1B1A19] border-t border-white/5">
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-sm font-bold text-white tracking-tight font-display">VAKAR GAMES</Link>
        <Link to="/games" className="text-xs text-[#605E5C] hover:text-white transition-colors uppercase tracking-wider font-body">Games</Link>
        <Link to="/blog" className="text-xs text-[#605E5C] hover:text-white transition-colors uppercase tracking-wider font-body">Blog</Link>
      </div>
      <p className="text-xs text-[#605E5C] font-body">&copy; {new Date().getFullYear()} Vakar Games</p>
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
    <div className="bg-white text-[#201F1E] min-h-screen font-body">
      <PublicNav active="Blog" />

      {/* Page header */}
      <div className="relative pt-14 overflow-hidden" style={{ background: 'linear-gradient(160deg, #FAFAFA 0%, #EFF6FC 100%)' }}>
        <GridWires />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0078D4] to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-8 h-px bg-[#0078D4]" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#0078D4]">Studio Updates</span>
          </div>
          <h1 className="font-display font-black text-5xl md:text-7xl leading-none tracking-tight text-[#201F1E] mb-4">
            BLOG
          </h1>
          <p className="text-base text-[#605E5C] max-w-xl mt-4">News, announcements, and devlogs from the Vakar Games studio.</p>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-4xl mx-auto px-6 py-20">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3">
            <div className="w-5 h-5 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#605E5C]">Loading posts...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-32">
            <div className="w-16 h-16 bg-[#EFF6FC] border border-[#C7E0F4] rounded-sm flex items-center justify-center mx-auto mb-6">
              <FileText size={24} className="text-[#0078D4]" />
            </div>
            <h3 className="font-display font-black text-3xl text-[#201F1E] mb-3">NO POSTS YET</h3>
            <p className="text-[#605E5C]">Check back soon for studio updates.</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="blog-posts-list">
            {posts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group block"
                data-testid={`blog-post-${post.slug}`}
              >
                <div className="az-panel rounded-sm overflow-hidden hover:border-[#0078D4] hover:shadow-[0_4px_20px_rgba(0,120,212,0.08)] transition-all duration-200">
                  <div className="flex flex-col md:flex-row">
                    {post.image_url && (
                      <div className="md:w-56 h-44 md:h-auto flex-shrink-0 overflow-hidden border-r border-[#E1DFDD]">
                        <img
                          src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                      </div>
                    )}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[10px] font-semibold tracking-widest uppercase text-[#0078D4] bg-[#EFF6FC] px-2 py-0.5 rounded-sm">Post</span>
                          <span className="text-xs text-[#A19F9D] flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <h2 className="text-lg font-semibold text-[#201F1E] group-hover:text-[#0078D4] transition-colors mb-2 font-display leading-snug">{post.title}</h2>
                        <p className="text-sm text-[#605E5C] line-clamp-2 leading-relaxed">
                          {post.content?.replace(/<[^>]*>/g, '').substring(0, 200)}...
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E1DFDD]">
                        <span className="text-xs text-[#A19F9D] flex items-center gap-1">
                          <User size={11} />{post.author}
                        </span>
                        <span className="text-xs text-[#0078D4] flex items-center gap-1 font-medium group-hover:gap-2 transition-all">
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
    <div className="bg-white min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#605E5C] font-body">Loading...</span>
      </div>
    </div>
  );

  if (!post) return (
    <div className="bg-white min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="font-display font-black text-3xl text-[#201F1E] mb-3">Post not found</h2>
        <Link to="/blog" className="text-sm text-[#0078D4] hover:underline">← Back to Blog</Link>
      </div>
    </div>
  );

  return (
    <div className="bg-white text-[#201F1E] min-h-screen font-body">
      <PublicNav active="Blog" />

      {/* Article header */}
      <div className="relative pt-14 overflow-hidden bg-[#FAFAFA] border-b border-[#E1DFDD]">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0078D4] to-transparent" />
        <div className="max-w-3xl mx-auto px-6 py-14">
          <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-medium text-[#0078D4] hover:text-[#106EBE] mb-8 transition-colors">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#0078D4] bg-[#EFF6FC] px-2 py-0.5 rounded-sm">Article</span>
          </div>
          <h1 className="font-display font-black text-3xl md:text-5xl leading-tight tracking-tight text-[#201F1E] mb-5">{post.title}</h1>
          <div className="flex items-center gap-5 text-xs text-[#A19F9D]">
            <span className="flex items-center gap-1.5"><User size={12} className="text-[#C8C6C4]" />{post.author}</span>
            <span className="flex items-center gap-1.5"><Calendar size={12} className="text-[#C8C6C4]" />
              {new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Cover image */}
      {post.image_url && (
        <div className="max-w-3xl mx-auto px-6 pt-10">
          <div className="az-panel rounded-sm overflow-hidden">
            <img
              src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
              alt={post.title}
              className="w-full max-h-80 object-cover"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div
          className="text-base text-[#3B3A39] leading-8 whitespace-pre-wrap font-body"
          style={{ maxWidth: '68ch' }}
          data-testid="blog-content"
        >
          {post.content}
        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-[#E1DFDD]">
          <Link to="/blog" className="inline-flex items-center gap-2 az-btn-ghost text-sm">
            <ArrowLeft size={14} /> All posts
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};
