import { useEffect, useState, useCallback, useMemo } from 'react';
import { ReactFlow, MiniMap, Controls, Background, Node, Edge, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getTraceabilityGraph } from '../api/compliance';
import { AlertTriangle, GitBranch, Network, Table as TableIcon, CheckCircle2, AlertCircle, XCircle, ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface OrphanReq { id: string; description: string; category: string; safety_class: string; has_code_implementation: boolean; code_modules: string[]; reason: string; suggested_form: string; standard_ref: string; }
interface OrphanRisk { id: string; description: string; reason: string; suggested_form: string; standard_ref: string; }
interface OrphanCode { id: string; path: string; is_class_c: boolean; reason: string; suggested_form: string; standard_ref: string; }

interface RtmRow {
  req_id: string; description: string; category: string; safety_class: string;
  code_modules: string[]; code_count: number;
  tests: string[]; test_count: number;
  risk_controls: string[]; risk_count: number;
  status: 'complete' | 'partial' | 'uncovered';
}

interface CoverageMetrics {
  forward_pct: number; backward_pct: number; risk_coverage_pct: number; code_coverage_pct: number;
  tests_with_reqs: number; tests_total: number; reqs_with_tests: number; reqs_total: number;
  audit_readiness: 'ready' | 'needs_work' | 'not_ready';
}

interface CoverageByCategory {
  [key: string]: { total: number; with_code: number; with_tests: number; with_risk_link: number };
}

interface GraphData {
  nodes: { id: string; type: string; label: string; metadata: Record<string, any> }[];
  edges: { source: string; target: string; type: string }[];
  orphans: {
    requirements_without_tests: OrphanReq[];
    risk_controls_without_verification: OrphanRisk[];
    code_without_requirements: OrphanCode[];
  };
  stats: Record<string, number>;
  coverage_metrics: CoverageMetrics;
  coverage_by_category: CoverageByCategory;
  rtm_rows: RtmRow[];
}

const TYPE_COLORS: Record<string, string> = {
  requirement: '#3B82F6', architecture: '#8B5CF6', code: '#10B981', test: '#F59E0B', risk_control: '#EF4444',
};
const TYPE_LABELS: Record<string, string> = {
  requirement: 'REQ', architecture: 'ARCH', code: 'CODE', test: 'TEST', risk_control: 'RISK',
};

const CATEGORY_LABELS: Record<string, { name: string; color: string; desc: string }> = {
  FUNC: { name: 'Functional', color: '#3B82F6', desc: 'User-facing features and workflows' },
  SAFE: { name: 'Safety', color: '#EF4444', desc: 'IEC 62304 §5.2 + ISO 14971 hazard mitigation' },
  PERF: { name: 'Performance', color: '#F59E0B', desc: 'Latency, throughput, accuracy thresholds' },
  SEC:  { name: 'Security', color: '#8B5CF6', desc: 'IEC 81001-5-1 cybersecurity controls' },
  USAB: { name: 'Usability', color: '#10B981', desc: 'IEC 62366-1 use specification' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  complete:  { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2, label: 'Complete' },
  partial:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  icon: AlertCircle,  label: 'Partial' },
  uncovered: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle,      label: 'Uncovered' },
};

/* ═══════════════════════════════════════════════════════
   TRACEABILITY PAGE — 3-Level Information Architecture

   Level 1: Audit-readiness banner with bidirectional coverage
   Level 2: Coverage by REQ category + view toggle (Matrix RTM ↔ Graph)
   Level 3: Per-row detail (RTM) or per-orphan card with reasoning + CTA

   IEC 62304 §5.1.1 + §8.1.1 — bidirectional traceability
   ISO 14971 §7.3 — risk control verification (implementation + effectiveness)
   FDA Premarket Software Guidance — RTM matrix required for submission
   ═══════════════════════════════════════════════════════ */
