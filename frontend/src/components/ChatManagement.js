import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import { MessageSquare, Trash2, RefreshCw, Key, Copy, ShieldAlert, Plus, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ChatManagement = () => {
  const { token, hasPermission } = useAuth();
  const { selectedProject, fetchProjects } = useProject();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bannedWords, setBannedWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [showBannedWords, setShowBannedWords] = useState(false);
  const canManage = hasPermission('manage_chat');

  const fetchMessages = useCallback(async (slug) => {
    if (!slug) return;
    try {
      const r = await axios.get(`${API_URL}/api/projects/${slug}/chat?limit=100`);
      setMessages(r.data.messages);
    } catch (e) { console.error(e); }
  }, []);

  const fetchBannedWords = useCallback(async () => {
    if (!canManage) return;
    try {
      const r = await axios.get(`${API_URL}/api/website/chat/banned-words`, { headers: { Authorization: `Bearer ${token}` } });
      setBannedWords(r.data.words);
    } catch (e) { console.error(e); }
    // eslint-disable-next-line
  }, [token, canManage]);

  useEffect(() => { fetchBannedWords(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (selectedProject) fetchMessages(selectedProject.slug); }, [selectedProject, fetchMessages]);

  useEffect(() => {
    if (!selectedProject) return;
    const interval = setInterval(() => fetchMessages(selectedProject.slug), 5000);
    return () => clearInterval(interval);
  }, [selectedProject, fetchMessages]);

  const handleDeleteMessage = async (messageId) => {
    if (!selectedProject) return;
    try {
      await axios.delete(`${API_URL}/api/projects/${selectedProject.slug}/chat/${messageId}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(p => p.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (e) { toast.error('Failed to delete message'); }
  };

  const handleRegenerateKey = async () => {
    if (!selectedProject) return;
    if (!window.confirm('Regenerate the chat API key? The old key will stop working immediately — update it in your TurboWarp project.')) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/projects/${selectedProject.slug}/chat/regenerate-key`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Chat API key regenerated');
      await fetchProjects();
      // Update local key copy without waiting on context refresh timing
      selectedProject.chat_api_key = r.data.chat_api_key;
      setMessages(m => [...m]); // force re-render
    } catch (e) { toast.error('Failed to regenerate key'); }
    finally { setLoading(false); }
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
    try {
      await axios.put(`${API_URL}/api/website/chat/banned-words`, { words: updated }, { headers: { Authorization: `Bearer ${token}` } });
      setBannedWords(updated);
      setNewWord('');
      toast.success('Word added');
    } catch (e) { toast.error('Failed to update list'); }
  };

  const removeBannedWord = async (word) => {
    const updated = bannedWords.filter(w => w !== word);
    try {
      await axios.put(`${API_URL}/api/website/chat/banned-words`, { words: updated }, { headers: { Authorization: `Bearer ${token}` } });
      setBannedWords(updated);
    } catch (e) { toast.error('Failed to update list'); }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="bg-[#151520] rounded-xl border border-[#2a2a3c] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a3c] flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#9B51E0] to-[#BB6BD9] flex items-center justify-center"><MessageSquare size={16} className="text-white" /></div>
            <div><h3 className="text-base font-semibold text-[#e4e4e7]">Game Chat</h3><p className="text-xs text-[#71717a]">In-game global chat for {selectedProject?.name || 'this project'}</p></div>
          </div>
        </div>

        {!selectedProject ? (
          <div className="text-center py-12 text-[#71717a]">Select a project to manage its chat.</div>
        ) : (
          <>
            {/* API key panel */}
            {canManage && (
              <div className="p-6 border-b border-[#2a2a3c] bg-[#1c1c2e]">
                <div className="flex items-center gap-2 mb-2">
                  <Key size={13} className="text-[#9B51E0]" />
                  <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">Chat API Key — {selectedProject.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#0d0d14] border border-[#2a2a3c] rounded-lg px-3 py-2 text-xs text-[#e4e4e7] font-mono truncate">
                    {selectedProject.chat_api_key || 'No key — regenerate to create one'}
                  </code>
                  <button onClick={copyKey} disabled={!selectedProject.chat_api_key} className="p-2.5 border border-[#2a2a3c] hover:border-[#4ECDC4]/30 rounded-lg text-[#71717a] hover:text-[#4ECDC4] transition-all disabled:opacity-30" data-testid="copy-chat-key"><Copy size={14} /></button>
                  <button onClick={handleRegenerateKey} disabled={loading} className="p-2.5 border border-[#2a2a3c] hover:border-[#F2994A]/30 rounded-lg text-[#71717a] hover:text-[#F2994A] transition-all" data-testid="regenerate-chat-key"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
                </div>
                <p className="text-[11px] text-[#71717a] mt-2">Send this key in the <code className="text-[#9B51E0]">X-Chat-Api-Key</code> header when posting from TurboWarp. Regenerating invalidates the old key immediately.</p>
              </div>
            )}

            {/* Messages */}
            <div className="p-6">
              <div className="text-xs font-semibold text-[#71717a] mb-4 uppercase tracking-wider">Messages ({messages.length})</div>
              {messages.length === 0 ? (
                <div className="text-center py-12 text-[#71717a]">No messages yet.</div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto" data-testid="chat-messages-list">
                  {messages.map(m => (
                    <div key={m.id} className="bg-[#1c1c2e] border border-[#2a2a3c] rounded-lg px-4 py-2.5 flex items-start justify-between gap-3 group">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-[#4ECDC4]">{m.username}</span>
                          <span className="text-[10px] text-[#52525b]">{formatTime(m.timestamp)}</span>
                        </div>
                        <p className="text-sm text-[#e4e4e7] break-words">{m.message}</p>
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
            </div>
          </>
        )}
      </div>

      {/* Banned words (global) */}
      {canManage && (
        <div className="bg-[#151520] rounded-xl border border-[#2a2a3c] overflow-hidden">
          <button onClick={() => setShowBannedWords(!showBannedWords)} className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-[#1c1c2e]/50 transition-all" data-testid="toggle-banned-words">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#EB5757] to-[#F2994A] flex items-center justify-center"><ShieldAlert size={16} className="text-white" /></div>
              <div className="text-left"><h3 className="text-base font-semibold text-[#e4e4e7]">Banned Words</h3><p className="text-xs text-[#71717a]">Global list, applies to every project's chat</p></div>
            </div>
            <span className="text-xs text-[#71717a]">{bannedWords.length} word{bannedWords.length !== 1 ? 's' : ''}</span>
          </button>

          {showBannedWords && (
            <div className="p-6 border-t border-[#2a2a3c]">
              <div className="flex gap-2 mb-4">
                <input type="text" value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBannedWord()}
                  placeholder="Add a banned word..."
                  className="flex-1 bg-[#0d0d14] border border-[#2a2a3c] text-[#e4e4e7] rounded-lg text-sm px-3 py-2.5 focus:border-[#4ECDC4] focus:outline-none"
                  data-testid="banned-word-input" />
                <button onClick={addBannedWord} className="bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-2" data-testid="add-banned-word"><Plus size={14} /> Add</button>
              </div>
              {bannedWords.length === 0 ? (
                <p className="text-sm text-[#71717a]">No banned words yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="banned-words-list">
                  {bannedWords.map(w => (
                    <span key={w} className="inline-flex items-center gap-1.5 bg-[#0d0d14] border border-[#2a2a3c] rounded-full pl-3 pr-1.5 py-1 text-xs text-[#e4e4e7]">
                      {w}
                      <button onClick={() => removeBannedWord(w)} className="p-0.5 hover:text-red-400 text-[#71717a] transition-all"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-[#71717a] mt-3">Matching is case-insensitive and whole-word. A detected word is replaced with asterisks matching its length (e.g. <code className="text-[#9B51E0]">con</code> → <code className="text-[#9B51E0]">***</code>).</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
