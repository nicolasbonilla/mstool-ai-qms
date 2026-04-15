import { useEffect, useState } from 'react';
import { getDetailedScore, getCommits, getCIRuns, getCheckEvidence, getScoreHistory } from '../api/compliance';
import {
  Activity, Shield, Lock, AlertTriangle, ExternalLink,
  GitCommit, CheckCircle2, XCircle, Clock, ChevronRight,
  ShieldCheck, Code, FileText, Users, Bug, Sparkles, ArrowUpRight, CircleDot,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

/* ─── Types ─── */
interface Evidence { file: string; github_url: string; detail: string; status: string; test_url?: string }
interface Check { id: string; title: string; standard: string; description: string; score: number; status: string; evidence: Evidence[]; summary: string; action: string | null }
interface Data { computed_at: string; scores: Record<string, number>; checks: Check[]; repo: string }
interface Commit { sha: string; message: string; author: string; date: string }
interface CIRun { id: number; name: string; conclusion: string | null; created_at: string; head_sha: string }

const ICONS: Record<string, React.ElementType> = {
  auth_coverage: Lock, input_validation: ShieldCheck, test_coverage: Code,
  risk_verification: AlertTriangle, doc_completeness: FileText, doc_freshness: Clock,
  soup_vulnerability: Bug, codeowners_coverage: Users,
};

/* ─── Sparkline (area + line + dot) ─── */
function Sparkline({ data, color, width = 100, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data) - 1, max = Math.max(...data) + 1;
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill={`url(#sg-${color.replace('#','')})`} stroke="none" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="3" fill={color} />
    </svg>
  );
}

/* ─── Animated Counter ─── */
function Counter({ to }: { to: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame: number, start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * to * 10) / 10);
      if (p < 1) frame = requestAnimationFrame(step);
      else setVal(to);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <>{val}</>;
}