export default function TraceabilityPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'matrix' | 'graph'>('matrix');
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'complete' | 'partial' | 'uncovered'>('all');
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>('');

  useEffect(() => {
    getTraceabilityGraph()
      .then(({ data }) => { setData(data); layoutGraph(data); })
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load traceability'))
      .finally(() => setLoading(false));
  }, []);

  const layoutGraph = (graph: GraphData) => {
    const groups: Record<string, typeof graph.nodes> = {};
    graph.nodes.forEach((n) => { if (!groups[n.type]) groups[n.type] = []; groups[n.type].push(n); });
    const typeOrder = ['requirement', 'architecture', 'code', 'test', 'risk_control'];
    const NODE_W = 200; const NODE_H = 70; const COLS = 12; const SECTION_GAP = 150;
    const nodes: Node[] = []; let currentY = 0;

    typeOrder.forEach((type) => {
      const items = groups[type] || []; if (items.length === 0) return;
      items.forEach((n, i) => {
        const col = i % COLS; const row = Math.floor(i / COLS);
        nodes.push({
          id: n.id,
          position: { x: col * NODE_W, y: currentY + row * NODE_H },
          data: { label: (
            <div style={{ padding: '6px 10px', borderRadius: 6, border: `2px solid ${TYPE_COLORS[n.type]}`, background: `${TYPE_COLORS[n.type]}15`, maxWidth: 170, fontSize: 10 }}>
              <div style={{ fontSize: 8, color: TYPE_COLORS[n.type], fontWeight: 700 }}>{TYPE_LABELS[n.type]}</div>
              <div style={{ color: '#1E293B', lineHeight: 1.2, wordBreak: 'break-word' }}>{n.id.length > 25 ? n.id.slice(0, 25) + '...' : n.id}</div>
            </div>
          ) },
          sourcePosition: Position.Bottom, targetPosition: Position.Top,
        });
      });
      const rows = Math.ceil(items.length / COLS); currentY += rows * NODE_H + SECTION_GAP;
    });

    const edgeStyles: Record<string, any> = {
      traces_to: { stroke: '#8B5CF6', strokeWidth: 1.5 },
      implemented_by: { stroke: '#10B981', strokeWidth: 1.5 },
      tested_by: { stroke: '#F59E0B', strokeWidth: 1.5, strokeDasharray: '5,5' },
      mitigated_by: { stroke: '#EF4444', strokeWidth: 1, strokeDasharray: '3,3', opacity: 0.4 },
    };
    const nonMitigated = graph.edges.filter(e => e.type !== 'mitigated_by');
    const mitigated = graph.edges.filter(e => e.type === 'mitigated_by').slice(0, 30);
    const visibleEdges = [...nonMitigated, ...mitigated];
    const edges: Edge[] = visibleEdges.map((e, i) => ({
      id: `e-${i}`, source: e.source, target: e.target,
      style: edgeStyles[e.type] || { stroke: '#94A3B8' },
      animated: e.type === 'tested_by',
    }));
    setRfNodes(nodes); setRfEdges(edges);
  };

  const onNodeClick = useCallback((_: any, node: Node) => { setSelectedNode(node.id); }, []);

  const filteredRtm = useMemo(() => {
    if (!data) return [];
    return (data.rtm_rows || []).filter(r => {
      if (matrixFilter !== 'all' && r.status !== matrixFilter) return false;
      if (matrixCategoryFilter && r.category !== matrixCategoryFilter) return false;
      return true;
    });
  }, [data, matrixFilter, matrixCategoryFilter]);

  if (loading) return <PageSkeleton rows={4} />;
  if (error) return <div className="rounded-2xl p-6" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}><p style={{ color: '#EF4444' }}>{error}</p></div>;
  if (!data) return null;

  // Defensive defaults — backend may return partial structure during cold-start
  // or if a service inside build_graph() throws. Never let an undefined field
  // crash the whole page; degrade gracefully so user sees something useful.
  const cov: CoverageMetrics = data.coverage_metrics || {
    forward_pct: 0, backward_pct: 0, risk_coverage_pct: 0, code_coverage_pct: 0,
    tests_with_reqs: 0, tests_total: 0, reqs_with_tests: 0, reqs_total: 0,
    audit_readiness: 'not_ready',
  };
  const orphansSafe = {
    requirements_without_tests: data.orphans?.requirements_without_tests || [],
    risk_controls_without_verification: data.orphans?.risk_controls_without_verification || [],
    code_without_requirements: data.orphans?.code_without_requirements || [],
  };
  const totalOrphans =
    orphansSafe.requirements_without_tests.length +
    orphansSafe.risk_controls_without_verification.length +
    orphansSafe.code_without_requirements.length;

  // Audit readiness verdict — fall back to "not_ready" if the backend sends
  // an unexpected value (e.g. older deployment without the field).
  const VERDICTS = {
    ready:      { color: '#10B981', label: 'Audit Ready',     desc: 'Bidirectional coverage meets IEC 62304 §5.1.1 thresholds' },
    needs_work: { color: '#F59E0B', label: 'Needs Work',      desc: 'Coverage acceptable but gaps will be flagged by auditor' },
    not_ready:  { color: '#EF4444', label: 'Not Audit Ready', desc: 'Significant traceability gaps — fix before submission' },
  } as const;
  const verdictConfig = VERDICTS[cov.audit_readiness as keyof typeof VERDICTS] || VERDICTS.not_ready;

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════
          LEVEL 1 — AUDIT READINESS BANNER
          Bidirectional coverage + verdict
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5"
        style={{
          background: `linear-gradient(135deg, ${verdictConfig.color}14, ${verdictConfig.color}05)`,
          border: `1px solid ${verdictConfig.color}25`,
        }}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${verdictConfig.color}18` }}>
              <GitBranch size={24} style={{ color: verdictConfig.color }} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Requirement Traceability</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${verdictConfig.color}18`, color: verdictConfig.color }}>
                  {verdictConfig.label}
                </span>
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {verdictConfig.desc} · IEC 62304 §5.1.1 · ISO 14971 §7.3
              </p>
            </div>
          </div>

          {/* Bidirectional coverage metrics */}
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Forward (REQ→Test)</div>
              <div className="text-[20px] font-bold" style={{ color: cov.forward_pct >= 90 ? '#10B981' : cov.forward_pct >= 70 ? '#F59E0B' : '#EF4444' }}>
                {cov.forward_pct}%
              </div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{cov.reqs_with_tests} / {cov.reqs_total} reqs</div>
            </div>
            <div className="w-px h-12" style={{ background: 'var(--border-subtle)' }} />
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Backward (Test→REQ)</div>
              <div className="text-[20px] font-bold" style={{ color: cov.backward_pct >= 80 ? '#10B981' : cov.backward_pct >= 60 ? '#F59E0B' : '#EF4444' }}>
                {cov.backward_pct}%
              </div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{cov.tests_with_reqs} / {cov.tests_total} tests</div>
            </div>
            <div className="w-px h-12" style={{ background: 'var(--border-subtle)' }} />
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Gaps</div>
              <div className="text-[20px] font-bold" style={{ color: totalOrphans > 0 ? '#EF4444' : '#10B981' }}>
                {totalOrphans}
              </div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>orphans across types</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          LEVEL 2A — COVERAGE BY REQ CATEGORY
          ═══════════════════════════════════════ */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Coverage by Requirement Category</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.coverage_by_category || {}).map(([cat, c]) => {
            const meta = CATEGORY_LABELS[cat] || { name: cat, color: '#94A3B8', desc: '' };
            const pct = c.total > 0 ? Math.round((c.with_tests / c.total) * 100) : 0;
            const isWeak = pct < 70 && c.total > 0;
            return (
              <div key={cat} className="rounded-2xl p-4 transition-all hover:shadow-md cursor-pointer"
                onClick={() => { setMatrixCategoryFilter(matrixCategoryFilter === cat ? '' : cat); setView('matrix'); }}
                style={{
                  background: 'var(--card-bg)',
                  border: `1px solid ${matrixCategoryFilter === cat ? meta.color + '50' : 'var(--card-border)'}`,
                  boxShadow: matrixCategoryFilter === cat ? `0 4px 20px ${meta.color}15` : 'var(--card-shadow)',
                }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>{cat}</span>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{c.total}</span>
                </div>
                <div className="text-[24px] font-bold leading-none" style={{ color: isWeak ? '#EF4444' : 'var(--text-primary)' }}>
                  {pct}%
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {c.with_tests} of {c.total} verified
                </div>
                <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  <span>Code: {c.with_code}</span>
                  <span>Risk: {c.with_risk_link}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          LEVEL 2B — VIEW TOGGLE: MATRIX RTM | GRAPH
          ═══════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Traceability Matrix (FDA Premarket Guidance)</p>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setView('matrix')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
            style={{
              background: view === 'matrix' ? 'var(--card-bg)' : 'transparent',
              color: view === 'matrix' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: view === 'matrix' ? 'var(--card-shadow)' : 'none',
            }}>
            <TableIcon size={12} /> Matrix RTM
          </button>
          <button onClick={() => setView('graph')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
            style={{
              background: view === 'graph' ? 'var(--card-bg)' : 'transparent',
              color: view === 'graph' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: view === 'graph' ? 'var(--card-shadow)' : 'none',
            }}>
            <Network size={12} /> Graph
          </button>
        </div>
      </div>

      {/* ─── MATRIX VIEW ─── */}
      {view === 'matrix' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          {/* Filters */}
          <div className="flex items-center gap-2 p-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Filter:</span>
            {(['all', 'complete', 'partial', 'uncovered'] as const).map(f => {
              const cfg = f !== 'all' ? STATUS_CONFIG[f] : null;
              const count = f === 'all' ? (data.rtm_rows || []).length : (data.rtm_rows || []).filter(r => r.status === f).length;
              return (
                <button key={f} onClick={() => setMatrixFilter(f)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all"
                  style={{
                    background: matrixFilter === f ? (cfg?.color || 'var(--accent-teal)') : 'var(--bg-tertiary)',
                    color: matrixFilter === f ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${matrixFilter === f ? (cfg?.color || 'var(--accent-teal)') : 'var(--border-subtle)'}`,
                  }}>
                  {cfg && <cfg.icon size={10} />}
                  {f === 'all' ? 'All' : cfg?.label} <span className="font-mono opacity-80">({count})</span>
                </button>
              );
            })}
            {matrixCategoryFilter && (
              <>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
                <button onClick={() => setMatrixCategoryFilter('')}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-lg"
                  style={{ background: (CATEGORY_LABELS[matrixCategoryFilter]?.color || '#94A3B8') + '15', color: CATEGORY_LABELS[matrixCategoryFilter]?.color || '#94A3B8', border: `1px solid ${CATEGORY_LABELS[matrixCategoryFilter]?.color || '#94A3B8'}30` }}>
                  Category: {matrixCategoryFilter} ✕
                </button>
              </>
            )}
            <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{filteredRtm.length} of {(data.rtm_rows || []).length} requirements</span>
          </div>

          {/* Table */}
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-tertiary)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-[9px] font-bold uppercase tracking-wider px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>Req ID</th>
                  <th className="text-[9px] font-bold uppercase tracking-wider px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>Description</th>
                  <th className="text-[9px] font-bold uppercase tracking-wider px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>Cat</th>
                  <th className="text-[9px] font-bold uppercase tracking-wider px-3 py-2.5 text-center" style={{ color: 'var(--text-muted)' }}>Code</th>
                  <th className="text-[9px] font-bold uppercase tracking-wider px-3 py-2.5 text-center" style={{ color: 'var(--text-muted)' }}>Tests</th>
                  <th className="text-[9px] font-bold uppercase tracking-wider px-3 py-2.5 text-center" style={{ color: 'var(--text-muted)' }}>Risk</th>
                  <th className="text-[9px] font-bold uppercase tracking-wider px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRtm.map(r => {
                  const status = STATUS_CONFIG[r.status];
                  const catMeta = CATEGORY_LABELS[r.category] || { color: '#94A3B8', name: r.category, desc: '' };
                  return (
                    <tr key={r.req_id} className="transition-colors group"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td className="px-3 py-2.5">
                        <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-teal)' }}>{r.req_id}</code>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] line-clamp-1" style={{ color: 'var(--text-primary)' }}>{r.description || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${catMeta.color}15`, color: catMeta.color }}>{r.category}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[11px] font-semibold" style={{ color: r.code_count > 0 ? 'var(--text-primary)' : '#EF4444' }}>{r.code_count}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[11px] font-semibold" style={{ color: r.test_count > 0 ? 'var(--text-primary)' : '#EF4444' }}>{r.test_count}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[11px] font-semibold" style={{ color: r.risk_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{r.risk_count}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ background: status.bg, color: status.color }}>
                          <status.icon size={9} /> {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredRtm.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>No requirements match this filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── GRAPH VIEW ─── */}
      {view === 'graph' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)', height: 520 }}>
          <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {Object.entries(TYPE_COLORS).map(([type, color]) => {
              const count = (data.nodes || []).filter(n => n.type === type).length;
              return (
                <span key={type} className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {TYPE_LABELS[type]} {count}
                </span>
              );
            })}
            <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {data.stats?.total_nodes ?? 0} nodes · {data.stats?.total_edges ?? 0} edges
            </span>
          </div>
          <div style={{ height: 'calc(100% - 49px)' }}>
            <ReactFlow nodes={rfNodes} edges={rfEdges} onNodeClick={onNodeClick} fitView
              minZoom={0.2} maxZoom={2} defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}>
              <Controls />
              <MiniMap nodeColor={(n) => TYPE_COLORS[(data.nodes || []).find(dn => dn.id === n.id)?.type || 'code'] || '#94A3B8'} />
              <Background />
            </ReactFlow>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEVEL 3 — ENRICHED ORPHANS
          Per-orphan card with reasoning + standard ref + CTA
          ═══════════════════════════════════════ */}
      {totalOrphans > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Traceability Gaps — Each Will Be Flagged by Auditor
          </p>

          {/* REQs without tests */}
          {orphansSafe.requirements_without_tests.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--card-bg)', border: '1px solid rgba(239,68,68,0.20)', boxShadow: '0 4px 20px rgba(239,68,68,0.06)' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertTriangle size={14} style={{ color: '#EF4444' }} />
                <div className="flex-1">
                  <span className="text-[12px] font-bold" style={{ color: '#EF4444' }}>
                    Requirements Without Test Verification ({orphansSafe.requirements_without_tests.length})
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>IEC 62304 §5.5 + §5.6 — every requirement must have ≥1 verification record</p>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {orphansSafe.requirements_without_tests.slice(0, 6).map(o => (
                  <div key={o.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-[10px] font-mono font-bold" style={{ color: '#EF4444' }}>{o.id}</code>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${CATEGORY_LABELS[o.category]?.color || '#94A3B8'}15`, color: CATEGORY_LABELS[o.category]?.color || '#94A3B8' }}>
                          {o.category}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: o.safety_class === 'C' ? 'rgba(239,68,68,0.15)' : o.safety_class === 'B' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: o.safety_class === 'C' ? '#EF4444' : o.safety_class === 'B' ? '#F59E0B' : '#10B981' }}>
                          Class {o.safety_class}
                        </span>
                      </div>
                      {o.description && <p className="text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>{o.description}</p>}
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: '#EF4444', fontWeight: 600 }}>Reason: </span>{o.reason}
                      </p>
                      {o.code_modules.length > 0 && (
                        <p className="text-[9px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                          Implemented in: {o.code_modules.slice(0, 3).map(c => c.replace('CODE-', '')).join(', ')}
                        </p>
                      )}
                      <p className="text-[9px] italic mt-1" style={{ color: 'var(--text-muted)' }}>{o.standard_ref}</p>
                    </div>
                    <Link to="/forms" state={{ template: o.suggested_form, prefill: { req_id: o.id } }}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 hover:opacity-80 transition-opacity"
                      style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.20)' }}>
                      <FileText size={10} /> Create {o.suggested_form} <ArrowRight size={10} />
                    </Link>
                  </div>
                ))}
                {orphansSafe.requirements_without_tests.length > 6 && (
                  <div className="px-4 py-2.5 text-[10px] font-semibold text-center" style={{ color: 'var(--text-muted)' }}>
                    + {orphansSafe.requirements_without_tests.length - 6} more — see Matrix RTM (filter: Uncovered)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk controls without verification */}
          {data.orphans.risk_controls_without_verification.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--card-bg)', border: '1px solid rgba(239,68,68,0.20)', boxShadow: '0 4px 20px rgba(239,68,68,0.06)' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertTriangle size={14} style={{ color: '#EF4444' }} />
                <div className="flex-1">
                  <span className="text-[12px] font-bold" style={{ color: '#EF4444' }}>
                    Risk Controls Without Verification ({data.orphans.risk_controls_without_verification.length})
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ISO 14971 §7.3 — each risk control needs verification of implementation AND effectiveness</p>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {data.orphans.risk_controls_without_verification.slice(0, 6).map(o => (
                  <div key={o.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <code className="text-[10px] font-mono font-bold mb-1 inline-block" style={{ color: '#EF4444' }}>{o.id}</code>
                      {o.description && <p className="text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>{o.description}</p>}
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: '#EF4444', fontWeight: 600 }}>Reason: </span>{o.reason}
                      </p>
                      <p className="text-[9px] italic mt-1" style={{ color: 'var(--text-muted)' }}>{o.standard_ref}</p>
                    </div>
                    <Link to="/forms" state={{ template: o.suggested_form, prefill: { hazard_id: o.id } }}
                      className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 hover:opacity-80 transition-opacity"
                      style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.20)' }}>
                      <FileText size={10} /> Create {o.suggested_form} <ArrowRight size={10} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code without REQ trace */}
          {data.orphans.code_without_requirements.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--card-bg)', border: '1px solid rgba(245,158,11,0.20)', boxShadow: '0 4px 20px rgba(245,158,11,0.06)' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.05)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
                <AlertCircle size={14} style={{ color: '#F59E0B' }} />
                <div className="flex-1">
                  <span className="text-[12px] font-bold" style={{ color: '#F59E0B' }}>
                    Code Modules Without Requirement Trace ({data.orphans.code_without_requirements.length})
                  </span>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>IEC 62304 §5.2.6 + §5.3 — every code module must trace to a requirement (add REQ-XXX-XXX comment)</p>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {data.orphans.code_without_requirements.slice(0, 8).map(o => (
                  <div key={o.id} className="px-4 py-2.5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <code className="text-[10px] font-mono font-bold" style={{ color: o.is_class_c ? '#EF4444' : '#F59E0B' }}>{o.id.replace('CODE-', '')}</code>
                        {o.is_class_c && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                            Class C
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }} title={o.path}>{o.path}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: o.is_class_c ? '#EF4444' : '#F59E0B', fontWeight: 600 }}>Reason: </span>{o.reason}
                      </p>
                    </div>
                  </div>
                ))}
                {data.orphans.code_without_requirements.length > 8 && (
                  <div className="px-4 py-2.5 text-[10px] font-semibold text-center" style={{ color: 'var(--text-muted)' }}>
                    + {data.orphans.code_without_requirements.length - 8} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {totalOrphans === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: '#10B981' }} />
          <p className="text-[14px] font-bold" style={{ color: '#10B981' }}>Full Traceability Coverage</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>No orphans detected. Bidirectional traceability satisfies IEC 62304 §5.1.1.</p>
        </div>
      )}
    </div>
  );
}
