import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Edit2, Save, X, Upload, Eye, EyeOff } from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Badge, Input, Textarea } from '../ui';

export const BlogManagement = () => {
  const { token, hasPermission } = useAuth();
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', image_url: '', published: false });
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => { fetchPosts(); /* eslint-disable-next-line */ }, []);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const fetchPosts = async () => {
    try { const r = await api.get(`/api/website/blog`); setPosts(r.data.posts); } catch (e) {}
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/api/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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
    e.preventDefault(); setLoading(true);
    try {
      if (editing) { await api.put(`/api/website/blog/${editing}`, form); toast.success('Post updated'); }
      else { await api.post(`/api/website/blog`, form); toast.success('Post created'); }
      resetForm(); fetchPosts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = (slug, title) => {
    showConfirm({
      title: 'Delete blog post',
      description: `"${title}" will be permanently deleted. This action cannot be undone.`,
      onConfirm: async () => { await api.delete(`/api/website/blog/${slug}`); toast.success('Post deleted'); fetchPosts(); },
    });
  };

  return (
    <>
    <div className="max-w-5xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F2994A18' }}>
              <FileText size={16} style={{ color: '#F2994A' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Blog Management</h3>
              <p className="text-xs text-gray-500">Create and manage blog posts</p>
            </div>
          </div>
          {hasPermission('create_blog') && (
            <Button icon={showForm ? X : Plus} onClick={() => showForm ? resetForm() : setShowForm(true)} data-testid="create-blog-button">
              {showForm ? 'Cancel' : 'New Post'}
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <div className="px-6 py-5 bg-gray-50 border-b border-gray-200">
            <form onSubmit={handleSubmit} data-testid="blog-form">
              <div className="space-y-4">
                <Input
                  label="Title"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  required
                  data-testid="blog-title-input"
                />
                <Textarea
                  label="Content"
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  rows={8}
                  required
                  data-testid="blog-content-input"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cover Image</p>
                  <div className="flex items-center gap-3">
                    {form.image_url && (
                      <img src={form.image_url.startsWith('/') ? `${API_URL}${form.image_url}` : form.image_url} alt="" className="w-20 h-14 rounded-lg object-cover border border-gray-200" />
                    )}
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" icon={Upload} loading={uploading} as="span">
                        {uploading ? 'Uploading…' : 'Upload Image'}
                      </Button>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
                  <input type="checkbox" checked={form.published} onChange={e => setForm(p => ({ ...p, published: e.target.checked }))} className="w-4 h-4 rounded accent-[#4ECDC4]" />
                  Publish immediately
                </label>
                <Button type="submit" loading={loading} icon={editing ? Save : Plus} data-testid="submit-blog-button">
                  {loading ? 'Saving…' : editing ? 'Save Changes' : 'Create Post'}
                </Button>
              </div>
            </form>
          </div>
        )}

        <CardBody>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Posts ({posts.length})
          </p>
          {posts.length === 0 ? (
            <EmptyState icon={FileText} title="No posts yet" description="Create your first blog post to share updates." />
          ) : (
            <div className="space-y-2" data-testid="blog-list">
              {posts.map(p => (
                <div key={p.slug} className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-[#F2994A]/20 transition-colors">
                  {p.image_url
                    ? <img src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url} alt="" className="w-16 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />
                    : <div className="w-16 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0"><FileText size={16} className="text-gray-500" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{p.title}</h4>
                      <Badge variant={p.published ? 'success' : 'default'} dot>
                        {p.published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">by {p.author} · {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {hasPermission('edit_blog') && <Button variant="secondary" size="sm" icon={Edit2} onClick={() => startEdit(p)} data-testid={`edit-blog-${p.slug}`} />}
                    {hasPermission('delete_blog') && <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(p.slug, p.title)} data-testid={`delete-blog-${p.slug}`} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>

    <ConfirmDialog
      isOpen={dialog.open}
      onClose={closeConfirm}
      onConfirm={handleConfirm}
      title={dialog.title}
      description={dialog.description}
      confirmLabel="Delete"
      loading={confirmLoading}
      variant="destructive"
    />
    </>
  );
};
