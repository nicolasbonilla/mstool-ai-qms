import { useEffect, useState, useMemo } from 'react';
import {
  Activity, User as UserIcon, FileText, ShieldCheck, Package, Bell,
  GitCommit, RefreshCw, Filter, AlertTriangle, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { getActivityFeed, getActivitySummary } from '../api/activity';
import { getSystemHealth } from '../api/system';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface ActivityEntry {
  id: string;
  timestamp: string;
  user_uid: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  severity: 'info' | 'warning' | 'error';
  details: Record<string, any>;
  prev_hash: string;
  hash: string;
  sequence: number;
}

interface Summary {
  window_days: number;
  total_entries: number;
  by_day: Record<string, number>;
  by_type: Record<string, number>;
  by_user: Record<string, number>;
  by_severity: Record<string, number>;
}

interface LedgerHead {
  hash: string;
  sequence: number;
  last_entry_id: string;
  last_timestamp: string;
}

/* ─── Resource type → icon + color ─── */
const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  forms:        { icon: FileText,    color: '#8B5CF6', label: 'Forms' },
  audit:        { icon: ShieldCheck, color: '#0EA5E9', label: 'Audit' },
  compliance:   { icon: Activity,    color: '#10B981', label: 'Compliance' },
  soup:         { icon: Package,     color: '#F59E0B', label: 'SOUP' },
  traceability: { icon: GitCommit,   color: '#6366F1', label: 'Traceability' },
  system:       { icon: Bell,        color: '#64748B', label: 'System' },
  activity:     { icon: Activity,    color: '#94A3B8', label: 'Activity' },
  users:        { icon: UserIcon,    color: '#EC4899', label: 'Users' },
  ai:           { icon: Activity,    color: '#06B6D4', label: 'AI' },
};

