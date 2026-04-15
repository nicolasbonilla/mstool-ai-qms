import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDetailedScore, getCommits, getCIRuns, getCheckEvidence } from '../api/compliance';
import {
  Activity, Shield, Lock, AlertTriangle, ExternalLink,
  GitCommit, CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown,
  ShieldCheck, Code, FileText, Users, Bug, Sparkles, ArrowUpRight,
  ArrowRight,
} from 'lucide-react';
import DashboardSkeleton from '../components/ui/DashboardSkeleton';

/* ─── Types ─── */
interface Evidence { file: string; github_url: string; detail: string; status: string }
interface Check { id: string; title: string; standard: string; description: string; score: number; status: string; evidence: Evidence[]; summary: string; action: string | null }
interface Data { computed_at: string; scores: Record<string, number>; checks: Check[]; repo: string }
interface Commit { sha: string; message: string; author: string; date: string }
interface CIRun { id: number; name: string; conclusion: string | null; created_at: string; head_sha: string }

const ICONS: Record<string, React.ElementType> = {
  auth_coverage: Lock, input_validation: ShieldCheck, test_coverage: Code,
  risk_verification: AlertTriangle, doc_completeness: FileText, doc_freshness: Clock,
  soup_vulnerability: Bug, codeowners_coverage: Users,
};

/* ─── Responsibility Areas (how IEC 62304 / ISO 13485 / IEC 81001-5-1 organize compliance) ─── */
const AREAS = [
  {
    id: 'lifecycle', title: 'Software Lifecycle', standard: 'IEC 62304',
    description: 'Software development process — testing, risk management, and code quality',
    color: '#10B981', checks: ['test_coverage', 'risk_verification', 'input_validation'],
    weight: 0.35,
  },
  {
    id: 'quality', title: 'Quality Management', standard: 'ISO 13485',
    description: 'Documentation completeness, freshness, and code review enforcement',
    color: '#8B5CF6', checks: ['doc_completeness', 'doc_freshness', 'codeowners_coverage'],
    weight: 0.30,
  },
  {
    id: 'cybersecurity', title: 'Cybersecurity', standard: 'IEC 81001-5-1',
    description: 'API authentication, input validation, and dependency security',
    color: '#F59E0B', checks: ['auth_coverage', 'soup_vulnerability'],
    weight: 0.20,
  },
];

