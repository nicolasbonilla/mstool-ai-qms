import { useState } from 'react';
import {
  ShieldCheck, GitCommit, FileText, Download, CheckCircle2,
  AlertTriangle, XCircle, Clock, ChevronDown, ChevronRight,
  Play, ArrowRight,
} from 'lucide-react';
import { runAudit, exportAuditPDF } from '../api/audit';

/* ─── Types ─── */
interface AuditEvidence { type: string; reference: string; content: string }
interface AuditQuestion { clause: string; group: string; question: string; checks: string[]; evidence: AuditEvidence[]; score: string }
interface AuditResult {
  id: string; started_at: string; completed_at: string; mode: string;
  questions: AuditQuestion[]; readiness_score: number;
  gaps: { clause: string; title: string; severity: string; recommendation: string }[];
  summary: { total_checks: number; strong: number; adequate: number; weak: number; missing: number };
}

const SCORE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  strong: { color: '#10B981', icon: CheckCircle2, label: 'Strong' },
  adequate: { color: '#F59E0B', icon: Clock, label: 'Adequate' },
  weak: { color: '#F97316', icon: AlertTriangle, label: 'Weak' },
  missing: { color: '#EF4444', icon: XCircle, label: 'Missing' },
};

const MODES = [
  { id: 'full', title: 'Full IEC 62304 Audit', desc: 'Checks all 20 clauses (5.1–9.3) against real repository evidence. Use before an external audit to identify gaps.', icon: ShieldCheck, checks: 20, time: '~30s' },
  { id: 'random_commit', title: 'Random Commit Trace', desc: 'Picks a random recent commit and traces it to requirements, code review, and CI. Weekly spot-check for traceability.', icon: GitCommit, checks: 3, time: '~10s' },
  { id: 'random_requirement', title: 'Random Requirement Trace', desc: 'Picks a random REQ-ID and traces all evidence: code, tests, risk controls. Validates requirement coverage.', icon: FileText, checks: 4, time: '~15s' },
];

/* ═══════════════════════════════════════════════════════
   AUDIT PAGE — 3-Level Information Architecture

   Level 1: Status — "Have I audited recently? What was the result?"
   Level 2: Mode selection OR grouped results by clause
   Level 3: Per-clause evidence with code references

   Based on:
   - Progressive Disclosure (IxDF)
   - GoodData IA Principles (Structure, Hierarchy, Grouping)
   - ISO 9241-12 (Clarity, Comprehensibility)
   ═══════════════════════════════════════════════════════ */
