import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, Info, AlertTriangle, ShieldCheck, Target } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, Area, AreaChart,
} from 'recharts';
import { getScoreHistory } from '../api/compliance';
import { getAuditHistory } from '../api/audit';
import { listAlerts } from '../api/system';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface ScoreSnapshot {
  bucket_id: string;
  timestamp: string;
  date: string;
  scores: {
    iec62304: number;
    iso13485: number;
    cybersecurity: number;
    ce_mark_overall: number;
  };
  breakdown: Record<string, number>;
}

interface AuditHistoryEntry {
  timestamp: string;
  details: { readiness_score?: number; mode?: string };
}

interface Alert {
  id: string;
  created_at: string;
  title: string;
  message: string;
  severity: string;
  metric: string | null;
}

type TimeRange = '7d' | '30d' | '90d' | '365d';

const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

const METRIC_META = [
  { key: 'ce_mark_overall', label: 'CE Mark', color: '#0EA5E9', target: 95 },
  { key: 'iec62304',        label: 'IEC 62304', color: '#10B981', target: 90 },
  { key: 'iso13485',        label: 'ISO 13485', color: '#8B5CF6', target: 90 },
  { key: 'cybersecurity',   label: 'Cybersec',  color: '#F59E0B', target: 85 },
];

/* ═══════════════════════════════════════════════════════
   TRENDS PAGE — Time-series analytics (Phase 2)

   Finally earns the word "dashboard" (panels with trend gauges).
   Citations: DORA 2025 report on reliability metrics; Datadog/Grafana
   anomaly detection methodology; Jama Trace Scores trend visualization.

   Level 1: Range selector + target compliance banner
   Level 2: Multi-line compliance trend + event overlays (commits, audits, alerts)
   Level 3: Per-metric sparklines + forecast-ready empty state
   ═══════════════════════════════════════════════════════ */
