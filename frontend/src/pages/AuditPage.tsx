import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, GitCommit, FileText, Download, CheckCircle2,
  AlertTriangle, XCircle, Clock, ChevronDown, ChevronRight,
  Play, ArrowRight, Info,
} from 'lucide-react';
import { getAuditPlan, runAudit, exportAuditPDF } from '../api/audit';

/* ─── Types ─── */
interface ClausePlan { clause: string; title: string; group: string; description: string; what_auditor_looks_for: string; where_we_check: string; class_c_note: string; form_if_fails: string; checks: string[] }
interface AuditEvidence { type: string; reference: string; content: string }
interface AuditQuestion extends ClausePlan { question: string; evidence: AuditEvidence[]; score: string }
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
  { id: 'full', title: 'Full IEC 62304 Audit', desc: 'Checks all 20 clauses (5.1–9.3) against real repository evidence. Use before an external audit.', icon: ShieldCheck, checks: 20, time: '~30s' },
  { id: 'random_commit', title: 'Random Commit Trace', desc: 'Picks a random recent commit and traces to requirements, code review, and CI.', icon: GitCommit, checks: 3, time: '~10s' },
  { id: 'random_requirement', title: 'Random Requirement Trace', desc: 'Picks a random REQ-ID and traces all evidence: code, tests, risk controls.', icon: FileText, checks: 4, time: '~15s' },
];

/* ═══════════════════════════════════════════════════════
   AUDIT PAGE — IEC 62304 Audit Simulator

   BEFORE audit: Shows audit plan — all 20 clauses with what will be checked
   DURING audit: Step-by-step progress
   AFTER audit: Detailed results with evidence per clause
   ═══════════════════════════════════════════════════════ */
