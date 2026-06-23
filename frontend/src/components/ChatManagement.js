import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { MessageSquare, Trash2, RefreshCw, Key, Copy, ShieldAlert, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import api, { API_URL } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Input, Select } from '../ui';

export const ChatManagement = () => {
  const { token, hasPermission } = useAuth();
  const { selectedProject, fetchProjects } = useProject();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bannedWords, setBannedWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [showBannedWords, setShowBannedWords] = useState(false);
  const [messageLimit, setMessageLimit] = useState(50);
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null, confirmLabel: 'Confirm' });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const canManage = hasPermission('manage_chat');

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const fetchMessages = useCallback(async (slug, limit) => {
    if (!slug) return;
    try {
      const r = await api.get(`/api/projects/${slug}/chat?limit=${limit}`);
      setMessages(r.data.messages);
    } catch (e) {}
  }, []);

  const fetchBannedWords = useCallback(async () => {
    if (!canManage) return;
    try {
      const r = await api.get(`/api/website/chat/banned-words`);
      setBannedWords(r.data.words);
    } catch (e) {}
    // eslint-disable-next-line
  }, [canManage]);

  useEffect(() => { fetchBannedWords(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (selectedProject) fetchMessages(selectedProject.slug, messageLimit); }, [selectedProject, messageLimit, fetchMessages]);
  useEffect(() => {
    if (!selectedProject) return;
    const interval = setInterval(() => fetchMessages(selectedProject.slug, messageLimit), 5000);
    return () => clearInterval(interval);
  }, [selectedProject, messageLimit, fetchMessages]);

  const handleDeleteMessage = async (messageId) => {
    if (!selectedProject) return;
    try {
      await api.delete(`/api/projects/${selectedProject.slug}/chat/${messageId}`);
      setMessages(p => p.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (e) { toast.error('Failed to delete message'); }
  };

  const handleRegenerateKey = () => {
    if (!selectedProject) return;
    showConfirm({
      title: 'Regenerate chat API key',
      description: 'The old key will stop working immediately. You will need to update it in your TurboWarp project.',
      confirmLabel: 'Regenerate',
      onConfirm: async () => {
        setLoading(true);
        try {
          const r = await api.post(`/api/projects/${selectedProject.slug}/chat/regenerate-key`, {});
          toast.success('Chat API key regenerated');
          await fetchProjects();
          selectedProject.chat_api_key = r.data.chat_api_key;
          setMessages(m => [...m]);
        } finally { setLoading(false); }
      },
    });
  };

  const copyKey = () => {
    if (!selectedProject?.chat_api_key) return;
    navigator.clipboard.writeText(selectedProject.chat_api_key);
    toast.success('API key copied');
  };

  const addBannedWord = async () => {
    const word = newWord.trim();
    if (!word) return;
    const updated = [...bannedWords, word];
    try { await api.put(`/api/website/chat/banned-words`, { words: updated }); setBannedWords(updated); setNewWord(''); toast.success('Word added'); }
    catch (e) { toast.error('Failed to update list'); }
  };

  const removeBannedWord = async (word) => {
    const updated = bannedWords.filter(w => w !== word);
    try { await api.put(`/api/website/chat/banned-words`, { words: updated }); setBannedWords(updated); }
    catch (e) { toast.error('Failed to update list'); }
  };

  const formatTime = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <>
    <div className="max-w-5xl space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#9B51E018' }}>
              <MessageSquare size={16} style={{ color: '#9B51E0' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Game Chat</h3>
              <p className="text-xs text-[#71717a]">In-game chat for {selectedProject?.name || 'this project'}</p>
            </div>
          </div>
        </CardHeader>

        {!selectedProject ? (
          <CardBody>
            <EmptyState icon={MessageSquare} title="No project selected" description="Select a project to manage its chat." />
          </CardBody>
        ) : (
          <>
            {canManage && (
              <div className="px-6 py-4 bg-zinc-50 dark:bg-[#111118] border-b border-zinc-200 dark:border-[#2a2a3c]">
                <div className="flex items-center gap-2 mb-2">
                  <Key size={12} style={{ color: '#9B51E0' }} />
                  <span className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest">
                    Chat API Key — {selectedProject.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-[#e4e4e7] font-mono truncate">
                    {selectedProject.chat_api_key || 'No key — regenerate to create one'}
                  </code>
                  <Button variant="secondary" size="sm" icon={Copy} onClick={copyKey} disabled={!selectedProject.chat_api_key} data-testid="copy-chat-key" />
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRegenerateKey} loading={loading} data-testid="regenerate-chat-key" />
                </div>
                <p className="text-[11px] text-[#71717a] mt-2">
                  Send this key in the <code className="text-[#9B51E0]">X-Chat-Api-Key</code> header when posting from TurboWarp. Regenerating invalidates the old key immediately.
                </p>
              </div>
            )}

            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-zinc-400 dark:text-[#52525b] uppercase tracking-widest">
                  Messages ({messages.length})
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#71717a]">Show last</span>
                  <Select
                    value={messageLimit}
                    onChange={e => setMessageLimit(Number(e.target.value))}
                    className="w-auto"
                    data-testid="message-limit-select"
                  >
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </div>
              </div>

              {messages.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No messages yet" description="Messages will appear here as players chat in-game." />
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto" data-testid="chat-messages-list">
                  {messages.map(m => (
                    <div key={m.id} className="flex items-start justify-between gap-3 px-3 py-2.5 bg-zinc-50 dark:bg-[#111118] border border-zinc-200 dark:border-[#2a2a3c] rounded-lg group hover:border-zinc-300 dark:hover:border-[#3a3a50] transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#4ECDC4]">{m.username}</span>
                          {m.level != null && (
                            <span className="text-[10px] font-semibold bg-[#9B51E0]/10 text-[#BB6BD9] border border-[#9B51E0]/20 rounded px-1.5 py-0.5">Lv.{m.level}</span>
                          )}
                          <span className="text-[10px] text-[#52525b]">{formatTime(m.timestamp)}</span>
                        </div>
                        <p className="text-sm text-zinc-900 dark:text-[#e4e4e7] break-words">{m.message}</p>
                      </div>
                      {canManage && (
                        <button onClick={() => handleDeleteMessage(m.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-[#71717a] hover:text-red-400 transition-all shrink-0" data-testid={`delete-message-${m.id}`}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </>
        )}
      </Card>

      {canManage && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowBannedWords(!showBannedWords)}
            className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-[#111118] transition-colors"
            data-testid="toggle-banned-words"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EB575718' }}>
                <ShieldAlert size={16} style={{ color: '#EB5757' }} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#e4e4e7]">Banned Words</h3>
                <p className="text-xs text-[#71717a]">Global list, applies to every project's chat</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71717a]">{bannedWords.length} word{bannedWords.length !== 1 ? 's' : ''}</span>
              {showBannedWords ? <ChevronUp size={14} className="text-[#71717a]" /> : <ChevronDown size={14} className="text-[#71717a]" />}
            </div>
          </button>

          {showBannedWords && (
            <CardBody className="border-t border-zinc-200 dark:border-[#2a2a3c]">
              <div className="flex gap-2 mb-4">
                <Input
                  value={newWord}
                  onChange={e => setNewWord(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBannedWord()}
                  placeholder="Add a banned word…"
                  wrapperClassName="flex-1"
                  data-testid="banned-word-input"
                />
                <Button icon={Plus} onClick={addBannedWord} data-testid="add-banned-word">Add</Button>
              </div>
              {bannedWords.length === 0 ? (
                <p className="text-sm text-[#71717a]">No banned words yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="banned-words-list">
                  {bannedWords.map(w => (
                    <span key={w} className="inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-[#0d0d14] border border-zinc-200 dark:border-[#2a2a3c] rounded-full pl-3 pr-1.5 py-1 text-xs text-zinc-900 dark:text-[#e4e4e7]">
                      {w}
                      <button onClick={() => removeBannedWord(w)} className="p-0.5 hover:text-red-400 text-[#71717a] transition-colors"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-[#71717a] mt-3 leading-relaxed">
                Matching is case-insensitive and whole-word. A detected word is replaced with asterisks (e.g. <code className="text-[#9B51E0]">con</code> → <code className="text-[#9B51E0]">***</code>).
              </p>
            </CardBody>
          )}
        </Card>
      )}
    </div>

    <ConfirmDialog
      isOpen={dialog.open}
      onClose={closeConfirm}
      onConfirm={handleConfirm}
      title={dialog.title}
      description={dialog.description}
      confirmLabel={dialog.confirmLabel || 'Confirm'}
      loading={confirmLoading}
      variant="destructive"
    />
    </>
  );
};
