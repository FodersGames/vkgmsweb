import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Clock,
  Loader2,
  Server,
  Layers,
  ArrowUpRight,
  ExternalLink,
  Activity,
  Terminal,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const fmt = (bytes) => {
  if (bytes === undefined || bytes === null) return '0 Go';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' Go';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' Mo';
  return (bytes / 1e3).toFixed(0) + ' Ko';
};

const fmtUptime = (seconds) => {
  if (!seconds) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}min`);
  return parts.join(' ');
};

const AppleGauge = ({ label, icon: Icon, percent, valueStr, subtitle }) => {
  const isHigh = percent >= 85;
  const isMedium = percent >= 65;
  const barColor = isHigh ? '#EB5757' : isMedium ? '#FF6600' : '#30D158';

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm hover:border-[#D2D2D7] transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
              <Icon size={16} />
            </div>
            <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">{label}</span>
          </div>
          <span className="text-sm font-bold font-mono text-[#1D1D1F]">
            {percent.toFixed(0)}%
          </span>
        </div>

        <div className="h-2 w-full bg-[#F5F5F7] rounded-full overflow-hidden mb-2.5">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      <div className="flex items-baseline justify-between pt-1 border-t border-[#F5F5F7] text-xs">
        <span className="text-[#86868B] text-[11px] truncate max-w-[150px]">{subtitle}</span>
        <span className="font-medium text-[#1D1D1F]">{valueStr}</span>
      </div>
    </div>
  );
};

export const VpsStats = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await axios.get(`${API_URL}/api/admin/system/stats`, { headers });
      setStats(r.data);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.response?.data?.detail || 'Impossible de joindre le serveur.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl border border-[#E5E5EA] p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0">
            <Server size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                Serveur & Infrastructure VPS
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#30D158]/10 text-[#28a745]">
                {stats?.server_environment || 'En ligne'}
              </span>
            </div>
            <p className="text-xs text-[#86868B] mt-0.5">
              {stats?.os_info ? `${stats.os_info} · Python ${stats.python_version || ''}` : 'Métriques temps réel des ressources du système hébergeant le backend.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/status"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5F5F7] hover:bg-[#E5E5EA] text-xs font-medium text-[#1D1D1F] transition-colors border border-[#E5E5EA]"
          >
            <span>Status public</span>
            <ExternalLink size={12} className="text-[#86868B]" />
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="btn-apple text-xs !py-2 !px-3.5 inline-flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3">
          {error}
        </div>
      )}

      {!stats && loading && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#FF6600]" />
          <p className="text-xs text-[#86868B]">Interrogation des sondes système en cours...</p>
        </div>
      )}

      {stats && (
        <>
          {/* Main Gauges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AppleGauge
              label="Processeur (CPU)"
              icon={Cpu}
              percent={stats.cpu.percent}
              valueStr={`${stats.cpu.percent.toFixed(1)}%`}
              subtitle={`${stats.cpu.count} cœurs logiques`}
            />
            <AppleGauge
              label="Mémoire Vive (RAM)"
              icon={Database}
              percent={stats.ram.percent}
              valueStr={`${fmt(stats.ram.used)} / ${fmt(stats.ram.total)}`}
              subtitle={`${fmt(stats.ram.free)} libre`}
            />
            <AppleGauge
              label="Stockage Disque"
              icon={HardDrive}
              percent={stats.disk.percent}
              valueStr={`${fmt(stats.disk.used)} / ${fmt(stats.disk.total)}`}
              subtitle={`${fmt(stats.disk.free)} libre`}
            />
          </div>

          {/* Deep Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Uptime */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                <Clock size={14} className="text-[#FF6600]" />
                <span>Temps de service</span>
              </div>
              <p className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                {fmtUptime(stats.uptime_seconds)}
              </p>
              <p className="text-[11px] text-[#86868B] mt-1">
                Depuis le dernier démarrage
              </p>
            </div>

            {/* Load average */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                <Activity size={14} className="text-[#30D158]" />
                <span>Charge (Load Avg)</span>
              </div>
              <div className="flex items-baseline gap-3">
                {stats.load_avg?.map((val, idx) => (
                  <div key={idx}>
                    <p className="text-base font-bold font-mono text-[#1D1D1F]">{val.toFixed(2)}</p>
                    <p className="text-[10px] text-[#86868B]">{['1m', '5m', '15m'][idx]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Processes */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                <Layers size={14} className="text-[#007AFF]" />
                <span>Processus Actifs</span>
              </div>
              <p className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                {stats.processes_count ?? 1}
              </p>
              <p className="text-[11px] text-[#86868B] mt-1">
                Threads & workers backend
              </p>
            </div>

            {/* Network Throughput */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                <ArrowUpRight size={14} className="text-[#5856D6]" />
                <span>Réseau (E/S)</span>
              </div>
              {stats.net_io ? (
                <div className="text-xs">
                  <p className="font-semibold text-[#1D1D1F]">
                    ▲ {fmt(stats.net_io.bytes_sent)} · ▼ {fmt(stats.net_io.bytes_recv)}
                  </p>
                  <p className="text-[11px] text-[#86868B] mt-1">Total paquets transférés</p>
                </div>
              ) : (
                <div className="text-xs">
                  <p className="font-semibold text-[#30D158]">Actif (Edge HTTP)</p>
                  <p className="text-[11px] text-[#86868B] mt-1">SSL chiffré TLS 1.3</p>
                </div>
              )}
            </div>
          </div>

          {/* Environmental information card */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
                <Terminal size={16} />
              </div>
              <div>
                <p className="font-semibold text-[#1D1D1F]">Système d'exploitation & Runtime</p>
                <p className="text-[#86868B] text-[11px]">
                  {stats.os_info} · Python {stats.python_version}
                </p>
              </div>
            </div>
            {lastUpdate && (
              <span className="text-[11px] text-[#86868B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
                Dernière mesure : {lastUpdate.toLocaleTimeString('fr-FR')} (refresh auto 10s)
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
