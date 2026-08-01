import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import {
  FileText, Search, RefreshCw, ChevronLeft, ChevronRight, X,
  HardDrive, Database, ShoppingBag, Activity, MessageSquare,
  ClipboardList, ShieldAlert, Gift, Package, Trash2, Flag,
} from 'lucide-react';
import api from '../utils/api';
import { EmptyState } from '../ui';

const TYPE_META = {
  files:           { label: 'Files',     icon: HardDrive,     color: '#4ECDC4' },
  variable_action: { label: 'Variables', icon: Database,      color: '#2F80ED' },
  shop:            { label: 'Shop',      icon: ShoppingBag,   color: '#F2994A' },
  status:          { label: 'Status',    icon: Activity,      color: '#F2C94C' },
  chat:            { label: 'Chat',      icon: MessageSquare, color: '#9B51E0' },
  missions:        { label: 'Missions',  icon: ClipboardList, color: '#27AE60' },
  player:          { label: 'Players',   icon: ShieldAlert,   color: '#EB5757' },
  send:            { label: 'Sent',      icon: Gift,          color: '#4ECDC4' },
  claim:           { label: 'Claims',    icon: Package,       color: '#6E6E73' },
  delete:          { label: 'Deleted',   icon: Trash2,        color: '#EB5757' },
  project:         { label: 'Project',   icon: Flag,          color: '#6C5CE7' },
};

const ALL_TYPES = Object.keys(TYPE_META);
// "claim" fires on every single gift pickup — high volume, low signal. Opt-in rather than on by default.
const DEFAULT_TYPES = ALL_TYPES.filter(t => t !== 'claim');

const metaFor = (type) => TYPE_META[type] || { label: type, icon: FileText, color: '#6E6E73' };

const timeAgo = (iso) => {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const exactTime = (iso) => {
  try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return iso; }
};

const TypeChip = ({ type, active, onClick }) => {
  const { label, icon: Icon, color } = metaFor(type);
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border transition-colors"
      style={active
        ? { backgroundColor: `${color}18`, borderColor: color, color }
        : { backgroundColor: 'transparent', borderColor: 'var(--chip-border, #D2D2D7)', color: '#A1A1A6' }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
};

export const LogsViewer = () => {
  const { selectedProject } = useProject();
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTypes, setActiveTypes] = useState(new Set(DEFAULT_TYPES));
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (activeTypes.size && activeTypes.size < ALL_TYPES.length) {
        p.append('log_type', Array.from(activeTypes).join(','));
      }
      if (search) p.append('search', search);
      p.append('limit', limit);
      p.append('page', page);
      const r = await api.get(`/api/projects/${selectedProject.slug}/logs?${p}`);
      setLogs(r.data.logs || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch { /* handled globally by the api interceptor */ }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, activeTypes, search, page]);

  useEffect(() => { setPage(1); }, [selectedProject, activeTypes, search]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleType = (type) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const allActive = activeTypes.size === ALL_TYPES.length;
  const toggleAll = () => setActiveTypes(new Set(allActive ? [] : ALL_TYPES));

  if (!selectedProject) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-lg w-10 h-10 bg-[#9B51E0]/10 flex items-center justify-center">
            <FileText size={20} className="text-[#9B51E0]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Activity Logs</h1>
            <p className="text-xs text-[#A1A1A6]">{total} event{total !== 1 ? 's' : ''} — {selectedProject.name}</p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="rounded-xl inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#111118] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6]" />
        <input
          type="text"
          placeholder="Search log messages..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="rounded-lg w-full pl-9 pr-9 py-2.5 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 focus:border-[#4ECDC4] bg-white dark:bg-[#0d0d14] text-[#1D1D1F] dark:text-[#e4e4e7]"
        />
        {searchInput && (
          <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#1D1D1F]">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleAll}
          className={`inline-flex items-center px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
            allActive ? 'bg-[#1D1D1F] border-[#1D1D1F] text-white' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#A1A1A6]'
          }`}
        >
          All types
        </button>
        {ALL_TYPES.map(type => (
          <TypeChip key={type} type={type} active={activeTypes.has(type)} onClick={() => toggleType(type)} />
        ))}
      </div>

      {/* Timeline */}
      {logs.length === 0 && !loading ? (
        <EmptyState icon={FileText} title="No activity found" description="Try adjusting your filters, or wait for new activity on this project." />
      ) : (
        <div className="rounded-xl divide-y divide-[#EDEDEF] dark:divide-[#1c1c2e] border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#0d0d14]" data-testid="logs-list">
          {logs.map((l, i) => {
            const { label, icon: Icon, color } = metaFor(l.type);
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="w-7 h-7 flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${color}18` }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                    {l.user && <span className="text-xs text-[#6E6E73]">— {l.user}</span>}
                    <span className="text-[11px] text-[#A1A1A6] ml-auto shrink-0" title={exactTime(l.timestamp)}>
                      {timeAgo(l.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-[#1D1D1F] dark:text-[#e4e4e7] break-words">{l.message}</p>
                  {(l.uid || l.variable || l.amount != null) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {l.uid && <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F5F5F7] dark:bg-[#111118] text-[#6E6E73]">uid: {l.uid}</span>}
                      {l.variable && <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F5F5F7] dark:bg-[#111118] text-[#6E6E73]">{l.variable}</span>}
                      {l.amount != null && <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F5F5F7] dark:bg-[#111118] text-[#6E6E73]">×{l.amount}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#A1A1A6]">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#111118] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={13} /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="rounded-xl inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] hover:bg-[#F5F5F7] dark:hover:bg-[#111118] disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
