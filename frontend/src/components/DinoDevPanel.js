import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Gamepad2, Gift, ShieldAlert, Wrench, History, Search, Check, Copy,
  User, RefreshCw, Key, AlertTriangle, Sparkles, Gem, Dna, Lock, Unlock,
  Plus, Minus, Trash2, Send, ExternalLink, HelpCircle, Flame, Egg, Box,
  Clock, Calendar, Power, Radio, CheckCircle2, XCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

export const getItemIcon = (id, type) => {
  if (!id) return null;
  const cleanId = String(id).trim();

  // Currencies
  if (cleanId === 'gems' || cleanId === 'gem' || cleanId === 'Amber') return '/dino-assets/icons/gems.png';
  if (cleanId === 'dna' || cleanId === 'DNA') return '/dino-assets/icons/dna.png';
  if (cleanId === 'gold' || cleanId === 'coins') return '/dino-assets/icons/gold.png';
  if (cleanId === 'gift') return '/dino-assets/icons/gift.png';

  // Eggs
  if (cleanId.includes('EGG') || type === 'egg') {
    return `/dino-assets/eggs/${cleanId}.png`;
  }

  // Chests
  if (cleanId.startsWith('Chest') || type === 'chest') {
    return `/dino-assets/chests/${cleanId}.png`;
  }

  // Materials & Blueprints Map
  const itemMap = {
    'Item_AmberStone': '/dino-assets/items/Amber.png',
    'Item_AmberVial': '/dino-assets/items/AmberVial.png',
    'Item_BlueprintT1': '/dino-assets/items/PlanT1.png',
    'Item_BlueprintT2': '/dino-assets/items/PlanT2.png',
    'Item_BlueprintT3': '/dino-assets/items/PlanT3.png',
    'Item_BlueprintLab': '/dino-assets/items/Item_LabMicroscope.png',
    'Item_SandCementBag': '/dino-assets/items/Item_SandCementBag.png',
    'Item_TitaniumIngot': '/dino-assets/items/Item_TitaniumIngot.png',
    'Item_ReinforcedBone': '/dino-assets/items/Item_ReinforcedBone.png',
    'Item_MeteoriteShard': '/dino-assets/items/Item_MeteoriteShard.png',
    'Item_VolcanicBasalt': '/dino-assets/items/Item_VolcanicBasalt.png',
    'Item_OpticalLens': '/dino-assets/items/Item_OpticalLens.png',
    'Item_PetrifiedWood': '/dino-assets/items/Item_PetrifiedWood.png',
    'Item_BraidedVines': '/dino-assets/items/Item_BraidedVines.png',
  };
  if (itemMap[cleanId]) return itemMap[cleanId];
  if (type === 'item') {
    return `/dino-assets/items/${cleanId}.png`;
  }

  // Default: Dinos
  return `/dino-assets/dinos/${cleanId}.png`;
};

