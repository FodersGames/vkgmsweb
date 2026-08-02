import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, User } from '@phosphor-icons/react';
import { PublicNav } from '../components/PublicNav';
import { SiteFooter } from '../components/SiteFooter';
import { Reveal } from '../components/Reveal';
import sunTextile from '../assets/photos/sun-textile.jpg';

const API_URL = process.env.REACT_APP_BACKEND_URL;


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
    <div className="bg-[#F5F5F7] min-h-screen">
      <PublicNav />

      <div className="pt-[52px]">
        {/* Page header */}
        <div className="bg-white border-b border-[#D2D2D7] py-16 px-6">
          <Reveal className="max-w-4xl mx-auto">
            <p className="text-[12px] font-mono text-[#6E6E73] mb-3">// vakar games</p>
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.02em] text-[#1D1D1F]">
              Blog
            </h1>
            <p className="text-[#6E6E73] mt-3">
              News, updates and announcements from the company.
            </p>
          </Reveal>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-14">
          {loading ? (
            <div className="text-center py-20 text-[#A1A1A6]">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <h2 className="font-display text-xl font-medium text-[#A1A1A6] mb-2">
                No posts yet
              </h2>
              <p className="text-[#6E6E73]">Check back soon for updates.</p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="blog-posts-list">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group block rounded-xl bg-white border border-[#D2D2D7] hover:border-[#BFBFC4] hover:shadow-sm transition-all overflow-hidden"
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
                      <h2 className="font-display text-lg font-medium text-[#1D1D1F] group-hover:text-[#4ECDC4] transition-colors mb-2 leading-snug">
                        {post.title}
                      </h2>
                      <p className="text-[#6E6E73] text-sm line-clamp-2 mb-4 leading-relaxed">
                        {post.content?.replace(/<[^>]*>/g, '').substring(0, 220)}…
                      </p>
                      <div className="flex items-center gap-4 text-xs text-[#A1A1A6]">
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
    <div className="bg-[#F5F5F7] min-h-screen flex items-center justify-center text-[#A1A1A6]">
      Loading…
    </div>
  );
  if (!post) return (
    <div className="bg-[#F5F5F7] min-h-screen flex items-center justify-center text-[#A1A1A6]">
      Post not found
    </div>
  );

  return (
    <div className="bg-[#F5F5F7] min-h-screen">
      <PublicNav />

      <div className="pt-[52px]">
        <div className="max-w-2xl mx-auto px-6 py-14">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-[#6E6E73] hover:text-[#1D1D1F] mb-10 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Blog
          </Link>

          <img
            src={post.image_url ? (post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url) : sunTextile}
            alt={post.title}
            className="rounded-xl w-full mb-10 max-h-80 object-cover border border-[#D2D2D7]"
          />

          <h1
            className="font-display text-3xl sm:text-5xl font-medium text-[#1D1D1F] mb-4 leading-tight"
          >
            {post.title}
          </h1>

          <div className="flex items-center gap-5 text-sm text-[#A1A1A6] mb-10 pb-10 border-b border-[#D2D2D7]">
            <span className="flex items-center gap-1.5"><User size={13} />{post.author}</span>
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              {new Date(post.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>

          <div
            className="text-[#3A3A3C] leading-relaxed whitespace-pre-wrap text-base"
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
