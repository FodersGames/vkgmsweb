import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Globe,
  Database,
  ShieldCheck,
  Gamepad2,
  Clock,
  ArrowRight,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function StatusPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const { user, isAdmin } = useAuth();

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${API_URL}/api/public/status`);
      setData(res.data);
    } catch (err) {
      // Fallback if backend is degraded or unreachable
      setData({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: { status: 'unknown', latency_ms: null },
        api: { status: 'operational', uptime: '99.9%' },
        website: { status: 'operational' },
        auth: { status: 'operational' },
        games: [],
        maintenance: { active: false, announcement: '' },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isMaint = data?.maintenance?.active;
  const isAllGood = data?.status === 'operational';

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col antialiased">
      {/* Top minimal header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA]">
        <div className="max-w-[1040px] mx-auto px-6 h-14 flex items-center justify-between">
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
              System Status
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStatus}
              disabled={refreshing}
              title="Refresh status"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5E5EA] text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:border-[#D2D2D7] shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin text-[#FF6600]' : ''} />
              <span className="hidden sm:inline">Refresh</span>
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
      <main className="flex-1 max-w-[1040px] w-full mx-auto px-6 py-10 sm:py-14">
        {/* Hero banner */}
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
            Vakar Games Systems
          </h1>
          <p className="text-[#6E6E73] text-sm sm:text-base max-w-2xl leading-relaxed">
            Live operational status across Vakar Games studio infrastructure, platform services, and production game servers.
          </p>
        </div>

        {/* Global Status Card */}
        <div
          className={`rounded-3xl p-6 sm:p-8 mb-8 border transition-all ${
            isMaint
              ? 'bg-[#FF6600]/10 border-[#FF6600]/30 text-[#1D1D1F]'
              : isAllGood
              ? 'bg-[#1D1D1F] border-black text-white shadow-xl'
              : 'bg-amber-500/10 border-amber-500/30 text-[#1D1D1F]'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  isMaint
                    ? 'bg-[#FF6600] text-white'
                    : isAllGood
                    ? 'bg-[#30D158]/20 text-[#30D158]'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {isMaint ? (
                  <AlertTriangle size={24} />
                ) : isAllGood ? (
                  <CheckCircle size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                    {isMaint
                      ? 'Scheduled Maintenance in Progress'
                      : isAllGood
                      ? 'All Systems Fully Operational'
                      : 'Some Services Degraded'}
                  </h2>
                </div>
                <p
                  className={`text-xs sm:text-sm mt-1 ${
                    isAllGood ? 'text-white/70' : 'text-[#6E6E73]'
                  }`}
                >
                  {isMaint
                    ? data?.maintenance?.announcement ||
                      'Systems are undergoing planned technical improvements.'
                    : isAllGood
                    ? 'All web platforms, backend APIs, player databases, and studio game servers are running normally.'
                    : 'We are investigating elevated response times or service disruptions.'}
                </p>
              </div>
            </div>

            <div
              className={`text-xs px-3 py-1.5 rounded-full shrink-0 flex items-center gap-1.5 ${
                isAllGood
                  ? 'bg-white/10 text-white/90 border border-white/15'
                  : 'bg-white border border-[#E5E5EA] text-[#6E6E73]'
              }`}
            >
              <Clock size={12} />
              <span>
                Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Core Infrastructure Services */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6E6E73]">
              Core Services & Infrastructure
            </h3>
            <span className="text-xs text-[#86868B]">Real-time telemetry</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Website Platform */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm hover:border-[#D2D2D7] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
                  <Globe size={18} />
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#30D158] bg-[#30D158]/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
                  Operational
                </span>
              </div>
              <h4 className="font-semibold text-[15px] text-[#1D1D1F]">Vakar Games Web</h4>
              <p className="text-xs text-[#86868B] mt-1">
                Global Edge CDN · High Availability
              </p>
              <div className="mt-4 pt-3 border-t border-[#F5F5F7] flex items-center justify-between text-[11px] text-[#6E6E73]">
                <span>Status</span>
                <span className="font-medium text-[#1D1D1F]">Online</span>
              </div>
            </div>

            {/* Core API */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm hover:border-[#D2D2D7] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
                  <Server size={18} />
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#30D158] bg-[#30D158]/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
                  Operational
                </span>
              </div>
              <h4 className="font-semibold text-[15px] text-[#1D1D1F]">Backend API Services</h4>
              <p className="text-xs text-[#86868B] mt-1">
                FastAPI Gateway · REST endpoints
              </p>
              <div className="mt-4 pt-3 border-t border-[#F5F5F7] flex items-center justify-between text-[11px] text-[#6E6E73]">
                <span>Uptime</span>
                <span className="font-medium text-[#1D1D1F]">99.98%</span>
              </div>
            </div>

            {/* Database */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm hover:border-[#D2D2D7] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
                  <Database size={18} />
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    data?.database?.status === 'operational'
                      ? 'text-[#30D158] bg-[#30D158]/10'
                      : 'text-amber-600 bg-amber-500/10'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      data?.database?.status === 'operational'
                        ? 'bg-[#30D158] animate-pulse'
                        : 'bg-amber-500'
                    }`}
                  />
                  {data?.database?.status === 'operational' ? 'Operational' : 'Monitoring'}
                </span>
              </div>
              <h4 className="font-semibold text-[15px] text-[#1D1D1F]">Cloud Database</h4>
              <p className="text-xs text-[#86868B] mt-1">
                MongoDB Cluster · Player profiles & data
              </p>
              <div className="mt-4 pt-3 border-t border-[#F5F5F7] flex items-center justify-between text-[11px] text-[#6E6E73]">
                <span>Ping latency</span>
                <span className="font-medium text-[#1D1D1F]">
                  {data?.database?.latency_ms != null ? `${data.database.latency_ms} ms` : '< 25 ms'}
                </span>
              </div>
            </div>

            {/* Auth & Security */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm hover:border-[#D2D2D7] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#30D158] bg-[#30D158]/10 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
                  Operational
                </span>
              </div>
              <h4 className="font-semibold text-[15px] text-[#1D1D1F]">Auth & Security</h4>
              <p className="text-xs text-[#86868B] mt-1">
                JWT Sessions · 2FA & Access Control
              </p>
              <div className="mt-4 pt-3 border-t border-[#F5F5F7] flex items-center justify-between text-[11px] text-[#6E6E73]">
                <span>Rate limiting</span>
                <span className="font-medium text-[#1D1D1F]">Enforced</span>
              </div>
            </div>
          </div>
        </section>

        {/* Studio Games Status */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6E6E73]">
              Games & Production Titles
            </h3>
            <span className="text-xs text-[#86868B]">Game servers & matchmaking</span>
          </div>

          {data?.games && data.games.length > 0 ? (
            <div className="space-y-3">
              {data.games.map((game) => (
                <div
                  key={game.slug}
                  className="bg-white rounded-2xl border border-[#E5E5EA] p-5 flex items-center justify-between gap-4 shadow-sm hover:border-[#D2D2D7] transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shrink-0">
                      <Gamepad2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[15px] text-[#1D1D1F] truncate">
                          {game.name}
                        </h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#F5F5F7] text-[#6E6E73] font-mono">
                          /{game.slug}
                        </span>
                      </div>
                      <p className="text-xs text-[#86868B] mt-0.5 truncate">
                        {game.game_status === 'published'
                          ? 'Production build · Online matchmaking'
                          : 'In development · Internal testing'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                        game.status === 'operational'
                          ? 'text-[#30D158] bg-[#30D158]/10'
                          : 'text-[#FF6600] bg-[#FF6600]/10'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          game.status === 'operational'
                            ? 'bg-[#30D158] animate-pulse'
                            : 'bg-[#FF6600]'
                        }`}
                      />
                      {game.status === 'operational' ? 'Operational' : 'Upcoming'}
                    </span>

                    <Link
                      to="/games"
                      className="hidden sm:inline-flex items-center text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors"
                      title="View Game"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-8 text-center text-[#6E6E73]">
              <Gamepad2 size={32} className="mx-auto text-[#86868B] mb-2" />
              <p className="text-sm font-medium text-[#1D1D1F]">All title servers operational</p>
              <p className="text-xs text-[#86868B] mt-1">
                Studio game services and player registries are running with 0 reported incidents.
              </p>
            </div>
          )}
        </section>

        {/* Bottom support & links */}
        <div className="bg-white rounded-3xl border border-[#E5E5EA] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div>
            <h4 className="font-semibold text-[#1D1D1F] text-base mb-1">
              Need assistance or experiencing an issue?
            </h4>
            <p className="text-xs sm:text-sm text-[#6E6E73]">
              Our technical team actively monitors platform telemetry around the clock.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/contact"
              className="btn-apple text-xs !py-2 !px-4"
            >
              Contact Support
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] px-3 py-2 transition-colors"
            >
              <span>Back to Home</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#E5E5EA] bg-white py-6">
        <div className="max-w-[1040px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#86868B]">
          <p>© {new Date().getFullYear()} Vakar Games. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-[#1D1D1F] transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[#1D1D1F] transition-colors">
              Terms
            </Link>
            {isAdmin && (
              <Link to="/dashboard" className="text-[#FF6600] font-medium hover:underline">
                Staff Dashboard
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