export const ItemImage = ({ src, alt, className = "w-8 h-8", fallbackIcon: FallbackIcon }) => {
  const [error, setError] = useState(!src);

  useEffect(() => {
    setError(!src);
  }, [src]);

  if (error || !src) {
    return FallbackIcon ? <FallbackIcon size={16} className="text-[#FF6600]" /> : null;
  }
  return (
    <img
      src={src}
      alt={alt || "item"}
      className={`${className} object-contain`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

export const DinoDevPanel = () => {
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState('gift'); // 'gift' | 'player' | 'maintenance' | 'logs'
  const [config, setConfig] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Secret Key Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Confirm dialog
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null });

  // ── 1. Gift Tab State ────────────────────────────────────────────────────────
  const [targetPlayFabId, setTargetPlayFabId] = useState('');
  const [giftMessage, setGiftMessage] = useState('A special reward from the Vakar Games dev team!');
  const [giftGems, setGiftGems] = useState(500);
  const [giftDna, setGiftDna] = useState(100000);
  const [selectedDinos, setSelectedDinos] = useState({}); // { "T-Rex": 1 }
  const [selectedEggs, setSelectedEggs] = useState({}); // { "T1-EGG": 1 }
  const [selectedChests, setSelectedChests] = useState({}); // { "ChestT1": 1 }
  const [selectedItems, setSelectedItems] = useState({}); // { "Item_AmberStone": 5 }
  const [dinoSearch, setDinoSearch] = useState('');
  const [sendingGift, setSendingGift] = useState(false);

  // ── 2. Player Inspector Tab State ───────────────────────────────────────────
  const [inspectId, setInspectId] = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [banReasonInput, setBanReasonInput] = useState('');
  const [showBanModal, setShowBanModal] = useState(false);

  // ── 3. Maintenance Tab State ────────────────────────────────────────────────
  const [maintStatus, setMaintStatus] = useState({
    is_maintenance: false,
    effective_active: false,
    raw_is_maintenance: false,
    is_scheduled: false,
    scheduled_maintenance_utc: 'none',
    maintenance_message: 'Nos serveurs sont actuellement en cours de maintenance. Toutes nos excuses pour la gêne occasionnée.',
    seconds_until_scheduled: null,
  });
  const [maintMessageInput, setMaintMessageInput] = useState('Nos serveurs sont actuellement en cours de maintenance. Toutes nos excuses pour la gêne occasionnée.');
  const [scheduleDelayMinutes, setScheduleDelayMinutes] = useState(30);
  const [scheduleCustomMinutes, setScheduleCustomMinutes] = useState('');
  const [scheduleCustomDate, setScheduleCustomDate] = useState('');
  const [scheduleMode, setScheduleMode] = useState('preset'); // 'preset' | 'custom_min' | 'custom_date'
  const [countdownStr, setCountdownStr] = useState('');
  const [loadingMaint, setLoadingMaint] = useState(false);
  const [savingMaint, setSavingMaint] = useState(false);
  const [cancelingMaint, setCancelingMaint] = useState(false);

  // ── 4. History Tab State ────────────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  useEffect(() => {
    fetchConfig();
    fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dino/config`, { headers: authHeaders });
      setConfig(res.data);
    } catch (err) {
      toast.error('Failed to load PlayFab configuration');
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/dino/catalog`, { headers: authHeaders });
      setCatalog(res.data);
    } catch (err) {
      console.error('Failed to load dino catalog', err);
    }
  };

  const handleSaveSecretKey = async (e) => {
    e.preventDefault();
    if (!newSecretKey.trim()) {
      toast.error('Please enter a secret key');
      return;
    }
    setSavingKey(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/dino/config`,
        { secret_key: newSecretKey.trim() },
        { headers: authHeaders }
      );
      toast.success('PlayFab Developer Secret Key configured successfully!');
      setShowKeyModal(false);
      setNewSecretKey('');
      fetchConfig();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save secret key');
    } finally {
      setSavingKey(false);
    }
  };

  // ── Gift Actions ────────────────────────────────────────────────────────────
  const toggleDinoSelect = (dinoId) => {
    setSelectedDinos(prev => {
      const updated = { ...prev };
      if (updated[dinoId]) delete updated[dinoId];
      else updated[dinoId] = 1;
      return updated;
    });
  };

  const updateDinoCount = (dinoId, delta) => {
    setSelectedDinos(prev => {
      const current = prev[dinoId] || 0;
      const next = current + delta;
      const updated = { ...prev };
      if (next <= 0) delete updated[dinoId];
      else updated[dinoId] = next;
      return updated;
    });
  };

  const updateEggCount = (eggId, delta) => {
    setSelectedEggs(prev => {
      const current = prev[eggId] || 0;
      const next = current + delta;
      const updated = { ...prev };
      if (next <= 0) delete updated[eggId];
      else updated[eggId] = next;
      return updated;
    });
  };

  const updateChestCount = (chestId, delta) => {
    setSelectedChests(prev => {
      const current = prev[chestId] || 0;
      const next = current + delta;
      const updated = { ...prev };
      if (next <= 0) delete updated[chestId];
      else updated[chestId] = next;
      return updated;
    });
  };

  const updateItemCount = (itemId, delta) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || 0;
      const next = current + delta;
      const updated = { ...prev };
      if (next <= 0) delete updated[itemId];
      else updated[itemId] = next;
      return updated;
    });
  };

  const handleSendGift = async (e) => {
    e.preventDefault();
    if (!targetPlayFabId.trim()) {
      toast.error('Target Player PlayFab ID is required');
      return;
    }

    const dinosList = Object.entries(selectedDinos).map(([name, count]) => ({ name, count }));
    const eggsList = Object.entries(selectedEggs).map(([eggName, count]) => ({ eggName, count }));
    const chestsList = Object.entries(selectedChests).map(([chestName, count]) => ({ chestName, count }));
    const itemsList = Object.entries(selectedItems).map(([id, count]) => ({ id, count }));

    const hasAnyReward =
      dinosList.length > 0 ||
      eggsList.length > 0 ||
      chestsList.length > 0 ||
      itemsList.length > 0 ||
      giftGems > 0 ||
      giftDna > 0;

    if (!hasAnyReward) {
      toast.error('Please configure at least one reward (Gems, DNA, Dino, Egg, Chest, or Item)');
      return;
    }

    setSendingGift(true);
    try {
      const payload = {
        playfab_id: targetPlayFabId.trim(),
        dino_name: dinosList.length === 1 ? dinosList[0].name : null,
        dinos: dinosList.length > 0 ? dinosList : null,
        gems: parseInt(giftGems, 10) || 0,
        dna: parseFloat(giftDna) || 0,
        message: giftMessage.trim(),
        items: itemsList.length > 0 ? itemsList : null,
        eggs: eggsList.length > 0 ? eggsList : null,
        chests: chestsList.length > 0 ? chestsList : null,
      };

      const res = await axios.post(`${API_URL}/api/admin/dino/gift`, payload, { headers: authHeaders });
      toast.success(res.data?.message || 'Gift successfully sent to player!');
      // Reset selected gifts
      setSelectedDinos({});
      setSelectedEggs({});
      setSelectedChests({});
      setSelectedItems({});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send gift');
    } finally {
      setSendingGift(false);
    }
  };

  // ── Player Lookup Actions ───────────────────────────────────────────────────
  const handleInspectPlayer = async (e) => {
    if (e) e.preventDefault();
    if (!inspectId.trim()) return;

    setInspectLoading(true);
    setPlayerData(null);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dino/player/${inspectId.trim()}`, { headers: authHeaders });
      setPlayerData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Player not found on PlayFab');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleBanSubmit = async () => {
    if (!banReasonInput.trim()) {
      toast.error('Please provide a reason for the ban');
      return;
    }
    try {
      await axios.post(
        `${API_URL}/api/admin/dino/player/${inspectId.trim()}/ban`,
        { reason: banReasonInput.trim() },
        { headers: authHeaders }
      );
      toast.success(`Player ${inspectId} has been suspended/banned`);
      setShowBanModal(false);
      setBanReasonInput('');
      handleInspectPlayer();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to ban player');
    }
  };

  const handleUnbanClick = () => {
    setDialog({
      open: true,
      title: 'Unban Player',
      description: `Are you sure you want to lift the suspension for player "${inspectId}"?`,
      onConfirm: async () => {
        try {
          await axios.post(
            `${API_URL}/api/admin/dino/player/${inspectId.trim()}/unban`,
            {},
            { headers: authHeaders }
          );
          toast.success('Player unbanned successfully');
          handleInspectPlayer();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Failed to unban player');
        }
      },
    });
  };

  // ── Maintenance Actions ─────────────────────────────────────────────────────
  const fetchMaintenance = async () => {
    setLoadingMaint(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dino/maintenance`, { headers: authHeaders });
      setMaintStatus(res.data);
      if (res.data.maintenance_message) {
        setMaintMessageInput(res.data.maintenance_message);
      }
    } catch (err) {
      toast.error('Failed to load in-game maintenance status');
    } finally {
      setLoadingMaint(false);
    }
  };

  useEffect(() => {
    if (!maintStatus?.is_scheduled || !maintStatus?.scheduled_maintenance_utc || maintStatus?.scheduled_maintenance_utc === 'none') {
      setCountdownStr('');
      return;
    }

    const updateTimer = () => {
      const targetTime = new Date(maintStatus.scheduled_maintenance_utc).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setCountdownStr('Starting now...');
        fetchMaintenance();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setCountdownStr(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdownStr(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintStatus]);

  const handleReopenServers = () => {
    setDialog({
      open: true,
      title: 'Reopen Game Servers',
      description: 'Are you sure you want to lift maintenance and reopen the game servers immediately to all mobile players?',
      onConfirm: async () => {
        setSavingMaint(true);
        try {
          const res = await axios.post(
            `${API_URL}/api/admin/dino/maintenance`,
            { action: 'cancel' },
            { headers: authHeaders }
          );
          setMaintStatus(res.data);
          toast.success('Servers reopened: Mobile game is now LIVE!');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Failed to reopen servers');
        } finally {
          setSavingMaint(false);
        }
      },
    });
  };

  const handleImmediateCut = () => {
    setDialog({
      open: true,
      title: 'Trigger Immediate In-Game Maintenance',
      description: 'This will immediately disconnect and lock out all iOS & Android players with the maintenance screen. Are you sure?',
      onConfirm: async () => {
        setSavingMaint(true);
        try {
          const res = await axios.post(
            `${API_URL}/api/admin/dino/maintenance`,
            {
              action: 'immediate',
              maintenance_message: maintMessageInput.trim(),
            },
            { headers: authHeaders }
          );
          setMaintStatus(res.data);
          toast.success('Immediate maintenance enabled! Game service cut.');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Failed to enable maintenance');
        } finally {
          setSavingMaint(false);
        }
      },
    });
  };

  const handleCancelSchedule = async () => {
    setCancelingMaint(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dino/maintenance`,
        { action: 'cancel' },
        { headers: authHeaders }
      );
      setMaintStatus(res.data);
      toast.success('Scheduled maintenance cancelled: Game remains ONLINE');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel schedule');
    } finally {
      setCancelingMaint(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setSavingMaint(true);
    try {
      let payload = {
        action: 'schedule',
        maintenance_message: maintMessageInput.trim(),
      };

      if (scheduleMode === 'preset') {
        payload.delay_minutes = scheduleDelayMinutes;
      } else if (scheduleMode === 'custom_min') {
        const mins = parseFloat(scheduleCustomMinutes);
        if (!mins || mins <= 0) {
          toast.error('Please enter a delay greater than 0 minutes');
          setSavingMaint(false);
          return;
        }
        payload.delay_minutes = mins;
      } else if (scheduleMode === 'custom_date') {
        if (!scheduleCustomDate) {
          toast.error('Please select a date and time');
          setSavingMaint(false);
          return;
        }
        payload.scheduled_maintenance_utc = new Date(scheduleCustomDate).toISOString();
      }

      const res = await axios.post(
        `${API_URL}/api/admin/dino/maintenance`,
        payload,
        { headers: authHeaders }
      );
      setMaintStatus(res.data);
      toast.success('In-Game Maintenance scheduled successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule maintenance');
    } finally {
      setSavingMaint(false);
    }
  };

  // ── History Actions ─────────────────────────────────────────────────────────
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dino/history`, { headers: authHeaders });
      setLogs(res.data?.logs || []);
    } catch (err) {
      toast.error('Failed to load audit history');
    } finally {
      setLoadingLogs(false);
    }
  };

  const filteredDinos = useMemo(() => {
    if (!catalog?.dinos) return [];
    if (!dinoSearch.trim()) return catalog.dinos;
    return catalog.dinos.filter(d =>
      d.name.toLowerCase().includes(dinoSearch.toLowerCase()) ||
      d.tier.toLowerCase().includes(dinoSearch.toLowerCase())
    );
  }, [catalog, dinoSearch]);

  return (
    <div className="space-y-6">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600]">
              <Gamepad2 size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                Idle Dino Clicker Tycoon — Dev Panel
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                  PlayFab Title: {config?.title_id || '1C8E49'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                  Super Admin Only
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PlayFab Secret Key Configuration Button */}
        <button
          type="button"
          onClick={() => setShowKeyModal(true)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
            config?.has_secret_key
              ? 'bg-white dark:bg-[#151520] border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-white hover:bg-black/[0.04]'
              : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm animate-pulse'
          }`}
        >
          <Key size={14} />
          <span>{config?.has_secret_key ? 'PlayFab Key Configured' : 'Configure PlayFab Secret Key'}</span>
        </button>
      </div>

      {/* Secret Key Warning if missing */}
      {!loadingConfig && !config?.has_secret_key && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">PlayFab Developer Secret Key Required</p>
            <p className="leading-relaxed">
              To send in-game gifts, inspect players, ban/unban, or toggle remote maintenance, enter your PlayFab Developer Secret Key from Title <b>1C8E49</b> (PlayFab Dashboard &rarr; Title Settings &rarr; Secret Keys).
            </p>
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="mt-2 inline-flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-100 underline"
            >
              Enter Secret Key &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── Subtabs Navigation ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-b border-[#E5E5EA] dark:border-[#2a2a3c] pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('gift')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'gift'
              ? 'bg-[#FF6600] text-white shadow-xs'
              : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
          }`}
        >
          <Gift size={14} />
          <span>Gifts & Rewards Dispatcher</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('player'); if (inspectId) handleInspectPlayer(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'player'
              ? 'bg-[#FF6600] text-white shadow-xs'
              : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
          }`}
        >
          <Search size={14} />
          <span>Player Inspector & Moderation</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('maintenance'); fetchMaintenance(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'maintenance'
              ? 'bg-[#FF6600] text-white shadow-xs'
              : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
          }`}
        >
          <Wrench size={14} />
          <span>Remote Game Maintenance</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('logs'); fetchLogs(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'logs'
              ? 'bg-[#FF6600] text-white shadow-xs'
              : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
          }`}
        >
          <History size={14} />
          <span>Dev Audit Logs</span>
        </button>
      </div>

      {/* ── TAB 1: GIFTS DISPATCHER ────────────────────────────── */}
      {activeTab === 'gift' && (
        <form onSubmit={handleSendGift} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Gift Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Target Player Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <User size={16} className="text-[#FF6600]" />
                <span>1. Target Player</span>
              </h2>

              <div>
                <label className="block text-xs font-semibold text-[#86868B] dark:text-[#71717a] uppercase tracking-wider mb-1.5">
                  PlayFab ID *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 7F48BA9210C7 or paste from user complaint"
                    value={targetPlayFabId}
                    onChange={(e) => setTargetPlayFabId(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600] font-mono"
                  />
                  {targetPlayFabId && (
                    <button
                      type="button"
                      onClick={() => { setInspectId(targetPlayFabId); setActiveTab('player'); handleInspectPlayer(); }}
                      className="px-3 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] hover:bg-[#E5E5EA] text-xs font-semibold text-[#1D1D1F] dark:text-white transition-colors"
                      title="Inspect this player"
                    >
                      Inspect
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#86868B] dark:text-[#71717a] uppercase tracking-wider mb-1.5">
                  In-Game Popup Message
                </label>
                <input
                  type="text"
                  placeholder="e.g. Compensation for maintenance, or Discord giveaway reward!"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>

            {/* Currencies Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-5">
              <h2 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-[#FF6600]" />
                <span>2. Currencies (Gems & DNA)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gems */}
                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                      <ItemImage src="/dino-assets/icons/gems.png" alt="Gems" className="w-5 h-5" fallbackIcon={Gem} />
                      <span>Gems / Amber</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{giftGems.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={giftGems}
                    onChange={(e) => setGiftGems(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#3a3a4c] text-sm font-mono font-semibold text-[#1D1D1F] dark:text-white"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[100, 500, 1000, 5000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setGiftGems(prev => prev + val)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#151520] hover:bg-black/[0.05] text-[11px] font-semibold text-[#6E6E73] dark:text-[#a1a1aa]"
                      >
                        +{val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setGiftGems(0)}
                      className="px-2 py-1 rounded-lg hover:bg-red-50 text-[11px] font-semibold text-red-500"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* DNA */}
                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                      <ItemImage src="/dino-assets/icons/dna.png" alt="DNA" className="w-5 h-5" fallbackIcon={Dna} />
                      <span>DNA Bank</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                      +{giftDna.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={giftDna}
                    onChange={(e) => setGiftDna(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#3a3a4c] text-sm font-mono font-semibold text-[#1D1D1F] dark:text-white"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[10000, 100000, 1000000, 10000000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setGiftDna(prev => prev + val)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#151520] hover:bg-black/[0.05] text-[11px] font-semibold text-[#6E6E73] dark:text-[#a1a1aa]"
                      >
                        +{val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}K`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setGiftDna(0)}
                      className="px-2 py-1 rounded-lg hover:bg-red-50 text-[11px] font-semibold text-red-500"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dinos Selector Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                    <Flame size={16} className="text-[#FF6600]" />
                    <span>3. Dinosaurs (24 Official Dinos)</span>
                  </h2>
                  <p className="text-xs text-[#86868B] mt-0.5">Click any dinosaur to select and add to gift package</p>
                </div>

                <div className="w-48">
                  <input
                    type="text"
                    placeholder="Search dino..."
                    value={dinoSearch}
                    onChange={(e) => setDinoSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
                {filteredDinos.map((dino) => {
                  const isSelected = !!selectedDinos[dino.id];
                  const count = selectedDinos[dino.id] || 0;
                  const iconSrc = dino.icon || getItemIcon(dino.id, 'dino');

                  return (
                    <div
                      key={dino.id}
                      onClick={() => toggleDinoSelect(dino.id)}
                      className={`p-3 rounded-2xl border cursor-pointer select-none transition-all flex flex-col justify-between group ${
                        isSelected
                          ? 'border-[#FF6600] bg-[#FF6600]/10 text-[#1D1D1F] dark:text-white shadow-xs'
                          : 'border-[#E5E5EA] dark:border-[#2a2a3c] hover:border-[#FF6600]/50 bg-[#F5F5F7] dark:bg-[#1e1e2d]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase font-bold text-[#FF6600] truncate">
                            {dino.tier}
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#FF6600] text-white flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>

                        {/* Dino Sprite Icon */}
                        <div className="flex flex-col items-center text-center my-1">
                          <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-[#151520]/80 border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                            <ItemImage
                              src={iconSrc}
                              alt={dino.name}
                              className="w-12 h-12"
                              fallbackIcon={Flame}
                            />
                          </div>
                          <p className="text-xs font-bold text-[#1D1D1F] dark:text-white mt-1.5 truncate max-w-full">
                            {dino.name}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-[#FF6600]/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateDinoCount(dino.id, -1)}
                            className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05] text-xs font-bold"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-xs font-bold font-mono">x{count}</span>
                          <button
                            type="button"
                            onClick={() => updateDinoCount(dino.id, 1)}
                            className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05] text-xs font-bold"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Eggs & Chests & Items Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-5">
              <h2 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <Box size={16} className="text-[#FF6600]" />
                <span>4. Eggs, Chests & Supplies</span>
              </h2>

              {/* Eggs */}
              <div>
                <label className="block text-xs font-bold text-[#86868B] uppercase tracking-wider mb-2">
                  Dino Eggs (Hatch automatically on claim)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(catalog?.eggs || []).map((egg) => {
                    const count = selectedEggs[egg.id] || 0;
                    const iconSrc = egg.icon || getItemIcon(egg.id, 'egg');
                    return (
                      <div
                        key={egg.id}
                        className="p-2.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-center p-1 shrink-0">
                            <ItemImage
                              src={iconSrc}
                              alt={egg.name}
                              className="w-8 h-8"
                              fallbackIcon={Egg}
                            />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-[#1D1D1F] dark:text-white truncate">{egg.name}</p>
                            <span className="text-[10px] text-[#FF6600] font-semibold">Tier {egg.tier}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => updateEggCount(egg.id, -1)}
                              className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05]"
                            >
                              <Minus size={10} />
                            </button>
                          )}
                          <span className={`text-xs font-bold font-mono px-1.5 ${count > 0 ? 'text-[#FF6600]' : 'text-[#86868B]'}`}>
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateEggCount(egg.id, 1)}
                            className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05]"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chests */}
              <div>
                <label className="block text-xs font-bold text-[#86868B] uppercase tracking-wider mb-2">
                  Chests (Open automatically on claim)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(catalog?.chests || []).map((ch) => {
                    const count = selectedChests[ch.id] || 0;
                    const iconSrc = ch.icon || getItemIcon(ch.id, 'chest');
                    return (
                      <div
                        key={ch.id}
                        className="p-2.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-center p-1 shrink-0">
                            <ItemImage
                              src={iconSrc}
                              alt={ch.name}
                              className="w-8 h-8"
                              fallbackIcon={Box}
                            />
                          </div>
                          <p className="text-xs font-bold text-[#1D1D1F] dark:text-white truncate">{ch.name}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => updateChestCount(ch.id, -1)}
                              className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05]"
                            >
                              <Minus size={10} />
                            </button>
                          )}
                          <span className={`text-xs font-bold font-mono px-1.5 ${count > 0 ? 'text-[#FF6600]' : 'text-[#86868B]'}`}>
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateChestCount(ch.id, 1)}
                            className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05]"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Items */}
              <div>
                <label className="block text-xs font-bold text-[#86868B] uppercase tracking-wider mb-2">
                  Materials & Blueprints
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(catalog?.items || []).map((it) => {
                    const count = selectedItems[it.id] || 0;
                    const iconSrc = it.icon || getItemIcon(it.id, 'item');
                    return (
                      <div
                        key={it.id}
                        className="p-2.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-center p-1 shrink-0">
                            <ItemImage
                              src={iconSrc}
                              alt={it.name}
                              className="w-8 h-8"
                              fallbackIcon={Box}
                            />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-[#1D1D1F] dark:text-white truncate">{it.name}</p>
                            <span className="text-[10px] text-[#86868B] truncate block">{it.desc}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => updateItemCount(it.id, -1)}
                              className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05]"
                            >
                              <Minus size={10} />
                            </button>
                          )}
                          <span className={`text-xs font-bold font-mono px-1.5 ${count > 0 ? 'text-[#FF6600]' : 'text-[#86868B]'}`}>
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItemCount(it.id, 1)}
                            className="p-1 rounded-md bg-white dark:bg-[#151520] hover:bg-black/[0.05]"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Basket Preview & Send Button */}
          <div className="space-y-6">
            <div className="sticky top-20 p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-4">
              <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center justify-between">
                <span>Gift Package Summary</span>
                <Gift size={18} className="text-[#FF6600]" />
              </h3>

              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <span className="text-[#86868B] block mb-0.5">Target Player</span>
                  <p className="font-mono font-bold text-[#1D1D1F] dark:text-white truncate">
                    {targetPlayFabId || '<No ID specified>'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#E5E5EA] dark:border-[#2a2a3c] space-y-2">
                  <span className="text-[#86868B] font-semibold block mb-1">Included Rewards:</span>

                  {giftGems > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl">
                      <span className="flex items-center gap-1.5">
                        <ItemImage src="/dino-assets/icons/gems.png" className="w-4 h-4" />
                        <span>Gems</span>
                      </span>
                      <span className="font-mono font-bold">+{giftGems.toLocaleString()}</span>
                    </div>
                  )}

                  {giftDna > 0 && (
                    <div className="flex items-center justify-between text-purple-600 font-semibold bg-purple-50 dark:bg-purple-950/30 p-2 rounded-xl">
                      <span className="flex items-center gap-1.5">
                        <ItemImage src="/dino-assets/icons/dna.png" className="w-4 h-4" />
                        <span>DNA</span>
                      </span>
                      <span className="font-mono font-bold">+{giftDna.toLocaleString()}</span>
                    </div>
                  )}

                  {Object.entries(selectedDinos).map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between text-[#1D1D1F] dark:text-white font-medium p-1.5 rounded-lg bg-[#F5F5F7] dark:bg-[#1e1e2d]">
                      <span className="flex items-center gap-2 truncate mr-2">
                        <ItemImage src={getItemIcon(name, 'dino')} className="w-5 h-5" fallbackIcon={Flame} />
                        <span className="truncate">{name}</span>
                      </span>
                      <span className="font-mono font-bold shrink-0">x{count}</span>
                    </div>
                  ))}

                  {Object.entries(selectedEggs).map(([id, count]) => (
                    <div key={id} className="flex items-center justify-between text-[#1D1D1F] dark:text-white font-medium p-1.5 rounded-lg bg-[#F5F5F7] dark:bg-[#1e1e2d]">
                      <span className="flex items-center gap-2 truncate mr-2">
                        <ItemImage src={getItemIcon(id, 'egg')} className="w-5 h-5" fallbackIcon={Egg} />
                        <span className="truncate">{id}</span>
                      </span>
                      <span className="font-mono font-bold shrink-0">x{count}</span>
                    </div>
                  ))}

                  {Object.entries(selectedChests).map(([id, count]) => (
                    <div key={id} className="flex items-center justify-between text-[#1D1D1F] dark:text-white font-medium p-1.5 rounded-lg bg-[#F5F5F7] dark:bg-[#1e1e2d]">
                      <span className="flex items-center gap-2 truncate mr-2">
                        <ItemImage src={getItemIcon(id, 'chest')} className="w-5 h-5" fallbackIcon={Box} />
                        <span className="truncate">{id}</span>
                      </span>
                      <span className="font-mono font-bold shrink-0">x{count}</span>
                    </div>
                  ))}

                  {Object.entries(selectedItems).map(([id, count]) => (
                    <div key={id} className="flex items-center justify-between text-[#1D1D1F] dark:text-white font-medium p-1.5 rounded-lg bg-[#F5F5F7] dark:bg-[#1e1e2d]">
                      <span className="flex items-center gap-2 truncate mr-2">
                        <ItemImage src={getItemIcon(id, 'item')} className="w-5 h-5" fallbackIcon={Box} />
                        <span className="truncate">{id}</span>
                      </span>
                      <span className="font-mono font-bold shrink-0">x{count}</span>
                    </div>
                  ))}

                  {giftGems === 0 && giftDna === 0 &&
                    Object.keys(selectedDinos).length === 0 &&
                    Object.keys(selectedEggs).length === 0 &&
                    Object.keys(selectedChests).length === 0 &&
                    Object.keys(selectedItems).length === 0 && (
                      <p className="text-[#86868B] italic">No rewards selected yet</p>
                    )}
                </div>

                <div className="pt-2 border-t border-[#E5E5EA] dark:border-[#2a2a3c]">
                  <span className="text-[#86868B] block mb-0.5">Popup Note</span>
                  <p className="text-[11px] text-[#6E6E73] dark:text-[#a1a1aa] italic bg-[#F5F5F7] dark:bg-[#1e1e2d] p-2.5 rounded-xl">
                    "{giftMessage}"
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={sendingGift || !targetPlayFabId.trim()}
                className="w-full py-3.5 rounded-2xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-bold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
              >
                {sendingGift ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Dispatching via PlayFab...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Dispatch Gift to Player</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB 2: PLAYER INSPECTOR & MODERATION ────────────────── */}
      {activeTab === 'player' && (
        <div className="space-y-6 max-w-4xl">
          {/* Lookup Input */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
            <h2 className="text-base font-bold text-[#1D1D1F] dark:text-white mb-2 flex items-center gap-2">
              <Search size={16} className="text-[#FF6600]" />
              <span>Inspect Any Player Profile & Mod Controls</span>
            </h2>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mb-4">
              Query the live cloud profile directly from PlayFab Title <b>1C8E49</b>.
            </p>

            <form onSubmit={handleInspectPlayer} className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="Enter PlayFab ID (e.g. 7F48BA9210C7)..."
                value={inspectId}
                onChange={(e) => setInspectId(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white font-mono focus:outline-none focus:border-[#FF6600]"
              />
              <button
                type="submit"
                disabled={inspectLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
              >
                {inspectLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                <span>Inspect Player</span>
              </button>
            </form>
          </div>

          {/* Player Results Card */}
          {playerData && (
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-6 animate-appear">
              {/* Top Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E5E5EA] dark:border-[#2a2a3c]">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-lg font-bold font-mono text-[#1D1D1F] dark:text-white">
                      ID: {playerData.playfab_id}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      playerData.is_banned
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}>
                      {playerData.is_banned ? 'SUSPENDED / BANNED' : 'ACTIVE / IN GOOD STANDING'}
                    </span>
                  </div>
                  {playerData.is_banned && playerData.ban_reason && (
                    <p className="text-xs text-red-600 font-medium">
                      Ban Reason: {playerData.ban_reason}
                    </p>
                  )}
                  <p className="text-xs text-[#86868B] mt-0.5">
                    Last Cloud Sync: <b>{playerData.last_sync}</b>
                  </p>
                </div>

                {/* Moderation Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setTargetPlayFabId(playerData.playfab_id); setActiveTab('gift'); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6600]/10 hover:bg-[#FF6600]/20 text-[#FF6600] text-xs font-semibold transition-colors"
                  >
                    <Gift size={13} />
                    <span>Send Gift</span>
                  </button>

                  {playerData.is_banned ? (
                    <button
                      type="button"
                      onClick={handleUnbanClick}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors"
                    >
                      <Unlock size={13} />
                      <span>Unban Player</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowBanModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors"
                    >
                      <Lock size={13} />
                      <span>Ban Player</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c]">
                  <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                    DNA Bank
                  </span>
                  <div className="flex items-center gap-2">
                    <ItemImage src="/dino-assets/icons/dna.png" alt="DNA" className="w-6 h-6" fallbackIcon={Dna} />
                    <p className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
                      {playerData.player_dna || '0'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c]">
                  <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                    Gems Stash
                  </span>
                  <div className="flex items-center gap-2">
                    <ItemImage src="/dino-assets/icons/gems.png" alt="Gems" className="w-6 h-6" fallbackIcon={Gem} />
                    <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {playerData.player_gems || '0'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c]">
                  <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                    Rebirth Level
                  </span>
                  <p className="text-lg font-bold text-[#1D1D1F] dark:text-white">
                    Level {playerData.rebirth_level || '1'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c]">
                  <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
                    Total Dinos
                  </span>
                  <p className="text-lg font-bold text-[#1D1D1F] dark:text-white">
                    {playerData.total_dinos || '0'}
                  </p>
                </div>
              </div>

              {/* Dinos and Inventory details */}
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs space-y-2">
                  <span className="font-bold text-[#1D1D1F] dark:text-white block">Equipped Dinos:</span>
                  <div className="flex flex-wrap gap-2">
                    {playerData.equipped_dinos && playerData.equipped_dinos !== 'None' ? (
                      playerData.equipped_dinos.split(',').map((d, i) => {
                        const clean = d.trim();
                        const icon = getItemIcon(clean, 'dino');
                        return (
                          <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs font-semibold">
                            <ItemImage src={icon} className="w-5 h-5" fallbackIcon={Flame} />
                            <span>{clean}</span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[#86868B] italic">None</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs space-y-2">
                  <span className="font-bold text-[#1D1D1F] dark:text-white block">Owned Dinos Collection:</span>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                    {playerData.owned_dinos && playerData.owned_dinos !== 'None' ? (
                      playerData.owned_dinos.split(',').map((d, i) => {
                        const clean = d.trim();
                        const baseName = clean.split('x')[0].trim();
                        const icon = getItemIcon(baseName, 'dino');
                        return (
                          <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs font-semibold">
                            <ItemImage src={icon} className="w-5 h-5" fallbackIcon={Flame} />
                            <span>{clean}</span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[#86868B] italic">None</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs space-y-2">
                  <span className="font-bold text-[#1D1D1F] dark:text-white block">Inventory Items:</span>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                    {playerData.inventory_items && playerData.inventory_items !== 'Empty bag' ? (
                      playerData.inventory_items.split(',').map((item, i) => {
                        const clean = item.trim();
                        const baseId = clean.split('x')[0].trim();
                        const icon = getItemIcon(baseId, 'item');
                        return (
                          <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs font-semibold">
                            <ItemImage src={icon} className="w-5 h-5" fallbackIcon={Box} />
                            <span>{clean}</span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[#86868B] italic">Empty bag</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: IN-GAME REMOTE MAINTENANCE ──────────────────── */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6 max-w-4xl">
          {/* Status & Immediate Control Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E5EA] dark:border-[#2a2a3c]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600]">
                  <Wrench size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1D1D1F] dark:text-white">
                    Idle Dino Clicker Tycoon — Remote Maintenance
                  </h2>
                  <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                    Real-time PlayFab TitleData maintenance switch & automated scheduler
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchMaintenance}
                className="p-2 rounded-xl hover:bg-black/[0.04] text-[#86868B] self-end sm:self-center"
                title="Refresh status from PlayFab"
              >
                <RefreshCw size={15} className={loadingMaint ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingMaint ? (
              <div className="p-12 text-center text-[#86868B]">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#FF6600]" />
                Checking live PlayFab TitleData status...
              </div>
            ) : (
              <>
                {/* Status Indicator Card */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  maintStatus.effective_active
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-900 dark:text-red-200'
                    : maintStatus.is_scheduled
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            maintStatus.effective_active ? 'bg-red-500' : maintStatus.is_scheduled ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}></span>
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${
                            maintStatus.effective_active ? 'bg-red-600' : maintStatus.is_scheduled ? 'bg-amber-600' : 'bg-emerald-600'
                          }`}></span>
                        </span>
                        <h3 className="text-sm font-bold tracking-wide uppercase">
                          {maintStatus.effective_active
                            ? 'Game Maintenance is ACTIVE (Service Cut)'
                            : maintStatus.is_scheduled
                            ? 'Maintenance SCHEDULED (Countdown Active)'
                            : 'Game Servers ONLINE (Normal Operation)'}
                        </h3>
                      </div>
                      <p className="text-xs opacity-90 leading-relaxed">
                        {maintStatus.effective_active
                          ? 'All iOS & Android players attempting to launch the game are blocked by the maintenance screen.'
                          : maintStatus.is_scheduled
                          ? 'In-game countdown is active. Game will lock automatically when the timer reaches zero.'
                          : 'Mobile players around the world can launch and play the game with cloud save normally.'}
                      </p>
                    </div>

                    {/* Immediate Action Buttons */}
                    <div className="shrink-0 flex items-center gap-2">
                      {maintStatus.effective_active ? (
                        <button
                          type="button"
                          onClick={handleReopenServers}
                          disabled={savingMaint}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} />
                          <span>Reopen Servers (Set Online)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleImmediateCut}
                          disabled={savingMaint}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                          <Power size={15} />
                          <span>Trigger Immediate Maintenance</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scheduled Alert Banner (if scheduled) */}
                {maintStatus.is_scheduled && (
                  <div className="p-5 rounded-2xl bg-[#FFF8EE] dark:bg-[#251b14] border border-[#FFE2C2] dark:border-[#52331b] space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[#D95700] dark:text-[#FFA043] font-bold text-sm">
                          <Clock size={16} />
                          <span>Scheduled Maintenance Countdown</span>
                        </div>
                        <p className="text-xs text-[#86868B] mt-0.5">
                          Target UTC: <b className="font-mono text-[#1D1D1F] dark:text-white">{maintStatus.scheduled_maintenance_utc}</b>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="px-4 py-2 rounded-xl bg-white dark:bg-[#151520] border border-[#FFE2C2] dark:border-[#52331b] text-center">
                          <span className="text-[10px] uppercase font-bold text-[#86868B] block">Starts in</span>
                          <span className="text-base font-mono font-bold text-[#D95700] dark:text-[#FFA043]">
                            {countdownStr || 'Calculating...'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleCancelSchedule}
                          disabled={cancelingMaint}
                          className="px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-900/40 transition-colors"
                        >
                          {cancelingMaint ? 'Canceling...' : 'Cancel Schedule'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/60 dark:bg-black/20 text-xs text-[#1D1D1F] dark:text-white">
                      <span className="font-bold text-[#86868B] block mb-0.5">Player Screen Notice:</span>
                      <p className="italic font-medium">"{maintStatus.maintenance_message}"</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Schedule New Maintenance Section */}
          <form onSubmit={handleScheduleSubmit} className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <Calendar size={16} className="text-[#FF6600]" />
                <span>Schedule In-Game Maintenance Window</span>
              </h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-1">
                Program a maintenance cut with an in-game countdown banner displayed to all players ahead of time.
              </p>
            </div>

            {/* Delay Presets Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                Select Delay / Execution Time
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: '+5 Minutes', mins: 5 },
                  { label: '+15 Minutes', mins: 15 },
                  { label: '+30 Minutes', mins: 30 },
                  { label: '+60 Minutes (1h)', mins: 60 },
                  { label: '+2 Hours', mins: 120 },
                ].map(preset => (
                  <button
                    key={preset.mins}
                    type="button"
                    onClick={() => { setScheduleMode('preset'); setScheduleDelayMinutes(preset.mins); }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                      scheduleMode === 'preset' && scheduleDelayMinutes === preset.mins
                        ? 'bg-[#FF6600] text-white border-[#FF6600] shadow-xs'
                        : 'bg-[#F5F5F7] dark:bg-[#1e1e2d] border-[#E5E5EA] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-white hover:bg-[#E5E5EA]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setScheduleMode('custom_min')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    scheduleMode === 'custom_min'
                      ? 'bg-[#FF6600] text-white border-[#FF6600] shadow-xs'
                      : 'bg-[#F5F5F7] dark:bg-[#1e1e2d] border-[#E5E5EA] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-white hover:bg-[#E5E5EA]'
                  }`}
                >
                  Custom Minutes
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleMode('custom_date')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    scheduleMode === 'custom_date'
                      ? 'bg-[#FF6600] text-white border-[#FF6600] shadow-xs'
                      : 'bg-[#F5F5F7] dark:bg-[#1e1e2d] border-[#E5E5EA] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-white hover:bg-[#E5E5EA]'
                  }`}
                >
                  Pick Date & Time
                </button>
              </div>

              {/* Custom Minutes Input */}
              {scheduleMode === 'custom_min' && (
                <div className="pt-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter minutes (e.g. 45)..."
                    value={scheduleCustomMinutes}
                    onChange={(e) => setScheduleCustomMinutes(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white font-mono focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              )}

              {/* Date & Time Picker */}
              {scheduleMode === 'custom_date' && (
                <div className="pt-2">
                  <input
                    type="datetime-local"
                    value={scheduleCustomDate}
                    onChange={(e) => setScheduleCustomDate(e.target.value)}
                    className="w-full sm:w-72 px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white font-mono focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                Maintenance Notice Message (Displayed to Mobile Players)
              </label>
              <textarea
                rows={3}
                required
                value={maintMessageInput}
                onChange={(e) => setMaintMessageInput(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600] resize-y"
              />
              <p className="text-[11px] text-[#86868B]">
                This message will be shown on player screens when disconnected or viewing the countdown.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#86868B]">
                PlayFab Title: <b className="font-mono text-[#1D1D1F] dark:text-white">{config?.title_id || '1C8E49'}</b>
              </span>

              <button
                type="submit"
                disabled={savingMaint}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
              >
                {savingMaint ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Synchronizing PlayFab...</span>
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    <span>Schedule In-Game Maintenance</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 4: AUDIT LOGS ──────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-4 max-w-4xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA] dark:border-[#2a2a3c]">
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <History size={16} className="text-[#FF6600]" />
                <span>Developer Action History</span>
              </h2>
              <p className="text-xs text-[#86868B]">Audit log of gifts, bans, and maintenance changes</p>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              className="p-2 rounded-xl hover:bg-black/[0.04] text-[#86868B]"
              title="Refresh logs"
            >
              <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingLogs ? (
            <div className="p-12 text-center text-[#86868B]">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-[#86868B] italic">No dev actions recorded yet.</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {logs.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#1D1D1F] dark:text-white">{item.message}</p>
                    <span className="text-[11px] text-[#86868B]">By @{item.user || 'superadmin'}</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#86868B]">
                    {new Date(item.timestamp).toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Ban Player Modal ───────────────────────────────────── */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151520] rounded-3xl p-6 sm:p-7 max-w-md w-full border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Lock size={18} />
              <span>Suspend Player {inspectId}</span>
            </h3>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed">
              The player will be immediately disconnected and blocked from playing until unbanned.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-1">
                Reason (Displayed in-game to player) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Memory manipulation / Speed hacking detected"
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBanModal(false)}
                className="px-4 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] text-xs font-semibold text-[#6E6E73]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBanSubmit}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PlayFab Key Setup Modal ────────────────────────────── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSecretKey}
            className="bg-white dark:bg-[#151520] rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <Key size={18} className="text-[#FF6600]" />
                <span>Configure PlayFab Developer Secret Key</span>
              </h3>
            </div>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed">
              To authenticate server requests for Title <b>{config?.title_id || '1C8E49'}</b>, enter the Developer Secret Key from your PlayFab dashboard (Title Settings &rarr; Secret Keys).
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-1">
                Developer Secret Key *
              </label>
              <input
                type="password"
                required
                placeholder="Paste PlayFab secret key..."
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white font-mono focus:outline-none focus:border-[#FF6600]"
              />
              {config?.has_secret_key && (
                <span className="text-[11px] text-emerald-600 font-mono mt-1 block">
                  Current key: {config.masked_key}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] text-xs font-semibold text-[#6E6E73]"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={savingKey}
                className="px-5 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {savingKey ? 'Saving...' : 'Save Secret Key'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        onConfirm={dialog.onConfirm}
        onClose={() => setDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
};