export default function AuditPage() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleRun = async (mode: string) => {
    setLoading(true); setError('');
    try { const { data } = await runAudit(mode); setResult(data); }
    catch (e: any) { setError(e.response?.data?.detail || 'Audit failed'); }
    setLoading(false);
  };

  const handleExportPDF = async () => {
    if (!result) return;
    try {
      const { data } = await exportAuditPDF(result.mode);
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `audit_report_${result.id}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* */ }
  };

  const groups = result?.questions.reduce<Record<string, AuditQuestion[]>>((acc, q) => {
    if (!acc[q.group]) acc[q.group] = [];
    acc[q.group].push(q);
    return acc;
  }, {});

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════
          LEVEL 1 — STATUS BANNER
          "Have I audited? What was the result?"
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: result
            ? result.readiness_score >= 90
              ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))'
              : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))'
            : 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(14,165,233,0.03))',
          border: `1px solid ${result ? (result.readiness_score >= 90 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)') : 'rgba(14,165,233,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: result ? (result.readiness_score >= 90 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)') : 'rgba(14,165,233,0.12)' }}>
            {result ? (result.readiness_score >= 90 ? <CheckCircle2 size={24} style={{ color: '#10B981' }} /> : <AlertTriangle size={24} style={{ color: '#F59E0B' }} />) : <ShieldCheck size={24} style={{ color: '#0EA5E9' }} />}
          </div>
          <div>
            {result ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{result.readiness_score}%</span>
                  <span className="text-[14px] font-bold" style={{ color: result.readiness_score >= 90 ? '#10B981' : '#F59E0B' }}>
                    {result.readiness_score >= 95 ? 'Audit Ready' : result.readiness_score >= 80 ? 'Mostly Ready' : 'Not Ready'}
                  </span>
                </div>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {result.summary.strong} strong · {result.summary.adequate} adequate · {result.summary.weak + result.summary.missing} gaps · Mode: {result.mode}
                </p>
              </>
            ) : (
              <>
                <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>IEC 62304 Audit Simulator</span>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Simulate a Notified Body audit against your repository. Select a mode below.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button onClick={handleExportPDF} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl transition-all"
                style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Download size={13} /> Export PDF
              </button>
              <button onClick={() => setResult(null)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl transition-all"
                style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                <Play size={13} /> New Audit
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <p className="text-[13px] text-red-600">{error}</p>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEVEL 2A — MODE SELECTION (before audit)
          "What type of audit do I want to run?"
          ═══════════════════════════════════════ */}
      {!result && !loading && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Select Audit Mode</p>
          {MODES.map((mode) => (
            <button key={mode.id} onClick={() => handleRun(mode.id)}
              className="w-full rounded-2xl p-5 text-left transition-all duration-200 group active:scale-[0.99]"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(139,92,246,0.08))' }}>
                  <mode.icon size={20} style={{ color: '#0EA5E9' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{mode.title}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {mode.checks} checks · {mode.time}
                    </span>
                  </div>
                  <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{mode.desc}</p>
                </div>
                <ArrowRight size={16} className="shrink-0 group-hover:translate-x-1 transition-transform" style={{ color: 'var(--text-muted)' }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 border-[3px] border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
          <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Running audit simulation...</p>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Analyzing repository clause by clause</p>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEVEL 2B — RESULTS BY CLAUSE GROUP
          "Where are the gaps?"
          ═══════════════════════════════════════ */}
      {result && !loading && groups && (
        <div className="space-y-4">
          {/* Summary counts */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Strong', count: result.summary.strong, color: '#10B981', desc: 'Full evidence found' },
              { label: 'Adequate', count: result.summary.adequate, color: '#F59E0B', desc: 'Partial evidence' },
              { label: 'Weak', count: result.summary.weak, color: '#F97316', desc: 'Minimal evidence' },
              { label: 'Missing', count: result.summary.missing, color: '#EF4444', desc: 'No evidence' },
            ].map(({ label, count, color, desc }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
                <span className="text-[24px] font-extrabold" style={{ color }}>{count}</span>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Clause groups */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Results by Clause Group</p>

            {Object.entries(groups).map(([group, questions]) => {
              const groupPass = questions.filter(q => q.score === 'strong' || q.score === 'adequate').length;
              const isGroupOpen = expandedGroup === group;

              return (
                <div key={group} className="rounded-2xl overflow-hidden transition-all duration-200"
                  style={{ background: 'var(--card-bg)', border: `1px solid ${isGroupOpen ? 'rgba(14,165,233,0.2)' : 'var(--card-border)'}`, boxShadow: isGroupOpen ? '0 4px 20px rgba(14,165,233,0.05)' : 'var(--card-shadow)' }}>

                  <button onClick={() => setExpandedGroup(isGroupOpen ? null : group)}
                    className="w-full flex items-center gap-4 p-4 text-left group">
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ background: groupPass === questions.length ? '#10B981' : '#F59E0B' }} />
                    <div className="flex-1">
                      <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{group}</span>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{groupPass}/{questions.length} clauses with adequate+ evidence</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {questions.map(q => {
                        const cfg = SCORE_CONFIG[q.score] || SCORE_CONFIG.missing;
                        return <div key={q.clause} className="w-2.5 h-2.5 rounded-full" title={`${q.clause}: ${q.score}`} style={{ background: cfg.color }} />;
                      })}
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {/* ═══════════════════════════════
                      LEVEL 3 — CLAUSE DETAIL
                      "What evidence exists for this clause?"
                      ═══════════════════════════════ */}
                  {isGroupOpen && (
                    <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      {questions.map((q) => {
                        const cfg = SCORE_CONFIG[q.score] || SCORE_CONFIG.missing;
                        const Icon = cfg.icon;
                        const isClauseOpen = expandedClause === q.clause;

                        return (
                          <div key={q.clause} className="rounded-xl border overflow-hidden" style={{ borderColor: isClauseOpen ? `${cfg.color}30` : 'var(--border-subtle)' }}>
                            <button onClick={() => setExpandedClause(isClauseOpen ? null : q.clause)}
                              className="w-full flex items-center gap-3 p-3 text-left group">
                              <code className="text-[11px] font-mono font-bold shrink-0 w-10" style={{ color: 'var(--text-muted)' }}>{q.clause}</code>
                              <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{q.question}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                                style={{ background: `${cfg.color}12`, color: cfg.color, boxShadow: `inset 0 0 0 1px ${cfg.color}25` }}>
                                <Icon size={10} /> {cfg.label}
                              </span>
                              <ChevronRight size={13} className={`transition-transform duration-200 ${isClauseOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                            </button>

                            {isClauseOpen && (
                              <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                {/* Checks performed */}
                                <div className="pt-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Checks Performed</p>
                                  {q.checks.map((c, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px] py-0.5" style={{ color: 'var(--text-secondary)' }}>
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                                      {c}
                                    </div>
                                  ))}
                                </div>

                                {/* Evidence */}
                                {q.evidence.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Evidence Found</p>
                                    {q.evidence.map((e, i) => (
                                      <div key={i} className="rounded-lg p-2.5 mb-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{e.type}</span>
                                          <code className="text-[10px] font-mono font-medium" style={{ color: 'var(--accent-teal)' }}>{e.reference}</code>
                                        </div>
                                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{e.content}</p>
                                      </div>
                                    ))}
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

          {/* Gaps with actions */}
          {result.gaps.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Identified Gaps ({result.gaps.length})
              </p>
              <div className="space-y-2">
                {result.gaps.map((gap, i) => (
                  <div key={i} className="rounded-xl p-4 flex gap-3"
                    style={{
                      background: gap.severity === 'critical' ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))' : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
                      border: `1px solid ${gap.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}`,
                    }}>
                    <ArrowRight size={14} className="shrink-0 mt-0.5" style={{ color: gap.severity === 'critical' ? '#EF4444' : '#F59E0B' }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase" style={{ color: gap.severity === 'critical' ? '#EF4444' : '#F59E0B' }}>{gap.severity}</span>
                        <code className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>Clause {gap.clause}</code>
                      </div>
                      <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{gap.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