const SEV_META: Record<string, { color: string; bg: string }> = {
  info:    { color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  error:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

/* ═══════════════════════════════════════════════════════
   ACTIVITY PAGE — WORM ledger visualization

   Implements 21 CFR Part 11 §11.10(e): time-stamped audit trail.
   Each entry carries (prev_hash, hash, sequence) proving tamper-evidence.

   Level 1: Ledger head status (current sequence + hash + project verification)
   Level 2: Filters + day-by-day summary bars
   Level 3: Per-entry timeline with diff details
   ═══════════════════════════════════════════════════════ */
export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [head, setHead] = useState<LedgerHead | null>(null);
  const [projectMatch, setProjectMatch] = useState<boolean>(true);
  const [activeProject, setActiveProject] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [filterDays, setFilterDays] = useState<number>(7);

  const load = async () => {
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [feedR, summaryR, healthR] = await Promise.all([
      safe(getActivityFeed({ limit: 100, days: filterDays, resource_type: filterType || undefined })),
      safe(getActivitySummary(filterDays)),
      safe(getSystemHealth()),
    ]);
    if (feedR) setEntries(feedR.data.entries || []);
    if (summaryR) setSummary(summaryR.data);
    if (healthR) {
      const h = healthR.data;
      setHead(h.ledger && h.ledger.sequence !== undefined ? h.ledger : null);
      setProjectMatch(h.firestore?.match ?? true);
      setActiveProject(h.firestore?.active_project ?? '');
    }
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterDays]);

  const types = useMemo(() => {
    return Object.keys(summary?.by_type || {}).sort();
  }, [summary]);

  if (loading) return <PageSkeleton rows={4} />;

  const maxDayCount = Math.max(1, ...Object.values(summary?.by_day || { x: 0 }));
  const days = Object.keys(summary?.by_day || {}).sort();

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════
          LEVEL 1 — LEDGER HEAD STATUS
          Proves WORM chain integrity + Firestore wiring
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5"
        style={{
          background: projectMatch
            ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))',
          border: `1px solid ${projectMatch ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.20)'}`,
        }}>
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: projectMatch ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
              {projectMatch
                ? <CheckCircle2 size={24} style={{ color: '#10B981' }} />
                : <AlertTriangle size={24} style={{ color: '#EF4444' }} />}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  Activity Trail
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  21 CFR Part 11 §11.10(e)
                </span>
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Every mutation is recorded into an append-only hash-chained ledger. Tampering creates a verifiable gap.
              </p>
            </div>
          </div>

          <div className="flex items-stretch gap-3">
            {/* Ledger head */}
            <div className="rounded-xl px-4 py-2.5 min-w-[180px]"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.20)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Activity size={10} style={{ color: '#8B5CF6' }} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#8B5CF6' }}>Ledger Head</span>
              </div>
              <div className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>
                #{head?.sequence ?? 0}
              </div>
              <div className="text-[9px] mt-0.5 font-mono truncate max-w-[160px]" title={head?.hash}>
                {head?.hash ? `${head.hash.slice(0, 14)}…` : '—'}
              </div>
            </div>

            {/* Total entries */}
            <div className="rounded-xl px-4 py-2.5 min-w-[120px]"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Last {filterDays}d
              </div>
              <div className="text-[22px] font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>
                {summary?.total_entries ?? 0}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>entries</div>
            </div>

            {/* Firebase project verification */}
            <div className="rounded-xl px-4 py-2.5 min-w-[180px]"
              style={{ background: projectMatch ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${projectMatch ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.25)'}` }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck size={10} style={{ color: projectMatch ? '#10B981' : '#EF4444' }} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: projectMatch ? '#10B981' : '#EF4444' }}>
                  {projectMatch ? 'Project OK' : 'Project Mismatch'}
                </span>
              </div>
              <div className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                {activeProject || '—'}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                expected: mstool-ai-qms
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          LEVEL 2 — FILTERS + DAILY SUMMARY
          ═══════════════════════════════════════ */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Window:</span>
        {[1, 7, 30, 90].map(d => (
          <button key={d} onClick={() => setFilterDays(d)}
            className="px-3 py-1 text-[11px] rounded-lg font-semibold transition-all"
            style={{
              background: filterDays === d ? 'var(--accent-teal)' : 'var(--card-bg)',
              color: filterDays === d ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filterDays === d ? 'var(--accent-teal)' : 'var(--border-default)'}`,
            }}>
            {d === 1 ? '24h' : `${d}d`}
          </button>
        ))}
        <div className="w-px h-5 mx-1" style={{ background: 'var(--border-subtle)' }} />
        <Filter size={12} style={{ color: 'var(--text-muted)' }} />
        <button onClick={() => setFilterType('')}
          className="px-3 py-1 text-[11px] rounded-lg font-semibold transition-all"
          style={{
            background: !filterType ? 'var(--accent-teal)' : 'var(--card-bg)',
            color: !filterType ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${!filterType ? 'var(--accent-teal)' : 'var(--border-default)'}`,
          }}>
          All types
        </button>
        {types.map(t => {
          const meta = TYPE_META[t] || { color: '#94A3B8', label: t, icon: Activity };
          return (
            <button key={t} onClick={() => setFilterType(t === filterType ? '' : t)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all"
              style={{
                background: filterType === t ? meta.color : 'var(--card-bg)',
                color: filterType === t ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${filterType === t ? meta.color : 'var(--border-default)'}`,
              }}>
              {meta.label} <span className="opacity-70">({summary?.by_type[t] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Daily bar chart */}
      {days.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Activity by day</span>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#64748B' }} />{summary?.by_severity.info ?? 0} info</span>
              {(summary?.by_severity.warning ?? 0) > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />{summary?.by_severity.warning} warn</span>}
              {(summary?.by_severity.error ?? 0) > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />{summary?.by_severity.error} error</span>}
            </div>
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 80 }}>
            {days.map(day => {
              const count = summary?.by_day[day] ?? 0;
              // Use pixel heights so bars are always visible. Min 4px for non-zero.
              const barH = count === 0 ? 0 : Math.max(6, Math.round((count / maxDayCount) * 64));
              return (
                <div key={day} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${day}: ${count} entries`}>
                  {count > 0 && (
                    <span className="text-[8px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>{count}</span>
                  )}
                  <div className="w-full rounded-t transition-all"
                    style={{ height: barH, background: 'var(--accent-teal)', opacity: count === 0 ? 0.15 : 0.5 + (count / maxDayCount) * 0.5 }} />
                  <span className="text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEVEL 3 — ENTRY TIMELINE
          Each entry: icon + action + user + diff + hash
          ═══════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Entries ({entries.length})
          </span>
          <button onClick={() => load()}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <RefreshCw size={10} /> Refresh
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <Activity size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>No entries in this window</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Try a wider time range or a different resource type.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map(e => {
              const meta = TYPE_META[e.resource_type] || { icon: Activity, color: '#94A3B8', label: e.resource_type };
              const Icon = meta.icon;
              const sev = SEV_META[e.severity] || SEV_META.info;
              return (
                <div key={e.id} className="rounded-xl p-3 flex items-start gap-3 transition-colors"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.color}15` }}>
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>

                  {/* Main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[10px] font-mono font-bold" style={{ color: meta.color }}>{e.action}</code>
                      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>on</span>
                      <code className="text-[10px] font-mono" style={{ color: 'var(--text-primary)' }}>
                        {e.resource_type}{e.resource_id ? ` / ${e.resource_id}` : ''}
                      </code>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: sev.bg, color: sev.color }}>
                        {e.severity}
                      </span>
                      {e.details?.status_code !== undefined && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                          {e.details.status_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <UserIcon size={9} />
                      <span>{e.user_email || e.user_uid}</span>
                      <span>·</span>
                      <span>{formatRelative(e.timestamp)}</span>
                      <span>·</span>
                      <span className="font-mono">#{e.sequence}</span>
                    </div>
                    {e.details?.path && (
                      <code className="block text-[10px] font-mono mt-1 truncate" style={{ color: 'var(--text-muted)' }} title={e.details.path}>
                        {e.details.method} {e.details.path}
                      </code>
                    )}
                  </div>

                  {/* Hash */}
                  <div className="text-right shrink-0">
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Hash</div>
                    <code className="text-[9px] font-mono" style={{ color: 'var(--accent-teal)' }} title={e.hash}>
                      {e.hash ? `${e.hash.slice(0, 8)}…` : '—'}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer: ledger verification link */}
        <div className="mt-4 flex items-center justify-center">
          <a href="#" onClick={(ev) => { ev.preventDefault(); window.open('/api/v1/system/ledger/verify', '_blank'); }}
            className="text-[10px] font-semibold inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: 'var(--accent-teal)' }}>
            Verify full ledger chain (admin) <ExternalLink size={9} />
          </a>
        </div>
      </div>
    </div>
  );
}