/* ═══════════════════════════════════════════════════════
   DASHBOARD — 3-Level Information Architecture
   Level 1: Status banner ("Is everything OK?")
   Level 2: Responsibility areas ("Where are the problems?")
   Level 3: Drill-down evidence ("What exactly do I fix?")

   Based on:
   - Shneiderman's Mantra: overview → zoom → details-on-demand
   - GoodData 6 Principles of Dashboard IA
   - ISO 9241-12 Presentation of Information
   - Progressive Disclosure (IxDF, IBM Design)
   ═══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [ci, setCi] = useState<CIRun[]>([]);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [deepEvidence, setDeepEvidence] = useState<Record<string, any>>({});
  const [evidenceLoading, setEvidenceLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDetailedScore(), getCommits(6), getCIRuns(5)])
      .then(([s, c, r]) => { setData(s.data); setCommits(c.data.commits || []); setCi(r.data.ci_runs || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const navigate = useNavigate();

  const loadEvidence = async (checkId: string) => {
    if (expandedCheck === checkId) { setExpandedCheck(null); return; }
    setExpandedCheck(checkId);
    if (!deepEvidence[checkId]) {
      setEvidenceLoading(checkId);
      try {
        const { data: d } = await getCheckEvidence(checkId);
        setDeepEvidence(prev => ({ ...prev, [checkId]: d }));
      } catch { /* fallback */ }
      setEvidenceLoading(null);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const checksMap = Object.fromEntries(data.checks.map(c => [c.id, c]));
  const totalPass = data.checks.filter(c => c.status === 'pass').length;
  const totalChecks = data.checks.length;
  const ceScore = data.scores.ce_mark_overall;
  const actionChecks = data.checks.filter(c => c.action);
  // Only the LATEST CI run matters for urgency — historical failures are resolved
  const latestCI = ci.length > 0 ? ci[0] : null;
  const ciCurrentlyFailing = latestCI?.conclusion === 'failure';
  const isReady = ceScore >= 95 && actionChecks.length === 0 && !ciCurrentlyFailing;
  const hasUrgent = actionChecks.length > 0 || ciCurrentlyFailing;

  return (
    <div className="space-y-5">

      {/* ═══════════════════════════════════════════════
          SECTION 1 — STATUS BANNER
          "Am I ready for the CE Mark audit?"
          Includes: score, target context, repo link, timestamp
          ═══════════════════════════════════════════════ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: isReady ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))' : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))',
          border: `1px solid ${isReady ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: isReady ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}>
            {isReady ? <CheckCircle2 size={24} style={{ color: '#10B981' }} /> : <AlertTriangle size={24} style={{ color: '#F59E0B' }} />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{ceScore}%</span>
              <span className="text-[14px] font-bold" style={{ color: isReady ? '#10B981' : '#F59E0B' }}>
                {isReady ? 'CE Mark Ready' : ceScore >= 95 ? 'Almost Ready' : 'Actions Needed'}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                target: ≥95%
              </span>
            </div>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {totalPass}/{totalChecks} checks · {actionChecks.length} action{actionChecks.length !== 1 ? 's' : ''} pending · {ciCurrentlyFailing ? <span style={{ color: '#EF4444' }}>CI failing</span> : <span style={{ color: '#10B981' }}>CI passing</span>} ·{' '}
              <a href={data.repo} target="_blank" rel="noopener" className="hover:underline inline-flex items-center gap-1" style={{ color: 'var(--accent-teal)' }}>
                nicolasbonilla/medical-imaging-viewer <ExternalLink size={10} />
              </a>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/audit')} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            Run Audit →
          </button>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {new Date(data.computed_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          SECTION 2 — URGENT ACTIONS
          "What do I need to fix RIGHT NOW?"
          Only shows if there are pending actions or CI failures
          ═══════════════════════════════════════════════ */}
      {hasUrgent && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            Requires Attention ({actionChecks.length + (ciCurrentlyFailing ? 1 : 0)})
          </p>
          <div className="space-y-2">
            {/* CI failure — only if the LATEST run is failing (not historical) */}
            {ciCurrentlyFailing && latestCI && (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.1)' }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.4)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold" style={{ color: '#EF4444' }}>CI Pipeline Failing</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{latestCI.name} · {latestCI.head_sha} · Latest run failed</p>
                </div>
                <a href={data.repo + '/actions'} target="_blank" rel="noopener" className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>
                  View Logs <ArrowUpRight size={9} className="inline ml-0.5" />
                </a>
              </div>
            )}
            {/* Compliance actions */}
            {actionChecks.map(check => {
              const Icon = ICONS[check.id] || Shield;
              return (
                <div key={check.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.1)' }}>
                    <Icon size={14} style={{ color: '#F59E0B' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{check.title}: {Math.round(check.score * 10) / 10}%</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{check.action}</p>
                  </div>
                  <button onClick={() => navigate('/forms')} className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80 shrink-0"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
                    Create Form →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          SECTION 3 — COMPLIANCE AREAS
          Answers: "Where are the problems?"
          Grouped by standard (IEC 62304, ISO 13485, IEC 81001-5-1)
          ═══════════════════════════════════════════════ */}
      <div className="space-y-4">
        {AREAS.map((area) => {
          const areaChecks = area.checks.map(id => checksMap[id]).filter(Boolean);
          const areaPass = areaChecks.filter(c => c.status === 'pass').length;
          const areaScore = areaChecks.length > 0 ? Math.round(areaChecks.reduce((s, c) => s + c.score, 0) / areaChecks.length * 10) / 10 : 0;
          const areaActions = areaChecks.filter(c => c.action);
          const isAreaOpen = expandedArea === area.id;

          return (
            <div key={area.id} className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: 'var(--card-bg)', border: `1px solid ${isAreaOpen ? `${area.color}30` : 'var(--card-border)'}`,
                boxShadow: isAreaOpen ? `0 4px 20px ${area.color}10` : 'var(--card-shadow)',
              }}>

              {/* Area header — clickable */}
              <button onClick={() => setExpandedArea(isAreaOpen ? null : area.id)}
                className="w-full flex items-center gap-4 p-5 text-left group">
                {/* Color indicator */}
                <div className="w-1.5 h-12 rounded-full shrink-0" style={{ background: area.color }} />

                {/* Title + standard */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>{area.title}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono"
                      style={{ background: `${area.color}12`, color: area.color }}>{area.standard}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>× {area.weight} weight</span>
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{area.description}</p>
                </div>

                {/* Score + status */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Checks summary */}
                  <div className="flex items-center gap-1.5">
                    {areaChecks.map(c => (
                      <div key={c.id} className="w-2.5 h-2.5 rounded-full" title={`${c.title}: ${c.status}`}
                        style={{ background: c.status === 'pass' ? '#10B981' : c.status === 'warn' ? '#F59E0B' : '#EF4444' }} />
                    ))}
                  </div>

                  {/* Score */}
                  <span className="text-[20px] font-extrabold tabular-nums" style={{ color: areaScore >= 90 ? '#10B981' : areaScore >= 70 ? '#F59E0B' : '#EF4444' }}>
                    {areaScore}%
                  </span>

                  {/* Actions badge */}
                  {areaActions.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                      {areaActions.length} action{areaActions.length > 1 ? 's' : ''}
                    </span>
                  )}

                  <ChevronDown size={16} className={`transition-transform duration-200 ${isAreaOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                </div>
              </button>

              {/* ═══════════════════════════════════════
                  LEVEL 2.5 — CHECKS WITHIN AREA
                  Shows individual checks with scores
                  ═══════════════════════════════════════ */}
              {isAreaOpen && (
                <div className="px-5 pb-5 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest pt-3 pb-1" style={{ color: 'var(--text-muted)' }}>
                    Checks ({areaPass}/{areaChecks.length} passing)
                  </p>

                  {areaChecks.map((check) => {
                    const Icon = ICONS[check.id] || Shield;
                    const score = Math.round(check.score * 10) / 10;
                    const isPass = check.status === 'pass';
                    const statusColor = isPass ? '#10B981' : check.status === 'warn' ? '#F59E0B' : '#EF4444';
                    const isCheckOpen = expandedCheck === check.id;

                    return (
                      <div key={check.id} className="rounded-xl border overflow-hidden transition-all duration-200"
                        style={{ borderColor: isCheckOpen ? `${statusColor}30` : 'var(--border-subtle)', background: isCheckOpen ? 'var(--bg-elevated)' : 'transparent' }}>

                        {/* Check header */}
                        <button onClick={() => loadEvidence(check.id)} className="w-full flex items-center gap-3 p-3 text-left group">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                            style={{ background: `${statusColor}10` }}>
                            <Icon size={15} style={{ color: statusColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{check.title}</span>
                            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{check.standard}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[15px] font-bold tabular-nums" style={{ color: statusColor }}>{score}%</span>
                            {/* Mini progress */}
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                              <div className="h-full rounded-full" style={{ width: `${score}%`, background: `linear-gradient(90deg, ${statusColor}, ${statusColor}80)`, transition: 'width 0.6s ease-out' }} />
                            </div>
                            {check.action && <span className="w-2 h-2 rounded-full bg-amber-400" title="Action needed" />}
                            <ChevronRight size={13} className={`transition-transform duration-200 ${isCheckOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                          </div>
                        </button>

                        {/* ═══════════════════════════════════
                            LEVEL 3 — DRILL-DOWN EVIDENCE
                            Answers: "What exactly do I fix?"
                            ═══════════════════════════════════ */}
                        {isCheckOpen && (
                          <div className="px-3 pb-3 space-y-2">
                            {/* Why this matters */}
                            <div className="flex gap-2.5 p-3 rounded-lg bg-gradient-to-r from-sky-50 to-blue-50/50 border border-sky-100/80">
                              <Sparkles size={13} className="text-sky-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[11px] text-sky-900 leading-relaxed font-medium">{check.description}</p>
                                <p className="text-[10px] text-sky-500 mt-1 font-mono font-semibold">{check.standard}</p>
                              </div>
                            </div>

                            {/* Calculation */}
                            {deepEvidence[check.id]?.calculation && (
                              <div className="px-3 py-2 rounded-lg font-mono text-[11px] font-semibold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {deepEvidence[check.id].calculation}
                              </div>
                            )}

                            {/* Loading */}
                            {evidenceLoading === check.id && (
                              <div className="flex items-center gap-2 p-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
                                Loading source code evidence...
                              </div>
                            )}

                            {/* Deep evidence files */}
                            {deepEvidence[check.id]?.evidence?.map((ev: any, i: number) => (
                              <div key={i} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                                  <div className="flex items-center gap-2">
                                    <code className="text-[10px] font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>{ev.file || ev.module || ev.standard}</code>
                                    {ev.status === 'pass' && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ring-1 ring-emerald-200/50 inline-flex items-center gap-0.5"><CheckCircle2 size={8} />OK</span>}
                                    {ev.status === 'fail' && <span className="text-[8px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded ring-1 ring-red-200/50 inline-flex items-center gap-0.5"><XCircle size={8} />FAIL</span>}
                                    {ev.total_endpoints !== undefined && <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{ev.protected_endpoints}/{ev.total_endpoints} endpoints</span>}
                                    {ev.expected !== undefined && <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{ev.found}/{ev.expected} docs</span>}
                                  </div>
                                  {(ev.github_url || ev.url) && <a href={ev.github_url || ev.url} target="_blank" rel="noopener" className="text-[9px] font-semibold inline-flex items-center gap-0.5" style={{ color: 'var(--accent-teal)' }}>GitHub <ArrowUpRight size={8} /></a>}
                                </div>
                                {/* Code lines */}
                                {(ev.auth_lines?.length > 0 || ev.validation_lines?.length > 0) && (
                                  <div className="px-2 py-1.5 space-y-0.5" style={{ background: 'var(--code-bg)' }}>
                                    {(ev.auth_lines || ev.validation_lines || []).slice(0, 3).map((line: any, j: number) => (
                                      <a key={j} href={line.url} target="_blank" rel="noopener" className="flex items-start gap-2 px-1.5 py-0.5 rounded hover:opacity-80">
                                        <span className="text-[9px] font-mono shrink-0 w-7 text-right" style={{ color: 'var(--code-line-number)' }}>L{line.line}</span>
                                        <code className="text-[10px] font-mono flex-1 truncate" style={{ color: 'var(--code-text)' }}>{line.text}</code>
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {ev.test_functions?.length > 0 && (
                                  <div className="px-2 py-1.5 space-y-0.5" style={{ background: 'var(--code-bg)' }}>
                                    {ev.test_functions.slice(0, 5).map((tf: any, j: number) => (
                                      <a key={j} href={tf.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:opacity-80">
                                        <span className="text-[9px] font-mono shrink-0 w-7 text-right" style={{ color: 'var(--code-line-number)' }}>L{tf.line}</span>
                                        <code className="text-[10px] font-mono flex-1" style={{ color: 'var(--code-text)' }}>{tf.name}</code>
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {ev.verified_lines?.length > 0 && (
                                  <div className="px-2 py-1.5 space-y-0.5">
                                    {ev.verified_lines.slice(0, 5).map((line: any, j: number) => (
                                      <a key={j} href={line.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-1.5 py-0.5 rounded text-[10px] font-mono hover:opacity-80" style={{ background: 'var(--status-pass-bg)', color: 'var(--status-pass-text)' }}>
                                        <CheckCircle2 size={9} /> L{line.line}: {line.text}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {ev.documents?.length > 0 && (
                                  <div className="px-2 py-1.5 space-y-0.5" style={{ background: 'var(--code-bg)' }}>
                                    {ev.documents.slice(0, 8).map((doc: any, j: number) => (
                                      <a key={j} href={doc.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-1.5 py-0.5 rounded text-[10px] font-mono hover:opacity-80" style={{ color: 'var(--code-text)' }}>
                                        <FileText size={9} style={{ color: 'var(--text-muted)' }} /> {doc.name}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {ev.codeowners_line && (
                                  <div className="px-2 py-1.5" style={{ background: 'var(--code-bg)' }}>
                                    <a href={ev.codeowners_line.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:opacity-80">
                                      <span className="text-[9px] font-mono shrink-0 w-7 text-right" style={{ color: 'var(--code-line-number)' }}>L{ev.codeowners_line.number}</span>
                                      <code className="text-[10px] font-mono" style={{ color: ev.status === 'pass' ? 'var(--status-pass-text)' : 'var(--status-fail-text)' }}>{ev.codeowners_line.text}</code>
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Fallback basic evidence */}
                            {!deepEvidence[check.id] && !evidenceLoading && check.evidence.map((ev, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                <code className="text-[10px] font-mono flex-1" style={{ color: 'var(--text-secondary)' }}>{ev.file}: {ev.detail}</code>
                                {ev.status === 'protected' ? <CheckCircle2 size={12} style={{ color: '#10B981' }} /> : <XCircle size={12} style={{ color: '#EF4444' }} />}
                                <a href={ev.github_url} target="_blank" rel="noopener" className="text-[9px] font-semibold" style={{ color: 'var(--accent-teal)' }}>GitHub <ArrowUpRight size={8} /></a>
                              </div>
                            ))}

                            {/* Action */}
                            {check.action && (
                              <div className="flex gap-2.5 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60">
                                <ArrowRight size={13} className="text-amber-500 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-[10px] font-bold text-amber-800">Action Required</p>
                                  <p className="text-[11px] text-amber-700 mt-0.5">{check.action}</p>
                                </div>
                                <button onClick={() => navigate('/forms')}
                                  className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                                  style={{ background: 'rgba(245,158,11,0.15)', color: '#D97706' }}>
                                  Create Form →
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Activity ─── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="text-[13px] font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <GitCommit size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            Recent Commits
          </h3>
          <div className="space-y-2">
            {commits.map(c => (
              <div key={c.sha} className="flex items-start gap-2.5 p-2 -mx-2 rounded-lg transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <code className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{c.sha}</code>
                <div className="min-w-0">
                  <p className="text-[12px] truncate font-medium" style={{ color: 'var(--text-secondary)' }}>{c.message}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.author} · {new Date(c.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="text-[13px] font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <Activity size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            CI Pipeline
          </h3>
          <div className="space-y-2">
            {ci.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: r.conclusion === 'success' ? '#10B981' : r.conclusion === 'failure' ? '#EF4444' : '#F59E0B', boxShadow: `0 0 6px ${r.conclusion === 'success' ? '#10B98140' : r.conclusion === 'failure' ? '#EF444440' : '#F59E0B40'}` }} />
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
