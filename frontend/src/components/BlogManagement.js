import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Upload,
  Globe,
  Lock,
  Check,
  Image as ImageIcon,
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  List,
  ImagePlus,
  Eye,
  Edit3,
  Link as LinkIcon,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Badge, Input, Textarea } from '../ui';
import { BlogContentRenderer } from './BlogContentRenderer';

const DEFAULT_ROLE_OPTIONS = [
  { id: 'admin', name: 'Admin', color: '#EF4444' },
  { id: 'moderator', name: 'Moderator', color: '#3B82F6' },
  { id: 'game_dev', name: 'Game Developer', color: '#10B981' },
  { id: 'community_manager', name: 'Community Manager', color: '#EC4899' },
  { id: 'vip', name: 'VIP Player', color: '#F59E0B' },
];

const ROUNDED_OPTIONS = [
  { id: 'rounded-2xl', label: 'Apple Rounded (16px)', preview: 'rounded-2xl' },
  { id: 'rounded-3xl', label: 'Large Rounded (24px)', preview: 'rounded-3xl' },
  { id: 'rounded-xl', label: 'Light Rounded (12px)', preview: 'rounded-xl' },
  { id: 'rounded-none', label: 'Sharp Corners (0px)', preview: 'rounded-none' },
];

const ALIGN_OPTIONS = [
  { id: 'w-full', label: 'Full Width' },
  { id: 'align-center', label: 'Centered (Standard size)' },
  { id: 'align-left', label: 'Left Aligned' },
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

  // Advanced Blog Editor State
  const [editorTab, setEditorTab] = useState('write'); // 'write' | 'preview'
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [inlineUploading, setInlineUploading] = useState(false);
  const [inlineUrl, setInlineUrl] = useState('');
  const [inlineCaption, setInlineCaption] = useState('');
  const [inlineRounded, setInlineRounded] = useState('rounded-2xl');
  const [inlineAlign, setInlineAlign] = useState('w-full');
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchPosts();
    fetchRoles();
    /* eslint-disable-next-line */
  }, []);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog((d) => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try {
      await dialog.onConfirm();
      setDialog((d) => ({ ...d, open: false }));
    } finally {
      setConfirmLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/api/roles');
      if (res.data?.roles && res.data.roles.length > 0) {
        const merged = [
          { id: 'admin', name: 'Admin', color: '#EF4444' },
          ...res.data.roles.filter((r) => r.id !== 'admin'),
        ];
        setAvailableRoles(merged);
      }
    } catch (e) {}
  };

  const fetchPosts = async () => {
    try {
      const r = await api.get(`/api/website/blog`);
      setPosts(r.data.posts || []);
    } catch (e) {}
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WebP)');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/api/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((p) => ({ ...p, image_url: r.data.url }));
      toast.success('Cover image uploaded successfully');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleInlineUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    setInlineUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/api/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setInlineUrl(r.data.url);
      toast.success('Image uploaded! You can now choose its styling');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setInlineUploading(false);
      e.target.value = '';
    }
  };

  // Insert markdown into textarea at current selection
  const insertText = (prefix, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setForm((p) => ({ ...p, content: p.content + prefix + defaultText + suffix }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const oldVal = textarea.value;
    const selected = oldVal.substring(start, end) || defaultText;
    const newVal = oldVal.substring(0, start) + prefix + selected + suffix + oldVal.substring(end);
    setForm((p) => ({ ...p, content: newVal }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  const confirmInsertImage = () => {
    if (!inlineUrl) {
      toast.error('Please upload or provide an image');
      return;
    }
    const tag = `\n\n![${inlineCaption.trim() || 'Illustration'} | ${inlineRounded} | ${inlineAlign}](${inlineUrl})\n\n`;
    insertText(tag, '', '');
    setImageModalOpen(false);
    setInlineUrl('');
    setInlineCaption('');
    toast.success('Image inserted into article');
  };

  const resetForm = () => {
    setForm({ title: '', content: '', image_url: '', published: false, allowed_roles: [] });
    setEditing(null);
    setShowForm(false);
    setEditorTab('write');
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
    setEditorTab('write');
  };

  const toggleRole = (roleId) => {
    setForm((p) => {
      const current = p.allowed_roles || [];
      const next = current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId];
      return { ...p, allowed_roles: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        image_url: form.image_url || '',
        published: form.published,
        allowed_roles: form.allowed_roles || [],
      };
      if (editing) {
        await api.put(`/api/website/blog/${editing}`, payload);
        toast.success('Post updated successfully');
      } else {
        await api.post(`/api/website/blog`, payload);
        toast.success('Post published successfully');
      }
      resetForm();
      fetchPosts();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error saving post');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (slug, title) => {
    showConfirm({
      title: 'Delete Article',
      description: `The article "${title}" will be permanently deleted. This action cannot be undone.`,
      onConfirm: async () => {
        await api.delete(`/api/website/blog/${slug}`);
        toast.success('Article deleted');
        fetchPosts();
      },
    });
  };

  const getRoleBadge = (roleId) => {
    const role = availableRoles.find((r) => r.id === roleId);
    return role ? role.name : roleId;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className="bg-white border-[#E5E5EA] shadow-sm">
        <CardHeader className="flex items-center justify-between border-b border-[#F5F5F7] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl w-10 h-10 bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600]">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F]">Devlog & Blog Management</h3>
              <p className="text-xs text-[#86868B]">Write illustrated devlogs with rich layout options</p>
            </div>
          </div>
          {hasPermission('create_blog') && (
            <Button
              icon={showForm ? X : Plus}
              onClick={() => (showForm ? resetForm() : setShowForm(true))}
              className="btn-apple text-xs"
            >
              {showForm ? 'Close Editor' : 'New Article'}
            </Button>
          )}
        </CardHeader>

        {showForm && (
          <div className="px-6 py-6 bg-[#F5F5F7] border-b border-[#E5E5EA]">
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-1.5">
                    Article Title
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Development Log: Graphics Engine Overhaul"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E5E5EA] text-sm text-[#1D1D1F] focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 outline-none transition-all"
                  />
                </div>

                {/* Content Editor with Formatting Toolbar & Preview Tabs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider">
                      Article Content & Illustrations
                    </label>

                    {/* Editor Tabs: Write vs Live Preview */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E5E5EA] text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setEditorTab('write')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                          editorTab === 'write'
                            ? 'bg-[#1D1D1F] text-white shadow-xs'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        <Edit3 size={13} />
                        <span>Write</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorTab('preview')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                          editorTab === 'preview'
                            ? 'bg-[#1D1D1F] text-white shadow-xs'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        <Eye size={13} />
                        <span>Live Preview</span>
                      </button>
                    </div>
                  </div>

                  {editorTab === 'write' ? (
                    <div className="rounded-2xl border border-[#E5E5EA] bg-white overflow-hidden shadow-xs focus-within:border-[#FF6600] focus-within:ring-2 focus-within:ring-[#FF6600]/20 transition-all">
                      {/* Rich Formatting Toolbar */}
                      <div className="p-2 border-b border-[#F5F5F7] bg-[#FBFBFD] flex items-center justify-between flex-wrap gap-1.5 text-xs">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => insertText('**', '**', 'texte en gras')}
                            title="Texte en gras"
                            className="p-2 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors font-bold"
                          >
                            <Bold size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => insertText('*', '*', 'texte en italique')}
                            title="Texte en italique"
                            className="p-2 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors italic"
                          >
                            <Italic size={14} />
                          </button>
                          <div className="h-4 w-px bg-[#E5E5EA] mx-1" />
                          <button
                            type="button"
                            onClick={() => insertText('## ', '\n', 'Titre de section')}
                            title="Titre H2"
                            className="p-2 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors font-semibold"
                          >
                            <Heading2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => insertText('### ', '\n', 'Sous-titre')}
                            title="Sous-titre H3"
                            className="p-2 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors font-semibold"
                          >
                            <Heading3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => insertText('> ', '\n', 'Blockquote text')}
                            title="Blockquote"
                            className="p-2 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors"
                          >
                            <Quote size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => insertText('- ', '\n', 'List item')}
                            title="Bullet List"
                            className="p-2 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors"
                          >
                            <List size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => insertText('[', '](https://...)', 'link text')}
                            title="Insert Link"
                            className="p-2 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors"
                          >
                            <LinkIcon size={14} />
                          </button>
                        </div>

                        {/* Image insertion button with special badge */}
                        <button
                          type="button"
                          onClick={() => setImageModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6600]/10 hover:bg-[#FF6600]/20 text-[#FF6600] font-semibold text-xs transition-colors"
                        >
                          <ImagePlus size={14} />
                          <span>Insert Image into Article</span>
                        </button>
                      </div>

                      <textarea
                        ref={textareaRef}
                        value={form.content}
                        onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                        rows={12}
                        placeholder="Write your article content here... Use the formatting toolbar above or insert images with custom rounded corners!"
                        required
                        className="w-full p-4 text-sm text-[#1D1D1F] leading-relaxed font-sans outline-none resize-y min-h-[220px]"
                      />
                    </div>
                  ) : (
                    /* Live Preview Box */
                    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 sm:p-8 shadow-sm min-h-[260px]">
                      <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#F5F5F7] text-xs text-[#86868B]">
                        <Sparkles size={14} className="text-[#FF6600]" />
                        <span>Real-time preview of player rendering</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] mb-4">
                        {form.title || 'Untitled'}
                      </h2>
                      <BlogContentRenderer content={form.content} />
                    </div>
                  )}
                </div>

                {/* Cover Image Header */}
                <div>
                  <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                    Article Cover Image
                  </p>
                  <div className="flex items-center gap-4">
                    {form.image_url ? (
                      <div className="relative group">
                        <img
                          src={form.image_url.startsWith('/') ? `${API_URL}${form.image_url}` : form.image_url}
                          alt="Cover preview"
                          className="rounded-2xl w-28 h-20 object-cover border border-[#E5E5EA] shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, image_url: '' }))}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow"
                          title="Remove cover"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-28 h-20 rounded-2xl border border-dashed border-[#E5E5EA] flex items-center justify-center text-[#86868B] bg-white">
                        <ImageIcon size={22} />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" icon={Upload} loading={uploading} as="span">
                        {uploading ? 'Uploading…' : form.image_url ? 'Replace Cover' : 'Upload Cover'}
                      </Button>
                      <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Access Restriction */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">
                    Access Level & Visibility
                  </p>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, allowed_roles: [] }))}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                        form.allowed_roles.length === 0
                          ? 'bg-[#FF6600]/15 text-[#FF6600] border-[#FF6600]/40 shadow-xs'
                          : 'bg-white text-[#6E6E73] border-[#E5E5EA] hover:border-[#FF6600]/30'
                      }`}
                    >
                      <Globe size={14} />
                      Public (Visible to all visitors)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (form.allowed_roles.length === 0) {
                          setForm((p) => ({ ...p, allowed_roles: ['admin', 'moderator'] }));
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                        form.allowed_roles.length > 0
                          ? 'bg-amber-500/15 text-amber-600 border-amber-500/40 shadow-xs'
                          : 'bg-white text-[#6E6E73] border-[#E5E5EA] hover:border-amber-500/30'
                      }`}
                    >
                      <Lock size={14} />
                      Restricted by Role (Confidential)
                    </button>
                  </div>

                  {form.allowed_roles.length > 0 && (
                    <div className="p-4 rounded-xl bg-white border border-[#E5E5EA] space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#6E6E73]">
                        <span>Roles authorized to read this article:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, allowed_roles: availableRoles.map((r) => r.id) }))}
                            className="text-[11px] font-medium text-[#FF6600] hover:underline"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, allowed_roles: [] }))}
                            className="text-[11px] font-medium text-[#86868B] hover:underline"
                          >
                            Make public
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableRoles.map((role) => {
                          const isSelected = form.allowed_roles.includes(role.id);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => toggleRole(role.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                                isSelected
                                  ? 'bg-white border-transparent text-[#1D1D1F] shadow-sm ring-2'
                                  : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F]'
                              }`}
                              style={isSelected ? { ringColor: role.color || '#FF6600' } : {}}
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: role.color || '#FF6600' }}
                              />
                              <span>{role.name}</span>
                              {isSelected && <Check size={12} className="ml-1 text-[#1D1D1F]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Published Checkbox & Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.published}
                      onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
                      className="w-4 h-4 rounded text-[#FF6600] focus:ring-[#FF6600]"
                    />
                    <span className="text-xs font-medium text-[#1D1D1F]">
                      Publish this article immediately on the website
                    </span>
                  </label>

                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={resetForm} type="button">
                      Cancel
                    </Button>
                    <Button icon={Save} loading={loading} type="submit" className="btn-apple text-xs">
                      {editing ? 'Save Changes' : 'Create & Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Posts Table */}
        <CardBody className="p-0">
          {posts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No devlog articles"
              description="Write your first studio devlog article."
              action={
                hasPermission('create_blog') && (
                  <Button icon={Plus} onClick={() => setShowForm(true)} className="btn-apple text-xs">
                    Create an article
                  </Button>
                )
              }
            />
          ) : (
            <div className="divide-y divide-[#F5F5F7]">
              {posts.map((post) => (
                <div key={post.slug} className="p-5 flex items-center justify-between gap-4 hover:bg-[#F5F5F7]/50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    {post.image_url ? (
                      <img
                        src={post.image_url.startsWith('/') ? `${API_URL}${post.image_url}` : post.image_url}
                        alt=""
                        className="w-14 h-14 rounded-2xl object-cover border border-[#E5E5EA] shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#86868B] shrink-0">
                        <FileText size={20} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm text-[#1D1D1F] truncate">{post.title}</h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                            post.published ? 'bg-[#30D158]/10 text-[#28a745]' : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {post.published ? 'Published' : 'Draft'}
                        </span>
                        {post.allowed_roles?.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                            <Lock size={10} />
                            {post.allowed_roles.length} role(s)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#86868B] truncate">
                        Created on{' '}
                        {new Date(post.created_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(post)}
                      className="p-2 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(post.slug, post.title)}
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── MODAL: INSERT IMAGE WITH ROUNDED CORNERS ─────────────────── */}
      {imageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-appear">
          <div className="bg-white rounded-3xl border border-[#E5E5EA] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#F5F5F7] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
                  <ImagePlus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F]">Insert Image into Article</h3>
                  <p className="text-[11px] text-[#86868B]">Upload and customize rounded border styling</p>
                </div>
              </div>
              <button
                onClick={() => setImageModalOpen(false)}
                className="p-1 rounded-lg text-[#86868B] hover:text-[#1D1D1F] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* File Upload / URL */}
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-1.5">
                  Image File
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inlineUrl}
                    onChange={(e) => setInlineUrl(e.target.value)}
                    placeholder="Image URL or upload from your device"
                    className="flex-1 px-3 py-2 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-xs text-[#1D1D1F] focus:border-[#FF6600] outline-none"
                  />
                  <label className="cursor-pointer">
                    <Button variant="secondary" size="sm" icon={Upload} loading={inlineUploading} as="span">
                      {inlineUploading ? 'Uploading...' : 'Browse'}
                    </Button>
                    <input type="file" accept="image/*" onChange={handleInlineUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Preview with selected rounded borders */}
              {inlineUrl && (
                <div className="p-3 bg-[#F5F5F7] rounded-2xl text-center">
                  <p className="text-[10px] uppercase font-semibold text-[#86868B] mb-2">Selected Style Preview</p>
                  <div className="inline-block max-w-full">
                    <img
                      src={inlineUrl.startsWith('/') ? `${API_URL}${inlineUrl}` : inlineUrl}
                      alt="Preview"
                      className={`max-h-40 mx-auto object-cover border border-[#E5E5EA] shadow-sm ${inlineRounded}`}
                    />
                  </div>
                </div>
              )}

              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-1.5">
                  Image Caption (Optional)
                </label>
                <input
                  type="text"
                  value={inlineCaption}
                  onChange={(e) => setInlineCaption(e.target.value)}
                  placeholder="e.g. In-game screenshot of the new atmospheric map"
                  className="w-full px-3 py-2 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-xs text-[#1D1D1F] focus:border-[#FF6600] outline-none"
                />
              </div>

              {/* Rounded Borders Options */}
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-1.5">
                  Rounded Corner Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROUNDED_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setInlineRounded(opt.id)}
                      className={`p-2.5 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-all ${
                        inlineRounded === opt.id
                          ? 'border-[#FF6600] bg-[#FF6600]/10 text-[#FF6600] font-semibold'
                          : 'border-[#E5E5EA] bg-white text-[#6E6E73] hover:border-[#D2D2D7]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <div className={`w-4 h-4 border border-current ${opt.preview}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Alignment */}
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider mb-1.5">
                  Layout Alignment
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ALIGN_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setInlineAlign(opt.id)}
                      className={`p-2 rounded-xl text-xs font-medium border text-center transition-all ${
                        inlineAlign === opt.id
                          ? 'border-[#FF6600] bg-[#FF6600]/10 text-[#FF6600] font-semibold'
                          : 'border-[#E5E5EA] bg-white text-[#6E6E73] hover:border-[#D2D2D7]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#FBFBFD] border-t border-[#F5F5F7] flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setImageModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmInsertImage}
                disabled={!inlineUrl}
                className="btn-apple text-xs !py-2"
              >
                Insert into Article
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        loading={confirmLoading}
        onConfirm={handleConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
};
