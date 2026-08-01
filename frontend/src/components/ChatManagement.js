import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { toast } from 'sonner';
import {
  MessageSquare, Trash2, RefreshCw, Key, Copy, ShieldAlert, Plus, X, ChevronDown, ChevronUp,
  Ban, VolumeX, Volume2, ShieldCheck, Shield, Users, Globe,
} from 'lucide-react';
import api from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Card, CardHeader, CardBody, EmptyState, Input, Select } from '../ui';

const MUTE_PRESETS = [
  { label: '10 minutes', minutes: 10 },
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
];

export const ChatManagement = () => {
  const { hasPermission } = useAuth();
  const { selectedProject, fetchProjects } = useProject();
  const [messages, setMessages] = useState([]);
  const [channelFilter, setChannelFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [bannedWords, setBannedWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [showBannedWords, setShowBannedWords] = useState(false);
  const [messageLimit, setMessageLimit] = useState(50);
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null, confirmLabel: 'Confirm' });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const canManage = hasPermission('manage_chat');

  // Moderation
  const [showModeration, setShowModeration] = useState(false);
  const [moderation, setModeration] = useState({ bans: [], mutes: [] });
  const [chatSettings, setChatSettings] = useState({ chat_global_enabled: true, chat_guilds_enabled: true });
  const [muteTarget, setMuteTarget] = useState(null); // { userId, username }
  const [muteMinutes, setMuteMinutes] = useState(60);
  const [muteReason, setMuteReason] = useState('');
  const [muting, setMuting] = useState(false);

  // Guilds
  const [showGuilds, setShowGuilds] = useState(false);
  const [guilds, setGuilds] = useState([]);

  const showConfirm = (config) => setDialog({ ...config, open: true });
  const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
  const handleConfirm = async () => {
    if (!dialog.onConfirm) return;
    setConfirmLoading(true);
    try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
    finally { setConfirmLoading(false); }
  };

  const fetchMessages = useCallback(async (slug, limit, channel) => {
    if (!slug) return;
    try {
      const params = new URLSearchParams({ limit });
      if (channel && channel !== 'all') params.append('channel', channel);
      const r = await api.get(`/api/projects/${slug}/chat?${params}`);
      setMessages(r.data.messages);
    } catch (e) {}
  }, []);

  const fetchBannedWords = useCallback(async () => {
    if (!canManage) return;
    try {
      const r = await api.get(`/api/website/chat/banned-words`);
      setBannedWords(r.data.words);
    } catch (e) {}
  }, [canManage]);

  const fetchModeration = useCallback(async (slug) => {
    if (!slug || !canManage) return;
    try {
      const r = await api.get(`/api/admin/projects/${slug}/chat/moderation`);
      setModeration(r.data);
    } catch {}
  }, [canManage]);

  const fetchChatSettings = useCallback(async (slug) => {
    if (!slug || !canManage) return;
    try {
      const r = await api.get(`/api/admin/projects/${slug}/chat/settings`);
      setChatSettings(r.data);
    } catch {}
  }, [canManage]);

  const fetchGuilds = useCallback(async (slug) => {
    if (!slug || !canManage) return;
    try {
      const r = await api.get(`/api/admin/projects/${slug}/guilds`);
      setGuilds(r.data.guilds || []);
    } catch {}
  }, [canManage]);

  useEffect(() => { fetchBannedWords(); }, [fetchBannedWords]);
  useEffect(() => {
    if (!selectedProject) return;
    fetchMessages(selectedProject.slug, messageLimit, channelFilter);
    fetchModeration(selectedProject.slug);
    fetchChatSettings(selectedProject.slug);
    fetchGuilds(selectedProject.slug);
  }, [selectedProject, messageLimit, channelFilter, fetchMessages, fetchModeration, fetchChatSettings, fetchGuilds]);
  useEffect(() => {
    if (!selectedProject) return;
    const interval = setInterval(() => fetchMessages(selectedProject.slug, messageLimit, channelFilter), 5000);
    return () => clearInterval(interval);
  }, [selectedProject, messageLimit, channelFilter, fetchMessages]);

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

  // ── Moderation actions ─────────────────────────────────────────────────────
  const handleBlockUser = (userId, username) => {
    showConfirm({
      title: `Block ${username} from chat`,
      description: `${username} will no longer be able to send messages in this project's chat (global or guild). This does not affect their access to the game itself.`,
      confirmLabel: 'Block',
      onConfirm: async () => {
        await api.post(`/api/admin/projects/${selectedProject.slug}/chat/ban`, { user_id: userId });
        toast.success(`${username} blocked from chat`);
        fetchModeration(selectedProject.slug);
      },
    });
  };

  const handleUnblockUser = async (userId, username) => {
    try {
      await api.delete(`/api/admin/projects/${selectedProject.slug}/chat/ban/${userId}`);
      toast.success(`${username} unblocked`);
      fetchModeration(selectedProject.slug);
    } catch { toast.error('Failed to unblock'); }
  };

  const openMute = (userId, username) => { setMuteTarget({ userId, username }); setMuteMinutes(60); setMuteReason(''); };

  const submitMute = async () => {
    if (!muteTarget) return;
    setMuting(true);
    try {
      await api.post(`/api/admin/projects/${selectedProject.slug}/chat/mute`, {
        user_id: muteTarget.userId, duration_minutes: muteMinutes, reason: muteReason.trim(),
      });
      toast.success(`${muteTarget.username} muted`);
      setMuteTarget(null);
      fetchModeration(selectedProject.slug);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to mute'); }
    finally { setMuting(false); }
  };

  const handleUnmute = async (userId, username) => {
    try {
      await api.delete(`/api/admin/projects/${selectedProject.slug}/chat/mute/${userId}`);
      toast.success(`${username} unmuted`);
      fetchModeration(selectedProject.slug);
    } catch { toast.error('Failed to unmute'); }
  };

  const toggleChatSetting = async (key, label) => {
    const next = { [key]: !chatSettings[key] };
    try {
      await api.put(`/api/admin/projects/${selectedProject.slug}/chat/settings`, next);
      setChatSettings(s => ({ ...s, ...next }));
      toast.success(`${label} ${next[key] ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed to update'); }
  };

  const handleDisbandGuild = (guild) => {
    showConfirm({
      title: `Disband "${guild.name}"`,
      description: `All ${guild.member_count} member(s) will be removed and the guild's chat history deleted permanently. This cannot be undone.`,
      confirmLabel: 'Disband',
      onConfirm: async () => {
        await api.delete(`/api/admin/projects/${selectedProject.slug}/guilds/${guild.id}`);
        toast.success('Guild disbanded');
        fetchGuilds(selectedProject.slug);
      },
    });
  };

  const formatTime = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const formatUntil = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const activeMutes = moderation.mutes.filter(m => m.active);

  return (
    <>
    <div className="max-w-5xl space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#9B51E018' }}>
              <MessageSquare size={16} style={{ color: '#9B51E0' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Game Chat</h3>
              <p className="text-xs text-[#6E6E73]">In-game chat for {selectedProject?.name || 'this project'}</p>
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
              <div className="px-6 py-4 bg-[#F5F5F7] dark:bg-[#111118] border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
                <div className="flex items-center gap-2 mb-2">
                  <Key size={12} style={{ color: '#9B51E0' }} />
                  <span className="text-[11px] font-semibold text-[#A1A1A6] dark:text-[#52525b] uppercase tracking-widest">
                    Chat API Key — {selectedProject.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded-xl flex-1 bg-white dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2 text-xs text-[#1D1D1F] dark:text-[#e4e4e7] font-mono truncate">
                    {selectedProject.chat_api_key || 'No key — regenerate to create one'}
                  </code>
                  <Button variant="secondary" size="sm" icon={Copy} onClick={copyKey} disabled={!selectedProject.chat_api_key} data-testid="copy-chat-key" />
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRegenerateKey} loading={loading} data-testid="regenerate-chat-key" />
                </div>
                <p className="text-[11px] text-[#6E6E73] mt-2">
                  Send this key in the <code className="text-[#9B51E0]">X-Chat-Api-Key</code> header when posting from TurboWarp. Regenerating invalidates the old key immediately.
                </p>
              </div>
            )}

            {/* Maintenance toggles */}
            {canManage && (
              <div className="px-6 py-4 bg-[#F5F5F7] dark:bg-[#111118] border-b border-[#D2D2D7] dark:border-[#2a2a3c] flex flex-wrap gap-3">
                <button
                  onClick={() => toggleChatSetting('chat_global_enabled', 'Global chat')}
                  className={`flex-1 min-w-[220px] flex items-center gap-3 px-4 py-3 border text-left transition-colors ${
                    chatSettings.chat_global_enabled ? 'bg-white dark:bg-[#0d0d14] border-[#D2D2D7] dark:border-[#2a2a3c]' : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <Globe size={16} className={chatSettings.chat_global_enabled ? 'text-[#4ECDC4]' : 'text-red-400'} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Global Chat</p>
                    <p className="text-xs text-[#6E6E73]">{chatSettings.chat_global_enabled ? 'Live' : 'In maintenance — players cannot send'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${chatSettings.chat_global_enabled ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'bg-red-500/10 text-red-400'}`}>
                    {chatSettings.chat_global_enabled ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  onClick={() => toggleChatSetting('chat_guilds_enabled', 'Guild system')}
                  className={`flex-1 min-w-[220px] flex items-center gap-3 px-4 py-3 border text-left transition-colors ${
                    chatSettings.chat_guilds_enabled ? 'bg-white dark:bg-[#0d0d14] border-[#D2D2D7] dark:border-[#2a2a3c]' : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <Users size={16} className={chatSettings.chat_guilds_enabled ? 'text-[#4ECDC4]' : 'text-red-400'} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Guild System</p>
                    <p className="text-xs text-[#6E6E73]">{chatSettings.chat_guilds_enabled ? 'Live' : 'In maintenance — join/create/chat disabled'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${chatSettings.chat_guilds_enabled ? 'bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'bg-red-500/10 text-red-400'}`}>
                    {chatSettings.chat_guilds_enabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}

            <CardBody>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-[11px] font-semibold text-[#A1A1A6] dark:text-[#52525b] uppercase tracking-widest">
                  Messages ({messages.length})
                </p>
                <div className="flex items-center gap-3">
                  <Select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="w-auto" data-testid="channel-filter-select">
                    <option value="all">All channels</option>
                    <option value="global">Global only</option>
                    <option value="guild">Guild only</option>
                  </Select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6E6E73]">Show last</span>
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
              </div>

              {messages.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No messages yet" description="Messages will appear here as players chat in-game." />
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto" data-testid="chat-messages-list">
                  {messages.map(m => (
                    <div key={m.id} className="rounded-xl flex items-start justify-between gap-3 px-3 py-2.5 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] group hover:border-[#D2D2D7] dark:hover:border-[#3a3a50] transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#4ECDC4]">{m.username}</span>
                          {m.channel && (
                            <span className="text-[9px] font-bold uppercase tracking-wide bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] px-1.5 py-0.5 rounded">
                              {m.channel === 'guild' ? 'Guild' : 'Global'}
                            </span>
                          )}
                          {m.level != null && (
                            <span className="text-[10px] font-semibold bg-[#9B51E0]/10 text-[#BB6BD9] border border-[#9B51E0]/20 rounded px-1.5 py-0.5">Lv.{m.level}</span>
                          )}
                          <span className="text-[10px] text-[#52525b]">{formatTime(m.timestamp)}</span>
                        </div>
                        <p className="text-sm text-[#1D1D1F] dark:text-[#e4e4e7] break-words">{m.message}</p>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          {m.user_id && (
                            <>
                              <button onClick={() => openMute(m.user_id, m.username)} className="p-1.5 text-[#6E6E73] hover:text-[#F2994A] transition-colors" title="Mute" data-testid={`mute-user-${m.user_id}`}>
                                <VolumeX size={13} />
                              </button>
                              <button onClick={() => handleBlockUser(m.user_id, m.username)} className="p-1.5 text-[#6E6E73] hover:text-red-400 transition-colors" title="Block from chat" data-testid={`block-user-${m.user_id}`}>
                                <Ban size={13} />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDeleteMessage(m.id)} className="p-1.5 text-[#6E6E73] hover:text-red-400 transition-all" data-testid={`delete-message-${m.id}`}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </>
        )}
      </Card>

      {/* ── Moderation: blocked & muted players ─────────────────────────── */}
      {canManage && selectedProject && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowModeration(v => !v)}
            className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-[#F5F5F7] dark:hover:bg-[#111118] transition-colors"
            data-testid="toggle-moderation"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#EB575718' }}>
                <Ban size={16} style={{ color: '#EB5757' }} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Chat Moderation</h3>
                <p className="text-xs text-[#6E6E73]">Blocked and muted players for this project</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6E6E73]">{moderation.bans.length} blocked · {activeMutes.length} muted</span>
              {showModeration ? <ChevronUp size={14} className="text-[#6E6E73]" /> : <ChevronDown size={14} className="text-[#6E6E73]" />}
            </div>
          </button>

          {showModeration && (
            <CardBody className="border-t border-[#D2D2D7] dark:border-[#2a2a3c] space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-[#A1A1A6] uppercase tracking-widest mb-2">Blocked ({moderation.bans.length})</p>
                {moderation.bans.length === 0 ? (
                  <p className="text-sm text-[#6E6E73]">No one is blocked from chat.</p>
                ) : (
                  <div className="space-y-1.5">
                    {moderation.bans.map(b => (
                      <div key={b.user_id} className="rounded-xl flex items-center justify-between gap-3 px-3 py-2 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c]">
                        <div>
                          <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{b.username}</span>
                          <span className="text-xs text-[#A1A1A6] ml-2">blocked {formatTime(b.banned_at)}{b.banned_by ? ` by ${b.banned_by}` : ''}</span>
                        </div>
                        <Button variant="secondary" size="sm" icon={ShieldCheck} onClick={() => handleUnblockUser(b.user_id, b.username)}>Unblock</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold text-[#A1A1A6] uppercase tracking-widest mb-2">Muted ({activeMutes.length})</p>
                {activeMutes.length === 0 ? (
                  <p className="text-sm text-[#6E6E73]">No one is currently muted.</p>
                ) : (
                  <div className="space-y-1.5">
                    {activeMutes.map(m => (
                      <div key={m.user_id} className="rounded-xl flex items-center justify-between gap-3 px-3 py-2 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c]">
                        <div>
                          <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{m.username}</span>
                          <span className="text-xs text-[#A1A1A6] ml-2">until {formatUntil(m.muted_until)}{m.reason ? ` — "${m.reason}"` : ''}</span>
                        </div>
                        <Button variant="secondary" size="sm" icon={Volume2} onClick={() => handleUnmute(m.user_id, m.username)}>Unmute</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                Block or mute a player directly from a message row above by hovering over it. Blocking/muting only affects chat — it does not suspend their access to the game.
              </p>
            </CardBody>
          )}
        </Card>
      )}

      {/* ── Guilds ───────────────────────────────────────────────────────── */}
      {canManage && selectedProject && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowGuilds(v => !v)}
            className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-[#F5F5F7] dark:hover:bg-[#111118] transition-colors"
            data-testid="toggle-guilds"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#4ECDC418' }}>
                <Shield size={16} style={{ color: '#4ECDC4' }} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Guilds</h3>
                <p className="text-xs text-[#6E6E73]">Guilds created by players in this project</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6E6E73]">{guilds.length} guild{guilds.length !== 1 ? 's' : ''}</span>
              {showGuilds ? <ChevronUp size={14} className="text-[#6E6E73]" /> : <ChevronDown size={14} className="text-[#6E6E73]" />}
            </div>
          </button>

          {showGuilds && (
            <CardBody className="border-t border-[#D2D2D7] dark:border-[#2a2a3c]">
              {guilds.length === 0 ? (
                <p className="text-sm text-[#6E6E73]">No guilds have been created yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {guilds.map(g => (
                    <div key={g.id} className="rounded-xl flex items-center justify-between gap-3 px-3 py-2.5 bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${g.color}22` }}>
                          <Shield size={14} style={{ color: g.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{g.name}</p>
                          <p className="text-xs text-[#A1A1A6]">{g.member_count} member{g.member_count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDisbandGuild(g)}>Disband</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          )}
        </Card>
      )}

      {canManage && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowBannedWords(!showBannedWords)}
            className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-[#F5F5F7] dark:hover:bg-[#111118] transition-colors"
            data-testid="toggle-banned-words"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: '#EB575718' }}>
                <ShieldAlert size={16} style={{ color: '#EB5757' }} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Banned Words</h3>
                <p className="text-xs text-[#6E6E73]">Global list, applies to every project's chat</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6E6E73]">{bannedWords.length} word{bannedWords.length !== 1 ? 's' : ''}</span>
              {showBannedWords ? <ChevronUp size={14} className="text-[#6E6E73]" /> : <ChevronDown size={14} className="text-[#6E6E73]" />}
            </div>
          </button>

          {showBannedWords && (
            <CardBody className="border-t border-[#D2D2D7] dark:border-[#2a2a3c]">
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
                <p className="text-sm text-[#6E6E73]">No banned words yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="banned-words-list">
                  {bannedWords.map(w => (
                    <span key={w} className="inline-flex items-center gap-1.5 bg-[#EDEDEF] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] rounded-full pl-3 pr-1.5 py-1 text-xs text-[#1D1D1F] dark:text-[#e4e4e7]">
                      {w}
                      <button onClick={() => removeBannedWord(w)} className="p-0.5 hover:text-red-400 text-[#6E6E73] transition-colors"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-[#6E6E73] mt-3 leading-relaxed">
                Matching is case-insensitive and whole-word. A detected word is replaced with asterisks (e.g. <code className="text-[#9B51E0]">con</code> → <code className="text-[#9B51E0]">***</code>).
              </p>
            </CardBody>
          )}
        </Card>
      )}
    </div>

    {/* Mute modal */}
    {muteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D1D1F]/50">
        <div className="rounded-xl bg-white dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] w-full max-w-sm">
          <div className="px-5 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-between">
            <h3 className="font-bold text-[#1D1D1F] dark:text-[#e4e4e7] text-sm">Mute {muteTarget.username}</h3>
            <button onClick={() => setMuteTarget(null)} className="p-1 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-[#A1A1A6] uppercase tracking-widest mb-1.5">Duration</label>
              <Select value={muteMinutes} onChange={e => setMuteMinutes(Number(e.target.value))}>
                {MUTE_PRESETS.map(p => <option key={p.minutes} value={p.minutes}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#A1A1A6] uppercase tracking-widest mb-1.5">Reason (optional)</label>
              <Input value={muteReason} onChange={e => setMuteReason(e.target.value)} placeholder="Spamming, harassment…" />
            </div>
            <Button className="w-full" icon={VolumeX} loading={muting} onClick={submitMute}>Mute</Button>
          </div>
        </div>
      </div>
    )}

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
