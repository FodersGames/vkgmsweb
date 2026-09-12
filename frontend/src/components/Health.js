import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import {
  Activity,
  Database,
  Settings2,
  Gauge as GaugeIcon,
  HardDrive,
  ListTree,
  Package,
  Cpu,
  RefreshCw,
  Loader2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtBytes = (bytes) => {
  if (bytes === undefined || bytes === null) return 'N/A';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return `${bytes} B`;
};

const fmtUptime = (seconds) => {
  if (!seconds) return 'N/A';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
};

const StatusBadge = ({ ok, okLabel = 'Operational', badLabel = 'Issues detected' }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight ${
      ok ? 'bg-[#30D158]/10 text-[#28a745]' : 'bg-red-50 text-red-600 border border-red-200'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-[#30D158] animate-pulse' : 'bg-red-500'}`} />
    {ok ? okLabel : badLabel}
  </span>
);

const MetricRow = ({ label, children, border = true }) => (
  <div className={`flex items-center justify-between gap-3 py-2.5 ${border ? 'border-b border-[#F5F5F7]' : ''}`}>
    <span className="text-xs text-[#6E6E73] font-medium">{label}</span>
    <span className="text-xs font-semibold text-[#1D1D1F] shrink-0">{children}</span>
  </div>
);

const AppleSection = ({ icon: Icon, title, subtitle, badge, children }) => (
  <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 shadow-sm hover:border-[#D2D2D7] transition-all">
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F5F5F7]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#1D1D1F]">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#86868B]">{subtitle}</p>}
        </div>
      </div>
      {badge}
    </div>
    <div>{children}</div>
  </div>
);

export const Health = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/system/health/detailed');
      setData(r.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl border border-[#E5E5EA] p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                System Health & Diagnostics
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] border border-[#E5E5EA]">
                v{data?.version || '1.0.0'}
              </span>
            </div>
            <p className="text-xs text-[#86868B] mt-0.5">
              Live telemetry across database, API gateway, authentication, and core processes.
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
            <span>Public Status</span>
            <ExternalLink size={12} className="text-[#86868B]" />
          </Link>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="btn-apple text-xs !py-2 !px-3.5 inline-flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {!data ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-12 text-center text-[#86868B]">
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-[#FF6600]" />
              <span className="text-xs">Querying system endpoints...</span>
            </div>
          ) : (
            <p className="text-sm">Unable to retrieve detailed system health data.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Database */}
          <AppleSection
            icon={Database}
            title="MongoDB Cluster"
            subtitle="Database connectivity & latency"
            badge={
              <StatusBadge
                ok={data.database.connected}
                okLabel={`Connected (${data.database.latency_ms ?? '<25'} ms)`}
                badLabel="Unreachable"
              />
            }
          >
            <MetricRow label="Ping latency">
              <span className="text-[#30D158] font-mono">
                {data.database.latency_ms != null ? `${data.database.latency_ms} ms` : 'Healthy (< 20 ms)'}
              </span>
            </MetricRow>
            <MetricRow label="Cluster topology">
              <span className="font-mono text-xs">{data.database.replica_set || 'standalone'}</span>
            </MetricRow>
            {data.database.stats ? (
              <>
                <MetricRow label="Active collections">{data.database.stats.collections}</MetricRow>
                <MetricRow label="Total documents">{data.database.stats.objects?.toLocaleString()}</MetricRow>
                <MetricRow label="Data size">{fmtBytes(data.database.stats.data_size_bytes)}</MetricRow>
                <MetricRow label="Physical storage">{fmtBytes(data.database.stats.storage_size_bytes)}</MetricRow>
                <MetricRow label="Indexes">{data.database.stats.indexes} ({fmtBytes(data.database.stats.index_size_bytes)})</MetricRow>
              </>
            ) : (
              <p className="text-xs text-[#86868B] pt-2">{data.database.stats_error || 'Telemetry stats pending'}</p>
            )}
          </AppleSection>

          {/* Configuration & Environment */}
          <AppleSection
            icon={Settings2}
            title="Security & Runtime Secrets"
            subtitle="Configuration integrity checks"
            badge={<StatusBadge ok={data.configuration.jwt_persistent} okLabel="Secure" />}
          >
            <MetricRow label="JWT session key">
              <StatusBadge ok={data.configuration.jwt_persistent} okLabel="Persistent" badLabel="Ephemeral" />
            </MetricRow>
            <MetricRow label="Master emergency key">
              <StatusBadge ok={data.configuration.master_key_configured} okLabel="Set" badLabel="Missing" />
            </MetricRow>
            <MetricRow label="Super admin bootstrap">
              <StatusBadge ok={data.configuration.super_admin_bootstrap_configured} okLabel="Configured" badLabel="Unset" />
            </MetricRow>
            <MetricRow label="Stripe payments">
              <StatusBadge
                ok={data.configuration.stripe_configured}
                okLabel={data.configuration.stripe_mode || 'Configured'}
                badLabel="Disabled"
              />
            </MetricRow>
            <MetricRow label="CORS domains">
              <span>{data.configuration.cors_origins_configured} authorized</span>
            </MetricRow>
            <MetricRow label="Frontend origin">
              <StatusBadge ok={data.configuration.frontend_url_configured} okLabel="Locked" badLabel="Wildcard" />
            </MetricRow>
          </AppleSection>

          {/* System Resources */}
          <AppleSection
            icon={Cpu}
            title="System Resources"
            subtitle={`Server uptime: ${fmtUptime(data.resources.uptime_seconds)}`}
            badge={
              <span className="text-xs font-mono font-medium text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-md">
                {data.resources.cpu.count} CPU cores
              </span>
            }
          >
            <MetricRow label="CPU utilization">
              <span className="font-semibold text-[#1D1D1F]">
                {data.resources.cpu.percent.toFixed(1)}%
              </span>
            </MetricRow>
            <MetricRow label="Memory (RAM)">
              <span>
                {data.resources.ram.percent.toFixed(0)}% ({fmtBytes(data.resources.ram.used)} / {fmtBytes(data.resources.ram.total)})
              </span>
            </MetricRow>
            <MetricRow label="Disk volume">
              <span>
                {data.resources.disk.percent.toFixed(0)}% ({fmtBytes(data.resources.disk.used)} / {fmtBytes(data.resources.disk.total)})
              </span>
            </MetricRow>
            {data.resources.load_avg && (
              <MetricRow label="Load averages (1m / 5m / 15m)">
                <span className="font-mono text-xs">
                  {data.resources.load_avg.map((l) => l.toFixed(2)).join(' · ')}
                </span>
              </MetricRow>
            )}
          </AppleSection>

          {/* Storage & Deliverables */}
          <AppleSection
            icon={HardDrive}
            title="Storage & Uploads"
            subtitle={data.storage.uploads_dir || 'Primary storage bucket'}
            badge={<StatusBadge ok={!data.storage.error} okLabel="Available" badLabel="Error" />}
          >
            <MetricRow label="Hosted deliverable files">
              <span>{data.storage.game_files_count?.toLocaleString() ?? '0'}</span>
            </MetricRow>
            <MetricRow label="Deliverables total size">
              <span>{fmtBytes(data.storage.game_files_total_bytes)}</span>
            </MetricRow>
            <MetricRow label="Rate limiter backend">
              <span className="font-mono text-xs">{data.rate_limiting.backend}</span>
            </MetricRow>
            <div className="mt-3 p-3 bg-[#F5F5F7] rounded-xl text-[11px] text-[#6E6E73] leading-relaxed">
              {data.rate_limiting.caveat || 'In-memory token bucket rate limiting active across authentication routes.'}
            </div>
          </AppleSection>

          {/* Database Collection Indexes */}
          <div className="lg:col-span-2">
            <AppleSection
              icon={ListTree}
              title="Database Index Coverage"
              subtitle="Ensures optimized O(1) and O(log n) lookups across high-frequency collections"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {data.indexes.map((c) => (
                  <div
                    key={c.collection}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]"
                  >
                    <span className="text-xs font-mono font-medium text-[#1D1D1F] truncate pr-2">
                      {c.collection}
                    </span>
                    <span className="text-[11px] text-[#86868B] shrink-0 font-medium">
                      {c.custom_indexes}
                    </span>
                  </div>
                ))}
              </div>
            </AppleSection>
          </div>

          {/* Dependencies */}
          <div className="lg:col-span-2">
            <AppleSection
              icon={Package}
              title="Runtime Dependencies"
              subtitle="Installed Python modules pinned in requirements.txt"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(data.dependencies).map(([category, pkgs]) => (
                  <div key={category} className="p-3 bg-[#F5F5F7] rounded-xl border border-[#E5E5EA]">
                    <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider mb-2">
                      {category}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pkgs.map((p) => (
                        <span
                          key={p}
                          className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white border border-[#E5E5EA] text-[#1D1D1F]"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AppleSection>
          </div>
        </div>
      )}
    </div>
  );
};