export default function AuditPage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ClausePlan[]>([]);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [expandedPlanClause, setExpandedPlanClause] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [error, setError] = useState('');

  // Load audit plan on mount
  useEffect(() => {
    getAuditPlan().then(r => setPlan(r.data.clauses || [])).catch(() => {});
  }, []);

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

  // Group plan clauses too
  const planGroups = plan.reduce<Record<string, ClausePlan[]>>((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* ═══ STATUS BANNER ═══ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: result
            ? result.readiness_score >= 90 ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))' : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))'
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
                  <span className="text-[14px] font-bold" style={{ color: result.readiness_score >= 95 ? '#10B981' : '#F59E0B' }}>
                    {result.readiness_score >= 95 ? 'Audit Ready' : result.readiness_score >= 80 ? 'Mostly Ready' : 'Not Ready'}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>target: ≥95%</span>
                </div>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {result.summary.strong} strong · {result.summary.adequate} adequate · {result.summary.weak + result.summary.missing} gaps · Mode: {result.mode}
                </p>
              </>
            ) : (
              <>
                <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>IEC 62304 Audit Simulator</span>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Simulates a Notified Body audit — checks {plan.length} clauses against real repository evidence
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button onClick={handleExportPDF} className="text-[11px] font-semibold px-3 py-2 rounded-xl transition-all" style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <Download size={12} className="inline mr-1" /> PDF
              </button>
              <button onClick={() => setResult(null)} className="text-[11px] font-semibold px-3 py-2 rounded-xl transition-all" style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                <Play size={12} className="inline mr-1" /> New Audit
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}><p className="text-[13px] text-red-600">{error}</p></div>}

      {/* ═══ BEFORE AUDIT: MODE SELECTION + AUDIT PLAN ═══ */}
      {!result && !loading && (
        <div className="space-y-4">
          {/* Mode selection */}
          <div className="space-y-2">
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

          {/* Audit Plan — what will be checked */}
          {plan.length > 0 && (
            <div>
              <button onClick={() => setShowPlan(!showPlan)}
                className="flex items-center gap-2 text-[12px] font-semibold mb-3 transition-colors"
                style={{ color: 'var(--accent-teal)' }}>
                <Info size={14} />
                {showPlan ? 'Hide' : 'View'} Audit Plan — What will be checked ({plan.length} clauses)
                <ChevronDown size={12} className={`transition-transform ${showPlan ? 'rotate-180' : ''}`} />
              </button>

              {showPlan && (
                <div className="space-y-3">
                  {Object.entries(planGroups).map(([group, clauses]) => (
                    <div key={group} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                      <div className="px-4 py-3" style={{ background: 'var(--bg-tertiary)' }}>
                        <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{group}</span>
                        <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>{clauses.length} clauses</span>
                      </div>
                      {clauses.map(c => {
                        const isOpen = expandedPlanClause === c.clause;
                        return (
                          <div key={c.clause} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <button onClick={() => setExpandedPlanClause(isOpen ? null : c.clause)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                              <code className="text-[11px] font-mono font-bold shrink-0 w-8" style={{ color: 'var(--accent-teal)' }}>{c.clause}</code>
                              <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{c.checks.length} checks</span>
                              <ChevronRight size={12} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                            </button>
                            {isOpen && (
                              <div className="px-4 pb-4 space-y-2 ml-11">
                                <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2.5 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Auditor looks for</p>
                                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.what_auditor_looks_for}</p>
                                  </div>
                                  <div className="p-2.5 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Where we check</p>
                                    <code className="text-[10px] font-mono" style={{ color: 'var(--accent-teal)' }}>{c.where_we_check}</code>
                                  </div>
                                </div>
                                {c.class_c_note && (
                                  <div className="p-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#EF4444' }}>Class C requirement</p>
                                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.class_c_note}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Checks to perform</p>
                                  {c.checks.map((check, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px] py-0.5" style={{ color: 'var(--text-secondary)' }}>
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent-teal)' }} />
                                      {check}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ DURING AUDIT: LOADING ═══ */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 border-[3px] border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
          <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Running IEC 62304 audit...</p>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Checking {plan.length} clauses against repository evidence</p>
        </div>
      )}

      {/* ═══ AFTER AUDIT: DETAILED RESULTS ═══ */}
      {result && !loading && groups && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Strong', count: result.summary.strong, color: '#10B981', desc: 'Full evidence — audit ready' },
              { label: 'Adequate', count: result.summary.adequate, color: '#F59E0B', desc: 'Partial evidence — may pass' },
              { label: 'Weak', count: result.summary.weak, color: '#F97316', desc: 'Minimal — likely finding' },
              { label: 'Missing', count: result.summary.missing, color: '#EF4444', desc: 'No evidence — will fail' },
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

          {/* Results by group */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Clause-by-Clause Results</p>

            {Object.entries(groups).map(([group, questions]) => {
              const groupStrong = questions.filter(q => q.score === 'strong').length;
              const groupAdequate = questions.filter(q => q.score === 'adequate').length;

              return (
                <div key={group} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{group}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{groupStrong + groupAdequate}/{questions.length} passing</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {questions.map(q => {
                        const cfg = SCORE_CONFIG[q.score] || SCORE_CONFIG.missing;
                        return <div key={q.clause} className="w-2.5 h-2.5 rounded-full" title={`${q.clause}: ${q.score}`} style={{ background: cfg.color }} />;
                      })}
                    </div>
                  </div>

                  {questions.map((q) => {
                    const cfg = SCORE_CONFIG[q.score] || SCORE_CONFIG.missing;
                    const Icon = cfg.icon;
                    const isOpen = expandedClause === q.clause;

                    return (
                      <div key={q.clause} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button onClick={() => setExpandedClause(isOpen ? null : q.clause)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left group transition-colors"
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                          <code className="text-[11px] font-mono font-bold shrink-0 w-8" style={{ color: 'var(--text-muted)' }}>{q.clause}</code>
                          <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{q.question}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                            style={{ background: `${cfg.color}12`, color: cfg.color, boxShadow: `inset 0 0 0 1px ${cfg.color}25` }}>
                            <Icon size={10} /> {cfg.label}
                          </span>
                          <ChevronRight size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 space-y-2 ml-11">
                            {/* What the auditor checks */}
                            {q.description && (
                              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{q.description}</p>
                              </div>
                            )}

                            {/* Where we checked + what we found */}
                            {q.where_we_check && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.1)' }}>
                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Checked:</span>
                                <code className="text-[10px] font-mono" style={{ color: 'var(--accent-teal)' }}>{q.where_we_check}</code>
                              </div>
                            )}

                            {/* Class C note */}
                            {q.class_c_note && (
                              <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)' }}>
                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#EF4444' }}>Class C: </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{q.class_c_note}</span>
                              </div>
                            )}

                            {/* Checks performed */}
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Checks Performed</p>
                              {q.checks.map((c, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] py-0.5" style={{ color: 'var(--text-secondary)' }}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} /> {c}
                                </div>
                              ))}
                            </div>

                            {/* Evidence found */}
                            {q.evidence.length > 0 && (
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Evidence Found</p>
                                {q.evidence.map((e, i) => (
                                  <div key={i} className="rounded-lg p-2.5 mb-1.5" style={{ background: 'var(--code-bg)', border: '1px solid var(--code-border)' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{e.type}</span>
                                      <code className="text-[10px] font-mono font-medium" style={{ color: 'var(--accent-teal)' }}>{e.reference}</code>
                                    </div>
                                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{e.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Action if failed */}
                            {(q.score === 'weak' || q.score === 'missing') && q.form_if_fails && (
                              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                                <ArrowRight size={13} style={{ color: '#F59E0B' }} />
                                <div className="flex-1">
                                  <p className="text-[10px] font-bold" style={{ color: '#D97706' }}>Action: Create {q.form_if_fails}</p>
                                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>This form will provide the missing evidence for this clause.</p>
                                </div>
                                <button onClick={() => navigate('/forms')} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                                  style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>
                                  Create →
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Gaps */}
          {result.gaps.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Identified Gaps ({result.gaps.length})</p>
              <div className="space-y-2">
                {result.gaps.map((gap, i) => (
                  <div key={i} className="rounded-xl p-4 flex gap-3"
                    style={{
                      background: gap.severity === 'critical' ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))' : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
                      border: `1px solid ${gap.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}`,
                    }}>
                    <ArrowRight size={14} className="shrink-0 mt-0.5" style={{ color: gap.severity === 'critical' ? '#EF4444' : '#F59E0B' }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase" style={{ color: gap.severity === 'critical' ? '#EF4444' : '#F59E0B' }}>{gap.severity}</span>
                        <code className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>Clause {gap.clause}</code>
                      </div>
                      <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{gap.recommendation}</p>
                    </div>
                    <button onClick={() => navigate('/forms')} className="shrink-0 self-start text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: `${gap.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}`, color: gap.severity === 'critical' ? '#DC2626' : '#D97706' }}>
                      Create Form →
                    </button>
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