export default function TrendsPage() {
  const [range, setRange] = useState<TimeRange>('30d');
  const [snapshots, setSnapshots] = useState<ScoreSnapshot[]>([]);
  const [auditHistory, setAuditHistory] = useState<AuditHistoryEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    ce_mark_overall: true, iec62304: true, iso13485: true, cybersecurity: true,
  });

  useEffect(() => {
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    setLoading(true);
    const days = RANGE_DAYS[range];
    Promise.all([
      safe(getScoreHistory(days)),
      safe(getAuditHistory(50)),
      safe(listAlerts(false)),
    ]).then(([hist, audits, alertsR]) => {
      if (hist) setSnapshots(hist.data.history || []);
      if (audits) setAuditHistory(audits.data.history || []);
      if (alertsR) setAlerts(alertsR.data.alerts || []);
    }).finally(() => setLoading(false));
  }, [range]);

  // Merge snapshots into chart data points
  const chartData = useMemo(() => {
    return snapshots.map(s => ({
      t: s.timestamp,
      label: new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ...s.scores,
    }));
  }, [snapshots]);

  // Compute deltas
  const latest = snapshots[snapshots.length - 1];
  const oldest = snapshots[0];
  const deltas = useMemo(() => {
    if (!latest || !oldest) return {};
    const out: Record<string, number> = {};
    for (const m of METRIC_META) {
      const k = m.key as keyof typeof latest.scores;
      out[m.key] = (latest.scores[k] ?? 0) - (oldest.scores[k] ?? 0);
    }
    return out;
  }, [latest, oldest]);

  if (loading) return <PageSkeleton rows={4} />;

  const hasData = snapshots.length > 1;

  // Event markers: audit runs + severe activity
  const auditMarkers = auditHistory
    .filter(a => a.details?.readiness_score !== undefined)
    .map(a => ({ t: a.timestamp, label: `Audit: ${a.details.readiness_score}%`, kind: 'audit' }));

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════
          LEVEL 1 — RANGE + CONTEXT BANNER
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(14,165,233,0.02))', border: '1px solid rgba(14,165,233,0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.12)' }}>
            <TrendingUp size={24} style={{ color: '#0EA5E9' }} />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Compliance Trends</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {snapshots.length} snapshots · {range}
              </span>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Hourly snapshots of the compliance score — overlayed with audit runs, alerts, and activity events.
            </p>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
          {(Object.keys(RANGE_DAYS) as TimeRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
              style={{
                background: range === r ? 'var(--card-bg)' : 'transparent',
                color: range === r ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: range === r ? 'var(--card-shadow)' : 'none',
              }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* No data state */}
      {!hasData && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <TrendingUp size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Building trend history…
          </p>
          <p className="text-[12px] mt-1 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Snapshots are captured every hour. Trend charts require at least 2 data points —
            you'll see them populate as the system runs. You can also trigger a snapshot now
            from the <code className="font-mono">/system/snapshot/trigger</code> endpoint.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Metric cards with delta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {METRIC_META.map(m => {
              const val = (latest?.scores as any)?.[m.key] ?? 0;
              const delta = deltas[m.key] ?? 0;
              const onTarget = val >= m.target;
              return (
                <button key={m.key}
                  onClick={() => setVisible(v => ({ ...v, [m.key]: !v[m.key] }))}
                  className="rounded-2xl p-4 text-left transition-all"
                  style={{
                    background: 'var(--card-bg)',
                    border: `1px solid ${visible[m.key] ? m.color + '40' : 'var(--card-border)'}`,
                    opacity: visible[m.key] ? 1 : 0.55,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: m.color }}>{m.label}</span>
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>≥{m.target}%</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-extrabold tabular-nums" style={{ color: onTarget ? '#10B981' : val >= m.target - 5 ? '#F59E0B' : '#EF4444' }}>
                      {val.toFixed(1)}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: delta >= 0 ? '#10B981' : '#EF4444' }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    vs {range} ago
                  </div>
                  {/* Sparkline */}
                  <div style={{ height: 32, marginTop: 6 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <Area type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={1.5} fill={m.color} fillOpacity={0.12} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════
              LEVEL 2 — MAIN TREND CHART
              ═══════════════════════════════════════ */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Compliance score over time</span>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2" style={{ background: '#10B981' }} /> ≥ target</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2" style={{ background: '#F59E0B' }} /> warn</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2" style={{ background: '#EF4444' }} /> below</span>
              </div>
            </div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="label" stroke="var(--text-muted)" style={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" style={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <ReferenceLine y={95} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'CE Mark target 95%', position: 'right', fill: '#10B981', fontSize: 9 }} />
                  {METRIC_META.map(m => visible[m.key] && (
                    <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {auditMarkers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span className="font-bold mr-2">Audit runs in window:</span>
                {auditMarkers.slice(0, 8).map((a, i) => (
                  <span key={i} className="inline-block mr-3">
                    <ShieldCheck size={9} className="inline mr-0.5" />
                    {new Date(a.t).toLocaleDateString()} — {a.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Active alerts */}
          {alerts.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} style={{ color: '#F59E0B' }} />
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  Regression alerts ({alerts.length})
                </span>
                <Target size={10} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Prophet + rule-based anomaly detection</span>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: a.severity === 'error' ? '#EF4444' : '#F59E0B' }} />
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.message}</div>
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Methodology hint */}
          <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.12)' }}>
            <Info size={12} className="mt-0.5 shrink-0" style={{ color: '#0EA5E9' }} />
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Methodology:</strong>{' '}
              Snapshots captured automatically every hour (granularity: hour) or on-demand via{' '}
              <code className="font-mono" style={{ color: 'var(--accent-teal)' }}>/system/snapshot/trigger</code>.
              Regression alerts use Prophet 95% prediction intervals on each metric (Facebook Prophet
              is interpretable decomposable forecasting — requirement from the IEC 62304 audit context).{' '}
              Patterns: DORA 2025 reliability metrics; Datadog/Grafana anomaly detection.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
