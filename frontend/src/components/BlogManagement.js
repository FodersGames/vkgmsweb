import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Edit2, Save, X, Upload, Eye, EyeOff } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const BlogManagement = () => {
  const { token, hasPermission } = useAuth();
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', image_url: '', published: false });

  useEffect(() => { fetchPosts(); /* eslint-disable-next-line */ }, []);

  const fetchPosts = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/website/blog`, { headers: { Authorization: `Bearer ${token}` } });
      setPosts(r.data.posts);
    } catch (e) { console.error(e); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${API_URL}/api/upload`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setForm(p => ({ ...p, image_url: r.data.url }));
    } catch (e) { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const resetForm = () => { setForm({ title: '', content: '', image_url: '', published: false }); setEditing(null); setShowForm(false); };

  const startEdit = (post) => {
    setForm({ title: post.title, content: post.content, image_url: post.image_url || '', published: post.published });
    setEditing(post.slug);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/api/website/blog/${editing}`, form, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Post updated');
      } else {
        await axios.post(`${API_URL}/api/website/blog`, form, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Post created');
      }
      resetForm();
      fetchPosts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (slug) => {
    if (!window.confirm('Delete this blog post?')) return;
    try {
      await axios.delete(`${API_URL}/api/website/blog/${slug}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Post deleted');
      fetchPosts();
    } catch (e) { toast.error('Failed'); }
  };

  return (
    <div className="max-w-5xl">
      <div className="bg-white dark:bg-[#151520] rounded-xl border border-zinc-200 dark:border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-[#2a2a3c] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F2994A] to-[#EB5757] flex items-center justify-center"><FileText size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-zinc-900 dark:text-[#e4e4e7]">Blog Management</h3><p className="text-xs text-[#71717a]">Create and manage blog posts</p></div>
          </div>
          {hasPermission('create_blog') && (
            <button onClick={() => { showForm ? resetForm() : setShowForm(true); }} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"
              data-testid="create-blog-button">{showForm ? <X size={16} /> : <Plus size={16} />}{showForm ? 'Cancel' : 'New Post'}</button>
          )}
        </div>

        {showForm && (
          <div className="p-6 bg-slate-50 dark:bg-[#1c1c2e] border-b border-zinc-200 dark:border-[#2a2a3c]">
            <form onSubmit={handleSubmit} data-testid="blog-form">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Title</label>
                  <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none"
                    required data-testid="blog-title-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Content</label>
                  <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={8}
                    className="w-full bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] text-zinc-900 dark:text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none resize-none"
                    required data-testid="blog-content-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#71717a] mb-2 uppercase tracking-wider">Cover Image</label>
                  <div className="flex items-center gap-3">
                    {form.image_url && <img src={form.image_url.startsWith('/') ? `${API_URL}${form.image_url}` : form.image_url} alt="" className="w-20 h-14 rounded-lg object-cover border border-zinc-200 dark:border-[#2a2a3c]" />}
                    <label className="cursor-pointer bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/50 rounded-lg px-4 py-2.5 text-sm text-[#71717a] flex items-center gap-2">
                      <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Image'}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-900 dark:text-[#e4e4e7] cursor-pointer">
                  <input type="checkbox" checked={form.published} onChange={e => setForm(p => ({ ...p, published: e.target.checked }))} className="w-4 h-4 rounded" />
                  Publish immediately
                </label>
                <button type="submit" disabled={loading} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                  data-testid="submit-blog-button">{editing ? <Save size={14} /> : <Plus size={14} />}{loading ? 'Saving...' : editing ? 'Save Changes' : 'Create Post'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="p-6">
          <div className="text-xs font-semibold text-[#71717a] mb-4 uppercase tracking-wider">Posts ({posts.length})</div>
          {posts.length === 0 ? (
            <div className="text-center py-12 text-[#71717a]">No posts yet.</div>
          ) : (
            <div className="space-y-3" data-testid="blog-list">
              {posts.map(p => (
                <div key={p.slug} className="bg-slate-50 dark:bg-[#1c1c2e] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl p-4 hover:border-[#4ECDC4]/20 transition-all">
                  <div className="flex items-center gap-4">
                    {p.image_url ? <img src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url} alt="" className="w-16 h-12 rounded-lg object-cover border border-zinc-200 dark:border-[#2a2a3c]" /> :
                      <div className="w-16 h-12 rounded-lg bg-slate-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] flex items-center justify-center"><FileText size={16} className="text-[#71717a]" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-zinc-900 dark:text-[#e4e4e7]">{p.title}</h4>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase flex items-center gap-1 ${p.published ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : 'bg-[#71717a]/15 text-[#71717a]'}`}>
                          {p.published ? <><Eye size={10} />Published</> : <><EyeOff size={10} />Draft</>}
                        </span>
                      </div>
                      <p className="text-xs text-[#71717a]">by {p.author} &bull; {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      {hasPermission('edit_blog') && <button onClick={() => startEdit(p)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg text-[#71717a] hover:text-[#4ECDC4] transition-all" data-testid={`edit-blog-${p.slug}`}><Edit2 size={14} /></button>}
                      {hasPermission('delete_blog') && <button onClick={() => handleDelete(p.slug)} className="p-2 border border-zinc-200 dark:border-[#2a2a3c] hover:border-red-500/30 rounded-lg text-[#71717a] hover:text-red-400 transition-all" data-testid={`delete-blog-${p.slug}`}><Trash2 size={14} /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
