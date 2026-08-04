import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import {
  Activity, Database, Settings2, Gauge as GaugeIcon, HardDrive, ListTree,
  Package, Cpu, RefreshCw, Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardBody, Badge } from '../ui';

const fmtBytes = (bytes) => {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return `${bytes} B`;
};

const fmtUptime = (seconds) => {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
};

const StatusBadge = ({ ok, okLabel = 'OK', badLabel = 'Missing' }) => (
  <Badge variant={ok ? 'success' : 'error'} dot>{ok ? okLabel : badLabel}</Badge>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-[#EDEDEF] dark:border-[#1c1c2e] last:border-0">
    <span className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">{label}</span>
    <span className="text-xs font-medium text-[#1D1D1F] dark:text-[#e4e4e7] shrink-0">{children}</span>
  </div>
);

const Section = ({ icon: Icon, color, title, subtitle, children }) => (
  <Card className="overflow-hidden">
    <CardHeader>
      <div className="flex items-center gap-3">
        <div className="rounded-lg w-9 h-9 flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{title}</h3>
          {subtitle && <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">{subtitle}</p>}
        </div>
      </div>
    </CardHeader>
    <CardBody>{children}</CardBody>
  </Card>
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
      // silent — the page below just shows nothing until a manual refresh succeeds
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center">
            <Activity size={20} className="text-[#4ECDC4]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">System Health</h1>
            <p className="text-xs text-[#A1A1A6] dark:text-[#71717a]">Deep technical status across every backend system — v{data?.version || '—'}</p>
          </div>
        </div>
        <button onClick={fetchHealth} disabled={loading} className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white transition-colors">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
        </button>
      </div>

      {!data ? (
        <p className="text-sm text-[#A1A1A6] dark:text-[#71717a]">{loading ? 'Loading…' : 'Could not load system health.'}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <Section icon={Database} color="#4ECDC4" title="Database" subtitle="MongoDB connectivity and storage">
            <Row label="Connectivity"><StatusBadge ok={data.database.connected} okLabel="Connected" badLabel="Unreachable" /></Row>
            <Row label="Topology">{data.database.replica_set}</Row>
            {data.database.stats ? (
              <>
                <Row label="Collections">{data.database.stats.collections}</Row>
                <Row label="Documents">{data.database.stats.objects?.toLocaleString()}</Row>
                <Row label="Data size">{fmtBytes(data.database.stats.data_size_bytes)}</Row>
                <Row label="Storage size">{fmtBytes(data.database.stats.storage_size_bytes)}</Row>
                <Row label="Index count">{data.database.stats.indexes}</Row>
                <Row label="Index size">{fmtBytes(data.database.stats.index_size_bytes)}</Row>
              </>
            ) : (
              <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] pt-2">{data.database.stats_error || 'Stats unavailable.'}</p>
            )}
          </Section>

          <Section icon={Settings2} color="#6C5CE7" title="Configuration" subtitle="Presence only — values are never exposed">
            <Row label="Session persistence"><StatusBadge ok={data.configuration.jwt_persistent} okLabel="Persistent" badLabel="Ephemeral" /></Row>
            <Row label="Emergency setup key"><StatusBadge ok={data.configuration.master_key_configured} /></Row>
            <Row label="Super admin bootstrap"><StatusBadge ok={data.configuration.super_admin_bootstrap_configured} /></Row>
            <Row label="Stripe payments">
              <StatusBadge ok={data.configuration.stripe_configured} okLabel={data.configuration.stripe_mode || 'configured'} />
            </Row>
            <Row label="Stripe webhook"><StatusBadge ok={data.configuration.stripe_webhook_configured} /></Row>
            <Row label="CORS origins">{data.configuration.cors_origins_configured} configured</Row>
            <Row label="Frontend URL"><StatusBadge ok={data.configuration.frontend_url_configured} /></Row>
          </Section>

          <Section icon={GaugeIcon} color="#F2994A" title="Rate Limiting" subtitle="slowapi backend">
            <Row label="Backend">{data.rate_limiting.backend}</Row>
            <p className="text-xs text-[#F2994A] bg-[#F2994A]/10 rounded-lg px-3 py-2 mt-2 leading-relaxed">{data.rate_limiting.caveat}</p>
          </Section>

          <Section icon={HardDrive} color="#16A085" title="Storage" subtitle={data.storage.uploads_dir}>
            <Row label="Game files">{data.storage.game_files_count?.toLocaleString() ?? '—'}</Row>
            <Row label="Total size">{fmtBytes(data.storage.game_files_total_bytes)}</Row>
            {data.storage.error && <p className="text-xs text-red-500 pt-2">{data.storage.error}</p>}
          </Section>

          <Section icon={ListTree} color="#2F80ED" title="Indexes" subtitle="Custom indexes per collection">
            <div className="max-h-64 overflow-y-auto -mx-1">
              {data.indexes.map(c => (
                <div key={c.collection} className="flex items-center justify-between gap-3 px-1 py-1.5 border-b border-[#EDEDEF] dark:border-[#1c1c2e] last:border-0">
                  <span className="text-xs font-mono text-[#6E6E73] dark:text-[#a1a1aa]">{c.collection}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[#A1A1A6] dark:text-[#71717a]">{c.custom_indexes}</span>
                    <StatusBadge ok={c.ok} okLabel="OK" badLabel="None" />
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Cpu} color="#EB5757" title="Resources" subtitle={`Uptime ${fmtUptime(data.resources.uptime_seconds)}`}>
            <Row label="CPU">{data.resources.cpu.percent.toFixed(0)}% ({data.resources.cpu.count} cores)</Row>
            <Row label="RAM">{data.resources.ram.percent.toFixed(0)}% — {fmtBytes(data.resources.ram.used)} / {fmtBytes(data.resources.ram.total)}</Row>
            <Row label="Disk">{data.resources.disk.percent.toFixed(0)}% — {fmtBytes(data.resources.disk.used)} / {fmtBytes(data.resources.disk.total)}</Row>
            {data.resources.load_avg && <Row label="Load average">{data.resources.load_avg.map(l => l.toFixed(2)).join(' · ')}</Row>}
          </Section>

          <div className="lg:col-span-2">
            <Section icon={Package} color="#A1A1A6" title="Dependencies" subtitle="Pinned backend packages, from requirements.txt">
              {data.dependencies.error ? (
                <p className="text-xs text-red-500">{data.dependencies.error}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {Object.entries(data.dependencies).map(([category, pkgs]) => (
                    <div key={category} className="mb-3">
                      <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-wider mb-1.5">{category}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {pkgs.map(p => (
                          <span key={p} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#F5F5F7] dark:bg-[#111118] text-[#6E6E73] dark:text-[#a1a1aa]">{p}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
};