/* ─── Category Bar (segmented horizontal bar) ─── */
function CategoryBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {segments.map((seg, i) => (
          <div key={i} className="h-full rounded-full transition-all duration-700" style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }} />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{seg.label} {seg.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Gradient Bar ─── */
function GradientBar({ value, from, to: toColor }: { value: number; from: string; to: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
      <div className="h-full rounded-full" style={{
        width: `${Math.min(value, 100)}%`, background: `linear-gradient(90deg, ${from}, ${toColor})`,
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)', boxShadow: `0 0 6px ${from}30`,
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [ci, setCi] = useState<CIRun[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [deepEvidence, setDeepEvidence] = useState<Record<string, any>>({});
  const [evidenceLoading, setLoadingEvidence] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDetailedScore(), getCommits(6), getCIRuns(5), getScoreHistory(14)])
      .then(([s, c, r, h]) => {
        setData(s.data); setCommits(c.data.commits || []); setCi(r.data.ci_runs || []);
        const hist = h.data.history || [];
        const keys = ['ce_mark_overall', 'iec62304', 'iso13485', 'cybersecurity'];
        const mapped: Record<string, number[]> = {};
        keys.forEach(k => { mapped[k] = hist.map((entry: any) => entry.scores?.[k] || 0); });
        setHistory(mapped);
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleCheck = async (checkId: string) => {
    if (open === checkId) { setOpen(null); return; }
    setOpen(checkId);
    if (!deepEvidence[checkId]) {
      setLoadingEvidence(checkId);
      try {
        const { data: d } = await getCheckEvidence(checkId);
        setDeepEvidence(prev => ({ ...prev, [checkId]: d }));
      } catch { /* fallback */ }
      setLoadingEvidence(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] border-teal/20 border-t-teal animate-spin" />
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Analyzing repository compliance...</p>
      </div>
    </div>
  );
  if (!data) return null;

  const SCORES = [
    { key: 'ce_mark_overall', label: 'CE Mark Overall', sub: 'EU MDR 2017/745', color: '#0EA5E9', icon: Shield },
    { key: 'iec62304', label: 'IEC 62304', sub: 'Software Lifecycle', color: '#10B981', icon: FileText },
    { key: 'iso13485', label: 'ISO 13485', sub: 'Quality Management', color: '#8B5CF6', icon: ShieldCheck },
    { key: 'cybersecurity', label: 'Cybersecurity', sub: 'IEC 81001-5-1', color: '#F59E0B', icon: Lock },
  ];

  const pass = data.checks.filter(c => c.status === 'pass').length;

  const statusConfig: Record<string, { gradient: [string, string]; icon: React.ElementType }> = {
    pass: { gradient: ['#10B981', '#34D399'], icon: CheckCircle2 },
    warn: { gradient: ['#F59E0B', '#FBBF24'], icon: AlertTriangle },
    fail: { gradient: ['#EF4444', '#F87171'], icon: XCircle },
  };

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Compliance Dashboard</h1>
          <p className="text-[13px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <a href={data.repo} target="_blank" rel="noopener" className="hover:text-teal transition-colors inline-flex items-center gap-1">
              nicolasbonilla/medical-imaging-viewer <ExternalLink size={10} />
            </a>
            <span>·</span>
            {new Date(data.computed_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 px-3 py-1.5 rounded-full" style={{ background: 'var(--status-pass-bg)', boxShadow: 'inset 0 0 0 1px var(--status-pass-ring)' }}>
          <CircleDot size={11} /> {pass}/{data.checks.length} passing
        </div>
      </div>

      {/* ─── KPI Cards (Tremor pattern: number + delta + sparkline) ─── */}
      <div className="grid grid-cols-4 gap-4">
        {SCORES.map(({ key, label, sub, color, icon: Icon }) => {
          const val = data.scores[key];
          const sparkData = history[key] || [];
          const prevVal = sparkData.length >= 2 ? sparkData[sparkData.length - 2] : val;
          const delta = Math.round((val - prevVal) * 10) / 10;

          return (
            <div key={key} className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
              </div>

              {/* Big number + delta */}
              <div className="flex items-end gap-2 mb-1">
                <span className="text-[32px] font-extrabold tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
                  <Counter to={val} />
                </span>
                <span className="text-[18px] font-bold tracking-tight mb-0.5" style={{ color: 'var(--text-muted)' }}>%</span>
                {delta !== 0 && (
                  <span className={`flex items-center gap-0.5 text-[11px] font-bold mb-1 ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : ''}`}>
                    {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                    {delta > 0 ? '+' : ''}{delta}%
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium mb-3" style={{ color: 'var(--text-muted)' }}>{sub}</p>

              {/* Sparkline */}
              {sparkData.length >= 2 ? (
                <Sparkline data={sparkData} color={color} width={160} height={36} />
              ) : (
                <GradientBar value={val} from={color} to={`${color}80`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Score Breakdown (Category Bar) ─── */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <h2 className="text-[13px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>CE Mark Score Composition</h2>
        <div className="flex items-center gap-4 mb-3">
          <code className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
            CE = IEC 62304 × 0.35 + ISO 13485 × 0.30 + Cybersecurity × 0.20 + Docs × 0.15
          </code>
        </div>
        <CategoryBar segments={[
          { value: Math.round(data.scores.iec62304 * 0.35), color: '#10B981', label: 'IEC 62304' },
          { value: Math.round(data.scores.iso13485 * 0.30), color: '#8B5CF6', label: 'ISO 13485' },
          { value: Math.round(data.scores.cybersecurity * 0.20), color: '#F59E0B', label: 'Cybersecurity' },
          { value: Math.round((data.checks.find(c => c.id === 'doc_completeness')?.score || 100) * 0.15), color: '#0EA5E9', label: 'Docs' },
        ]} />
      </div>

      {/* ─── Compliance Evidence ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>Compliance Evidence</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Click to inspect</span>
        </div>

        <div className="grid gap-2.5">
          {data.checks.map((check) => {
            const isOpen = open === check.id;
            const Icon = ICONS[check.id] || Shield;
            const score = Math.round(check.score * 10) / 10;
            const sc = statusConfig[check.status] || statusConfig.fail;

            return (
              <div key={check.id} className="rounded-2xl border overflow-hidden transition-all duration-200"
                style={{
                  background: 'var(--card-bg)',
                  borderColor: isOpen ? `${sc.gradient[0]}40` : 'var(--card-border)',
                  boxShadow: isOpen ? `0 4px 20px ${sc.gradient[0]}10` : 'var(--card-shadow)',
                }}>
                <button onClick={() => toggleCheck(check.id)} className="w-full flex items-center gap-4 p-4 text-left group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${sc.gradient[0]}12` }}>
                    <Icon size={18} style={{ color: sc.gradient[0] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{check.title}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ background: `${sc.gradient[0]}12`, color: sc.gradient[0], boxShadow: `inset 0 0 0 1px ${sc.gradient[0]}25` }}>
                        {check.status}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{check.standard}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[18px] font-extrabold tabular-nums" style={{ color: sc.gradient[0] }}>{score}%</span>
                    <div className="w-24">
                      <GradientBar value={score} from={sc.gradient[0]} to={sc.gradient[1]} />
                    </div>
                    <ChevronRight size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--card-border)' }}>
                    {/* Description */}
                    <div className="flex gap-3 p-4 mt-3 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50/50 border border-sky-100/80">
                      <Sparkles size={14} className="text-sky-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] text-sky-900 leading-relaxed font-medium">{check.description}</p>
                        <p className="text-[10px] text-sky-500 mt-1.5 font-mono font-semibold">{check.standard}</p>
                      </div>
                    </div>

                    {/* Calculation */}
                    {deepEvidence[check.id]?.calculation && (
                      <div className="mt-3 px-4 py-2.5 rounded-lg font-mono text-[12px] font-semibold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {deepEvidence[check.id].calculation}
                      </div>
                    )}

                    {/* Loading */}
                    {evidenceLoading === check.id && (
                      <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
                        Loading evidence with source code...
                      </div>
                    )}

                    {/* Deep evidence */}
                    {deepEvidence[check.id]?.evidence ? (
                      <div className="mt-3 space-y-2">
                        {deepEvidence[check.id].evidence.map((ev: any, i: number) => (
                          <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
                            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--bg-tertiary)' }}>
                              <div className="flex items-center gap-2">
                                <code className="text-[11px] font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>{ev.file || ev.module || ev.standard}</code>
                                {ev.status === 'pass' && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md ring-1 ring-emerald-200/50 inline-flex items-center gap-1"><CheckCircle2 size={9} /> PASS</span>}
                                {ev.status === 'fail' && <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md ring-1 ring-red-200/50 inline-flex items-center gap-1"><XCircle size={9} /> FAIL</span>}
                                {ev.total_endpoints !== undefined && <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{ev.protected_endpoints}/{ev.total_endpoints} protected</span>}
                                {ev.expected !== undefined && <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{ev.found}/{ev.expected} docs</span>}
                              </div>
                              {(ev.github_url || ev.url) && <a href={ev.github_url || ev.url} target="_blank" rel="noopener" className="text-[10px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--accent-teal)' }}>View on GitHub <ArrowUpRight size={9} /></a>}
                            </div>
                            {(ev.auth_lines?.length > 0 || ev.validation_lines?.length > 0) && (
                              <div className="px-3 py-2 space-y-1" style={{ background: 'var(--code-bg)' }}>
                                {(ev.auth_lines || ev.validation_lines || []).slice(0, 3).map((line: any, j: number) => (
                                  <a key={j} href={line.url} target="_blank" rel="noopener" className="flex items-start gap-3 px-2 py-1 rounded hover:opacity-80 transition-opacity">
                                    <span className="text-[10px] font-mono shrink-0 w-8 text-right" style={{ color: 'var(--code-line-number)' }}>L{line.line}</span>
                                    <code className="text-[11px] font-mono flex-1 truncate" style={{ color: 'var(--code-text)' }}>{line.text}</code>
                                    <ArrowUpRight size={9} className="shrink-0 mt-1" style={{ color: 'var(--accent-teal)' }} />
                                  </a>
                                ))}
                              </div>
                            )}
                            {ev.test_functions?.length > 0 && (
                              <div className="px-3 py-2 space-y-1" style={{ background: 'var(--code-bg)' }}>
                                {ev.test_functions.map((tf: any, j: number) => (
                                  <a key={j} href={tf.url} target="_blank" rel="noopener" className="flex items-center gap-3 px-2 py-1 rounded hover:opacity-80">
                                    <span className="text-[10px] font-mono shrink-0 w-8 text-right" style={{ color: 'var(--code-line-number)' }}>L{tf.line}</span>
                                    <code className="text-[11px] font-mono flex-1" style={{ color: 'var(--code-text)' }}>{tf.name}</code>
                                    <ArrowUpRight size={9} style={{ color: 'var(--accent-teal)' }} />
                                  </a>
                                ))}
                              </div>
                            )}
                            {(ev.verified_lines?.length > 0 || ev.partial_lines?.length > 0) && (
                              <div className="px-3 py-2 space-y-1">
                                {ev.verified_lines?.slice(0, 5).map((line: any, j: number) => (
                                  <a key={`v${j}`} href={line.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono hover:opacity-80" style={{ background: 'var(--status-pass-bg)', color: 'var(--status-pass-text)' }}>
                                    <CheckCircle2 size={10} /> L{line.line}: {line.text}
                                  </a>
                                ))}
                                {ev.partial_lines?.slice(0, 5).map((line: any, j: number) => (
                                  <a key={`p${j}`} href={line.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono hover:opacity-80" style={{ background: 'var(--status-warn-bg)', color: 'var(--status-warn-text)' }}>
                                    <Clock size={10} /> L{line.line}: {line.text}
                                  </a>
                                ))}
                              </div>
                            )}
                            {ev.documents?.length > 0 && (
                              <div className="px-3 py-2 space-y-1" style={{ background: 'var(--code-bg)' }}>
                                {ev.documents.map((doc: any, j: number) => (
                                  <a key={j} href={doc.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono hover:opacity-80" style={{ color: 'var(--code-text)' }}>
                                    <FileText size={10} style={{ color: 'var(--text-muted)' }} /> {doc.name} <ArrowUpRight size={9} className="ml-auto" style={{ color: 'var(--accent-teal)' }} />
                                  </a>
                                ))}
                              </div>
                            )}
                            {ev.codeowners_line && (
                              <div className="px-3 py-2" style={{ background: 'var(--code-bg)' }}>
                                <a href={ev.codeowners_line.url} target="_blank" rel="noopener" className="flex items-center gap-3 px-2 py-1 rounded hover:opacity-80">
                                  <span className="text-[10px] font-mono shrink-0 w-8 text-right" style={{ color: 'var(--code-line-number)' }}>L{ev.codeowners_line.number}</span>
                                  <code className="text-[11px] font-mono flex-1" style={{ color: ev.status === 'pass' ? 'var(--status-pass-text)' : 'var(--status-fail-text)' }}>{ev.codeowners_line.text}</code>
                                  <ArrowUpRight size={9} style={{ color: 'var(--accent-teal)' }} />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : !evidenceLoading && (
                      <div className="mt-3 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
                        <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--card-border)' }}>
                          <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Evidence Trail</span>
                        </div>
                        {check.evidence.map((ev, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-3 transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="flex-1 min-w-0">
                              <code className="text-[11px] font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>{ev.file}</code>
                              <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{ev.detail}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-3">
                              {ev.status === 'protected' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg ring-1 ring-emerald-200/50"><CheckCircle2 size={11} /> PASS</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-lg ring-1 ring-red-200/50"><XCircle size={11} /> FAIL</span>
                              )}
                              <a href={ev.github_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--accent-teal)' }}>GitHub <ArrowUpRight size={10} /></a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {check.action && (
                      <div className="flex gap-3 p-4 mt-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-800">Recommended Action</p>
                          <p className="text-[12px] text-amber-700 mt-0.5">{check.action}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Activity ─── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 transition-all duration-200" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <GitCommit size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            Recent Commits
          </h3>
          <div className="space-y-3">
            {commits.map(c => (
              <div key={c.sha} className="flex items-start gap-3 group p-2 -mx-2 rounded-lg transition-colors" style={{ cursor: 'default' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <code className="text-[10px] px-2 py-0.5 rounded-md font-mono shrink-0 mt-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{c.sha}</code>
                <div className="min-w-0">
                  <p className="text-[12px] truncate leading-snug font-medium" style={{ color: 'var(--text-secondary)' }}>{c.message}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.author} · {new Date(c.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5 transition-all duration-200" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <Activity size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            CI Pipeline
          </h3>
          <div className="space-y-2">
            {ci.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 -mx-2 rounded-lg transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  r.conclusion === 'success' ? 'bg-emerald-500' : r.conclusion === 'failure' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'
                }`} style={{ boxShadow: `0 0 6px ${r.conclusion === 'success' ? '#10B98150' : r.conclusion === 'failure' ? '#EF444450' : '#F59E0B50'}` }} />
                <span className="text-[12px] truncate flex-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                  r.conclusion === 'success' ? 'text-emerald-600 bg-emerald-50' : r.conclusion === 'failure' ? 'text-red-500 bg-red-50' : 'text-amber-500 bg-amber-50'
                }`}>{r.conclusion || 'running'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
