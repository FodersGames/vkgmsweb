import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Edit2, Save, X, Upload, Globe, Lock, Check, Image as ImageIcon } from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Badge, Input, Textarea } from '../ui';

const DEFAULT_ROLE_OPTIONS = [
  { id: 'admin', name: 'Admin', color: '#EF4444' },
  { id: 'moderator', name: 'Moderator', color: '#3B82F6' },
  { id: 'game_dev', name: 'Game Developer', color: '#10B981' },
  { id: 'community_manager', name: 'Community Manager', color: '#EC4899' },
  { id: 'vip', name: 'VIP Player', color: '#F59E0B' },
];

export const BlogManagement = () => {
  const { hasPermission } = useAuth();
  const [posts, setPosts] = useState([]);
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLE_OPTIONS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', image_url: '', published: false, allowed_roles: [] });
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    fetchPosts();
    fetchRoles();
    /* eslint-disable-next-line */
  }, []);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/api/roles');
      if (res.data?.roles && res.data.roles.length > 0) {
        const merged = [
          { id: 'admin', name: 'Admin', color: '#EF4444' },
          ...res.data.roles.filter(r => r.id !== 'admin'),
        ];
        setAvailableRoles(merged);
      }
    } catch (e) {}
  };

  const fetchPosts = async () => {
    try { const r = await api.get(`/api/website/blog`); setPosts(r.data.posts || []); } catch (e) {}
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, GIF, WebP, SVG)');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/api/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(p => ({ ...p, image_url: r.data.url }));
      toast.success('Cover image uploaded successfully');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const resetForm = () => {
    setForm({ title: '', content: '', image_url: '', published: false, allowed_roles: [] });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (post) => {
    setForm({
      title: post.title,
      content: post.content,
      image_url: post.image_url || '',
      published: !!post.published,
      allowed_roles: Array.isArray(post.allowed_roles) ? post.allowed_roles : [],
    });
    setEditing(post.slug);
    setShowForm(true);
  };

  const toggleRole = (roleId) => {
    setForm(p => {
      const current = p.allowed_roles || [];
      const next = current.includes(roleId)
        ? current.filter(id => id !== roleId)
        : [...current, roleId];
      return { ...p, allowed_roles: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        image_url: form.image_url || '',
        published: form.published,
        allowed_roles: form.allowed_roles || [],
      };
      if (editing) { await api.put(`/api/website/blog/${editing}`, payload); toast.success('Post updated'); }
      else { await api.post(`/api/website/blog`, payload); toast.success('Post created'); }
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

  const getRoleBadge = (roleId) => {
    const role = availableRoles.find(r => r.id === roleId);
    return role ? role.name : roleId;
  };

  return (
    <>
    <div className="max-w-5xl">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#F2994A18' }}>
              <FileText size={16} style={{ color: '#F2994A' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Blog Management</h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">Create and manage blog posts</p>
            </div>
          </div>
          {hasPermission('create_blog') && (
            <Button icon={showForm ? X : Plus} onClick={() => showForm ? resetForm() : setShowForm(true)} data-testid="create-blog-button">
              {showForm ? 'Cancel' : 'New Post'}
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <div className="px-6 py-5 bg-[#F5F5F7] dark:bg-[#111118] border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
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
                {/* Cover Image */}
                <div>
                  <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">Cover Image</p>
                  <div className="flex items-center gap-4">
                    {form.image_url ? (
                      <div className="relative group">
                        <img
                          src={form.image_url.startsWith('/') ? `${API_URL}${form.image_url}` : form.image_url}
                          alt="Cover preview"
                          className="rounded-xl w-24 h-16 object-cover border border-[#D2D2D7] dark:border-[#2a2a3c]"
                        />
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, image_url: '' }))}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow"
                          title="Remove image"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded-xl border border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center text-[#6E6E73] dark:text-[#52525b]">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" icon={Upload} loading={uploading} as="span">
                        {uploading ? 'Uploading…' : form.image_url ? 'Replace Image' : 'Upload Image'}
                      </Button>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Access Restriction */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-2">
                    Access Permission
                  </p>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, allowed_roles: [] }))}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                        form.allowed_roles.length === 0
                          ? 'bg-[#FF6600]/15 text-[#FF6600] border-[#FF6600]/40 shadow-sm'
                          : 'bg-white dark:bg-[#181822] text-[#6E6E73] dark:text-[#a1a1aa] border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#FF6600]/30'
                      }`}
                    >
                      <Globe size={14} />
                      Public (Everyone)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (form.allowed_roles.length === 0) {
                          setForm(p => ({ ...p, allowed_roles: ['admin', 'moderator'] }));
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                        form.allowed_roles.length > 0
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-sm'
                          : 'bg-white dark:bg-[#181822] text-[#6E6E73] dark:text-[#a1a1aa] border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-amber-500/30'
                      }`}
                    >
                      <Lock size={14} />
                      Restricted by Role
                    </button>
                  </div>

                  {form.allowed_roles.length > 0 && (
                    <div className="p-4 rounded-xl bg-white dark:bg-[#0c0c12] border border-[#D2D2D7] dark:border-[#2a2a3c] space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                        <span>Select roles allowed to view this post:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, allowed_roles: availableRoles.map(r => r.id) }))}
                            className="text-[11px] font-medium text-[#FF6600] hover:underline"
                          >
                            Select all
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, allowed_roles: ['admin', 'moderator'] }))}
                            className="text-[11px] font-medium text-[#FF6600] hover:underline"
                          >
                            Staff only
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableRoles.map(role => {
                          const isSelected = form.allowed_roles.includes(role.id);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => toggleRole(role.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all ${
                                isSelected
                                  ? 'text-white shadow-sm'
                                  : 'text-[#6E6E73] dark:text-[#71717a] border-[#D2D2D7] dark:border-[#2a2a3c] hover:text-white hover:border-[#FF6600]/40'
                              }`}
                              style={{
                                backgroundColor: isSelected ? `${role.color || '#FF6600'}25` : 'transparent',
                                borderColor: isSelected ? role.color || '#FF6600' : undefined,
                              }}
                            >
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: role.color || '#FF6600' }}
                              />
                              <span>{role.name}</span>
                              {isSelected && <Check size={12} className="text-white ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2.5 text-sm text-[#3A3A3C] dark:text-[#a1a1aa] cursor-pointer select-none">
                  <input type="checkbox" checked={form.published} onChange={e => setForm(p => ({ ...p, published: e.target.checked }))} className="w-4 h-4 rounded accent-[#FF6600]" />
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
          <p className="text-[11px] font-semibold text-[#A1A1A6] dark:text-[#52525b] uppercase tracking-widest mb-4">
            Posts ({posts.length})
          </p>
          {posts.length === 0 ? (
            <EmptyState icon={FileText} title="No posts yet" description="Create your first blog post to share updates." />
          ) : (
            <div className="space-y-2" data-testid="blog-list">
              {posts.map(p => {
                const isRestricted = Array.isArray(p.allowed_roles) && p.allowed_roles.length > 0;
                return (
                  <div key={p.slug} className="rounded-xl flex items-center gap-4 p-4 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#F2994A]/20 transition-colors">
                    {p.image_url
                      ? <img src={p.image_url.startsWith('/') ? `${API_URL}${p.image_url}` : p.image_url} alt="" className="rounded-xl w-16 h-12 object-cover border border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0" />
                      : <div className="rounded-xl w-16 h-12 bg-[#EDEDEF] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center shrink-0"><FileText size={16} className="text-[#6E6E73] dark:text-[#a1a1aa]" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{p.title}</h4>
                        <Badge variant={p.published ? 'success' : 'default'} dot>
                          {p.published ? 'Published' : 'Draft'}
                        </Badge>
                        {isRestricted ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            title={`Restricted to: ${p.allowed_roles.map(getRoleBadge).join(', ')}`}
                          >
                            <Lock size={10} />
                            {p.allowed_roles.length === 1 ? getRoleBadge(p.allowed_roles[0]) : `${p.allowed_roles.length} roles`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Globe size={10} />
                            Public
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">by {p.author} · {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {hasPermission('edit_blog') && <Button variant="secondary" size="sm" icon={Edit2} onClick={() => startEdit(p)} data-testid={`edit-blog-${p.slug}`} />}
                      {hasPermission('delete_blog') && <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(p.slug, p.title)} data-testid={`delete-blog-${p.slug}`} />}
                    </div>
                  </div>
                );
              })}
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
