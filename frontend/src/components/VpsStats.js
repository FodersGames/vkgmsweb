import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Cpu, Database, HardDrive, RefreshCw, Clock, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const fmt = (bytes) => {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' Go';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' Mo';
  return (bytes / 1e3).toFixed(0) + ' Ko';
};

const fmtUptime = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}min`);
  return parts.join(' ');
};

const colorFor = (pct) => {
  if (pct >= 90) return { bar: '#EB5757', text: 'text-red-500' };
  if (pct >= 70) return { bar: '#F2994A', text: 'text-orange-400' };
  return { bar: '#4ECDC4', text: 'text-[#4ECDC4]' };
};

const Gauge = ({ label, icon: Icon, percent, detail }) => {
  const { bar, text } = colorFor(percent);
  return (
    <div className="rounded-xl bg-white border border-[#D2D2D7] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-[#A1A1A6]" />
          <span className="text-xs font-semibold text-[#6E6E73] uppercase tracking-[0.1em]">{label}</span>
        </div>
        <span className={`text-lg font-bold ${text}`}>
          {percent.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: bar }}
        />
      </div>
      <p className="text-[11px] text-[#A1A1A6]">{detail}</p>
    </div>
  );
};

export const VpsStats = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
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
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1D1D1F]">
            VPS Monitor
          </h2>
          {lastUpdate && (
            <p className="text-[11px] text-[#A1A1A6] mt-0.5 flex items-center gap-1">
              <Clock size={10} />
              Mis à jour à {lastUpdate.toLocaleTimeString('fr-FR')} — actualisation auto toutes les 10s
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D2D2D7] px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Actualiser
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {!stats && loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[#4ECDC4]" />
        </div>
      )}

      {stats && (
        <>
          {/* Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Gauge
              label="CPU"
              icon={Cpu}
              percent={stats.cpu.percent}
              detail={`${stats.cpu.count} cœurs logiques`}
            />
            <Gauge
              label="RAM"
              icon={Database}
              percent={stats.ram.percent}
              detail={`${fmt(stats.ram.used)} / ${fmt(stats.ram.total)} — ${fmt(stats.ram.free)} libre`}
            />
            <Gauge
              label="Stockage"
              icon={HardDrive}
              percent={stats.disk.percent}
              detail={`${fmt(stats.disk.used)} / ${fmt(stats.disk.total)} — ${fmt(stats.disk.free)} libre`}
            />
          </div>

          {/* Infos complémentaires */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
              <p className="text-[10px] font-semibold text-[#A1A1A6] uppercase tracking-[0.12em] mb-1">Uptime</p>
              <p className="text-xl font-bold text-[#1D1D1F]">
                {fmtUptime(stats.uptime_seconds)}
              </p>
              <p className="text-[11px] text-[#A1A1A6] mt-1">Depuis le dernier redémarrage</p>
            </div>

            {stats.load_avg && (
              <div className="rounded-xl bg-white border border-[#D2D2D7] p-5">
                <p className="text-[10px] font-semibold text-[#A1A1A6] uppercase tracking-[0.12em] mb-1">Charge système (load avg)</p>
                <div className="flex items-end gap-4 mt-1">
                  {['1 min', '5 min', '15 min'].map((label, i) => (
                    <div key={i}>
                      <p className="text-lg font-bold text-[#1D1D1F]">
                        {stats.load_avg[i].toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[#A1A1A6]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
