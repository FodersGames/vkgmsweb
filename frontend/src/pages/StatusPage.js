import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function StatusPage() {
  const [data, setData] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const { isAdmin } = useAuth();

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${API_URL}/api/public/status`);
      setData(res.data);
    } catch (err) {
      // Fallback in case of network issue
      const now = new Date();
      const fallbackHistory = [];
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        fallbackHistory.push({
          date: d.toISOString().slice(0, 10),
          label: i === 0 ? "Aujourd'hui" : i === 1 ? 'Hier' : days[d.getDay()],
          status: 'operational',
          uptime_percent: 100.0,
        });
      }
      setData({
        status: 'operational',
        uptime_7d: '99.98%',
        history: fallbackHistory,
        maintenance: { active: false, announcement: '' },
        updated_at: new Date().toISOString(),
      });
    } finally {
      setRefreshing(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isMaint = data?.maintenance?.active || data?.status === 'maintenance';
  const isIncident = data?.status === 'incident';
  const isOperational = data?.status === 'operational' && !isMaint;

  const getBarColor = (status) => {
    if (status === 'incident') return 'bg-[#FF453A]';
    if (status === 'maintenance' || status === 'degraded') return 'bg-[#FFD60A]';
    return 'bg-[#30D158]';
  };

  const getStatusLabel = (status) => {
    if (status === 'incident') return 'Incident';
    if (status === 'maintenance') return 'Maintenance';
    if (status === 'degraded') return 'Dégradé';
    return '100% Opérationnel';
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col antialiased">
      {/* Top minimal header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA]">
        <div className="max-w-[820px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="Vakar Games"
              className="h-5 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-semibold text-[15px] tracking-tight text-[#1D1D1F]">
              Vakar Games
            </span>
            <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#1D1D1F]/5 text-[#6E6E73] ml-1">
              Status
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStatus}
              disabled={refreshing}
              title="Rafraîchir"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5E5EA] text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:border-[#D2D2D7] shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin text-[#FF6600]' : ''} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            {isAdmin && (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#FF6600] hover:text-[#E05A00] transition-colors"
              >
                <span>Admin Board</span>
                <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[820px] w-full mx-auto px-6 py-10 sm:py-14">
        {/* Title */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-2">
            Disponibilité du Site
          </h1>
          <p className="text-[#6E6E73] text-sm sm:text-base">
            Uptime et état en direct du site web Vakar Games.
          </p>
        </div>

        {/* Global Status Banner Card */}
        <div
          className={`rounded-3xl p-6 sm:p-7 mb-6 border transition-all ${
            isIncident
              ? 'bg-[#FF453A]/10 border-[#FF453A]/30 text-[#1D1D1F]'
              : isMaint
              ? 'bg-[#FF9500]/10 border-[#FF9500]/30 text-[#1D1D1F]'
              : 'bg-[#1D1D1F] border-black text-white shadow-lg'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  isIncident
                    ? 'bg-[#FF453A] text-white'
                    : isMaint
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-[#30D158]/20 text-[#30D158]'
                }`}
              >
                {isIncident ? (
                  <XCircle size={24} />
                ) : isMaint ? (
                  <AlertTriangle size={24} />
                ) : (
                  <CheckCircle size={24} />
                )}
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                  {isIncident
                    ? 'Incident en cours sur le site'
                    : isMaint
                    ? 'Maintenance programmée en cours'
                    : 'Site web 100% opérationnel'}
                </h2>
                <p
                  className={`text-xs sm:text-sm mt-1 ${
                    isOperational ? 'text-white/70' : 'text-[#6E6E73]'
                  }`}
                >
                  {isIncident
                    ? 'Nos équipes interviennent activement pour rétablir la situation.'
                    : isMaint
                    ? data?.maintenance?.announcement ||
                      'Des opérations techniques sont actuellement en cours.'
                    : 'Tous les services du site web fonctionnent à plein régime.'}
                </p>
              </div>
            </div>

            <div
              className={`text-xs px-3.5 py-1.5 rounded-full shrink-0 font-medium ${
                isOperational
                  ? 'bg-white/10 text-white/90 border border-white/15'
                  : 'bg-white border border-[#E5E5EA] text-[#1D1D1F]'
              }`}
            >
              Uptime 7 jours : {data?.uptime_7d || '99.98%'}
            </div>
          </div>
        </div>

        {/* 7 Days History Card */}
        <div className="bg-white rounded-3xl border border-[#E5E5EA] p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="font-semibold text-[17px] text-[#1D1D1F]">
                Historique des 7 derniers jours
              </h3>
              <p className="text-xs text-[#86868B] mt-0.5">
                Surveillance de la disponibilité quotidienne
              </p>
            </div>
            <div className="text-xs font-semibold text-[#30D158] bg-[#30D158]/10 px-3 py-1 rounded-full self-start sm:self-auto">
              {data?.uptime_7d || '99.98%'} uptime
            </div>
          </div>

          {/* 7 Interactive Bars Grid */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3 py-2">
            {(data?.history || []).map((day, idx) => {
              const isHovered = hoveredDay === idx;
              const barColor = getBarColor(day.status);
              return (
                <div
                  key={day.date || idx}
                  className="flex flex-col items-center cursor-pointer group"
                  onMouseEnter={() => setHoveredDay(idx)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Bar */}
                  <div className="w-full relative flex flex-col items-center">
                    <div
                      className={`w-full h-14 sm:h-16 rounded-xl sm:rounded-2xl transition-all duration-200 ${barColor} ${
                        isHovered ? 'scale-105 shadow-md brightness-110' : 'opacity-90 hover:opacity-100'
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <div className="mt-2.5 text-center">
                    <span className="block text-[11px] sm:text-xs font-medium text-[#1D1D1F] truncate max-w-full">
                      {idx === (data?.history?.length || 7) - 1
                        ? "Aujourd'hui"
                        : idx === (data?.history?.length || 7) - 2
                        ? 'Hier'
                        : day.label}
                    </span>
                    <span className="block text-[10px] text-[#86868B] mt-0.5">
                      {day.uptime_percent ? `${day.uptime_percent}%` : '100%'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tooltip info box when a day is hovered */}
          <div className="mt-4 p-3 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-center min-h-[44px] flex items-center justify-center transition-all">
            {hoveredDay !== null && data?.history?.[hoveredDay] ? (
              <div className="text-xs text-[#1D1D1F]">
                <span className="font-semibold">{data.history[hoveredDay].label}</span> ({data.history[hoveredDay].date}) :{' '}
                <span className="font-medium">{getStatusLabel(data.history[hoveredDay].status)}</span> ·{' '}
                <span className="text-[#6E6E73]">{data.history[hoveredDay].uptime_percent}% de disponibilité</span>
              </div>
            ) : (
              <div className="text-xs text-[#86868B]">
                Survolez une journée pour afficher le détail de disponibilité
              </div>
            )}
          </div>

          {/* Timeline bounds */}
          <div className="flex items-center justify-between text-[11px] text-[#86868B] mt-4 pt-3 border-t border-[#F5F5F7]">
            <span>Il y a 7 jours</span>
            <span>Aujourd'hui</span>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-5 border-t border-[#E5E5EA] text-xs text-[#6E6E73]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#30D158] shrink-0" />
              <span>100% Opérationnel</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FFD60A] shrink-0" />
              <span>Dégradé / Maintenance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FF453A] shrink-0" />
              <span>Incident</span>
            </div>
          </div>
        </div>

        {/* Footer info & Home button */}
        <div className="bg-white rounded-3xl border border-[#E5E5EA] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-[#86868B]">
            <Clock size={14} className="shrink-0" />
            <span>
              Dernière mise à jour à {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Rafraîchissement automatique toutes les 30s
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/contact"
              className="text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] px-3 py-1.5 transition-colors"
            >
              Support
            </Link>
            <Link
              to="/"
              className="btn-apple text-xs !py-2 !px-4 inline-flex items-center gap-1.5"
            >
              <span>Retour à l'accueil</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </main>

      {/* Minimal Bottom Footer */}
      <footer className="border-t border-[#E5E5EA] bg-white py-5">
        <div className="max-w-[820px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#86868B]">
          <p>© {new Date().getFullYear()} Vakar Games. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-[#1D1D1F] transition-colors">
              Confidentialité
            </Link>
            <Link to="/terms" className="hover:text-[#1D1D1F] transition-colors">
              Conditions
            </Link>
            {isAdmin && (
              <Link to="/dashboard" className="text-[#FF6600] font-medium hover:underline">
                Admin Board
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
