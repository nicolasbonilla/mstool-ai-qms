import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, GitCommit, FileText, Download, CheckCircle2,
  AlertTriangle, XCircle, Clock, ChevronRight,
  Play, ArrowRight, Activity, Info,
} from 'lucide-react';
import { getAuditPlan, runAudit, exportAuditPDF, getAuditHistory } from '../api/audit';
import { getComplianceScore } from '../api/compliance';
import ScoringMethodology from '../components/ui/ScoringMethodology';

/* ─── Per-verdict rule explanations (how strong/adequate/weak/missing is decided) ─── */
const VERDICT_RULES: Record<string, string> = {
  strong: 'All required evidence present: document exists, required IDs/sections found, data linked. An auditor would accept without follow-up questions.',
  adequate: 'Most evidence present but with 1 gap. Document exists but is missing a sub-section, or evidence is partial. Auditor will likely ask clarifying questions.',
  weak: 'Minimal evidence. Document exists but incomplete, OR required evidence is present in code but not in the expected document location. Auditor will flag as a finding.',
  missing: 'No evidence found. Required document does not exist, or no traceable references found. Immediate audit failure on this clause.',
};

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
interface HistoryEntry { timestamp: string; action: string; details: { mode?: string; readiness_score?: number } }

const SCORE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  strong: { color: '#10B981', icon: CheckCircle2, label: 'Strong' },
  adequate: { color: '#F59E0B', icon: Clock, label: 'Adequate' },
  weak: { color: '#F97316', icon: AlertTriangle, label: 'Weak' },
  missing: { color: '#EF4444', icon: XCircle, label: 'Missing' },
};

export default function AuditPage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ClausePlan[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [expandedPlanClause, setExpandedPlanClause] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    getAuditPlan().then(r => setPlan(r.data.clauses || [])).catch(() => {});
    getAuditHistory(5).then(r => setHistory(r.data.history || [])).catch(() => {});
    getComplianceScore().then(r => setHealthScore(r.data.scores?.ce_mark_overall ?? null)).catch(() => {});
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

  const planGroups = plan.reduce<Record<string, ClausePlan[]>>((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {});

  // Last audit info
  const lastAudit = history.find(h => h.details?.readiness_score !== undefined);
  const lastScore = lastAudit?.details?.readiness_score;
  const lastDate = lastAudit ? new Date(lastAudit.timestamp) : null;
  const daysSinceAudit = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : null;

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════════
          DUAL-SCORE STATUS BANNER
          Shows Audit Verdict (this page) + Health Score (Dashboard)
          side-by-side with methodology explainer
          ═══════════════════════════════════════════════ */}
      <div className="rounded-2xl p-5"
        style={{
          background: result
            ? result.readiness_score >= 90 ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))' : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))'
            : 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03))',
          border: `1px solid ${result ? (result.readiness_score >= 90 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)') : 'rgba(139,92,246,0.15)'}`,
        }}>
        <div className="flex items-center justify-between gap-6 flex-wrap">
          {/* Left: icon + title */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: result ? (result.readiness_score >= 90 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)') : 'rgba(139,92,246,0.12)' }}>
              {result ? (result.readiness_score >= 90 ? <CheckCircle2 size={24} style={{ color: '#10B981' }} /> : <AlertTriangle size={24} style={{ color: '#F59E0B' }} />) : <ShieldCheck size={24} style={{ color: '#8B5CF6' }} />}
            </div>
            <div>
              {result ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      {result.readiness_score >= 95 ? 'Audit Ready' : result.readiness_score >= 80 ? 'Mostly Ready' : 'Not Ready'}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>target: ≥95%</span>
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: '#10B981' }}>{result.summary.strong} strong</span> · <span style={{ color: '#F59E0B' }}>{result.summary.adequate} adequate</span> · <span style={{ color: '#F97316' }}>{result.summary.weak} weak</span> · <span style={{ color: '#EF4444' }}>{result.summary.missing} missing</span> ·{' '}
                    <button onClick={() => setShowMethodology(true)} className="font-semibold underline" style={{ color: 'var(--accent-teal)' }}>see methodology</button>
                  </p>
                </>
              ) : (
                <>
                  <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>IEC 62304 Audit Simulator</span>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Discrete auditor verdict on {plan.length} clauses: <span style={{ color: '#10B981' }}>strong</span> / <span style={{ color: '#F59E0B' }}>adequate</span> / <span style={{ color: '#F97316' }}>weak</span> / <span style={{ color: '#EF4444' }}>missing</span> · <button onClick={() => setShowMethodology(true)} className="font-semibold underline" style={{ color: 'var(--accent-teal)' }}>see methodology</button>
                  </p>
                  {lastScore !== undefined && daysSinceAudit !== null && (
                    <p className="text-[11px] mt-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span>Last audit: <strong style={{ color: lastScore >= 90 ? '#10B981' : '#F59E0B' }}>{lastScore}%</strong></span>
                      <span>· {daysSinceAudit === 0 ? 'today' : `${daysSinceAudit} day${daysSinceAudit > 1 ? 's' : ''} ago`}</span>
                      {daysSinceAudit > 7 && <span style={{ color: '#F59E0B' }}>— recommend re-running</span>}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: dual scores + actions */}
          <div className="flex items-stretch gap-3">
            {/* Audit Verdict (primary here) */}
            <div className="rounded-xl px-4 py-2.5 min-w-[140px]"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.20)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck size={10} style={{ color: '#8B5CF6' }} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#8B5CF6' }}>Audit Verdict</span>
              </div>
              {result ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>{result.readiness_score}</span>
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Just now</div>
                </>
              ) : lastScore !== undefined ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>{lastScore}</span>
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {daysSinceAudit === 0 ? 'today' : `${daysSinceAudit}d ago`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[16px] font-bold" style={{ color: 'var(--text-muted)' }}>—</div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Run audit →</div>
                </>
              )}
            </div>

            {/* Health Score (cross-reference to Dashboard) */}
            <div className="rounded-xl px-4 py-2.5 min-w-[140px] cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate('/dashboard')}
              style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.20)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Activity size={10} style={{ color: '#0EA5E9' }} />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#0EA5E9' }}>Health Score</span>
              </div>
              {healthScore !== null ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>{healthScore}</span>
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>From Dashboard →</div>
                </>
              ) : (
                <div className="text-[16px] font-bold" style={{ color: 'var(--text-muted)' }}>—</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 justify-center">
              <button onClick={() => setShowMethodology(true)}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <Info size={11} /> Why two scores?
              </button>
              {result && (
                <>
                  <button onClick={handleExportPDF}
                    className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <Download size={11} /> Export PDF
                  </button>
                  <button onClick={() => setResult(null)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <Play size={11} /> New Audit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Divergence explainer (only when result exists and scores differ) */}
        {result && healthScore !== null && Math.abs(result.readiness_score - healthScore) >= 10 && (
          <div className="mt-4 pt-3 flex items-start gap-2 text-[11px]" style={{ borderTop: '1px solid rgba(245,158,11,0.15)' }}>
            <Info size={12} className="shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
            <p style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Scores differ by {Math.abs(Math.round((result.readiness_score - healthScore) * 10) / 10)} points</strong> — this is expected.
              The Audit Verdict applies discrete grades (strong=100 · adequate=75 · weak=40 · missing=0), which penalize gaps more harshly than the continuous Health Score.
              <button onClick={() => setShowMethodology(true)} className="ml-1 font-semibold underline" style={{ color: 'var(--accent-teal)' }}>Learn more</button>
            </p>
          </div>
        )}
      </div>

      {/* Methodology modal */}
      {showMethodology && (
        <ScoringMethodology
          healthScore={healthScore ?? 0}
          auditScore={result ? result.readiness_score : lastScore ?? null}
          onClose={() => setShowMethodology(false)}
        />
      )}

      {error && <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}><p className="text-[13px] text-red-600">{error}</p></div>}

      {/* ═══ BEFORE AUDIT ═══ */}
      {!result && !loading && (
        <div className="space-y-5">
          {/* Primary: Full Audit */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Recommended</p>
            <button onClick={() => handleRun('full')}
              className="w-full rounded-2xl p-6 text-left transition-all duration-200 group active:scale-[0.99]"
              style={{ background: 'var(--card-bg)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 4px 16px rgba(14,165,233,0.06)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)'; }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(139,92,246,0.1))' }}>
                  <ShieldCheck size={24} style={{ color: '#0EA5E9' }} />
                </div>
                <div className="flex-1">
                  <span className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>Full IEC 62304 Audit</span>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Checks all 20 clauses (5.1–9.3) against real repository evidence. Simulates what a Notified Body would verify.
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    {Object.entries(planGroups).map(([group, clauses]) => (
                      <span key={group} className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        {clauses.length} {group}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>~30s</span>
                  <Play size={20} className="group-hover:translate-x-1 transition-transform" style={{ color: '#0EA5E9' }} />
                </div>
              </div>
            </button>
          </div>

          {/* Secondary: Spot checks */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Quick Spot Checks</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'random_commit', title: 'Random Commit Trace', desc: 'Picks a random commit → traces to requirements, code review, CI', icon: GitCommit, checks: 3, time: '~10s' },
                { id: 'random_requirement', title: 'Random Requirement Trace', desc: 'Picks a random REQ-ID → traces to code, tests, risk controls', icon: FileText, checks: 4, time: '~15s' },
              ].map(mode => (
                <button key={mode.id} onClick={() => handleRun(mode.id)}
                  className="rounded-xl p-4 text-left transition-all duration-200 group active:scale-[0.99]"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: 'var(--bg-tertiary)' }}>
                      <mode.icon size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{mode.title}</span>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{mode.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Audit Plan — visible, grouped by section */}
          {plan.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Audit Plan — {plan.length} Clauses That Will Be Checked
              </p>
              <div className="space-y-2">
                {Object.entries(planGroups).map(([group, clauses]) => (
                  <div key={group} className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'var(--bg-tertiary)' }}>
                      <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{group}</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{clauses.length} clauses · {clauses.reduce((s, c) => s + c.checks.length, 0)} checks</span>
                    </div>
                    {clauses.map(c => {
                      const isOpen = expandedPlanClause === c.clause;
                      return (
                        <div key={c.clause} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button onClick={() => setExpandedPlanClause(isOpen ? null : c.clause)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                            <code className="text-[10px] font-mono font-bold shrink-0 w-7" style={{ color: 'var(--accent-teal)' }}>{c.clause}</code>
                            <span className="text-[12px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                            <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{c.checks.length}</span>
                            <ChevronRight size={11} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-3 space-y-2 ml-10">
                              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                                  <p className="text-[8px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>Auditor looks for</p>
                                  <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{c.what_auditor_looks_for}</p>
                                </div>
                                <div className="p-2 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                                  <p className="text-[8px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>Where we check</p>
                                  <code className="text-[10px] font-mono" style={{ color: 'var(--accent-teal)' }}>{c.where_we_check}</code>
                                </div>
                              </div>
                              {c.class_c_note && (
                                <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.08)' }}>
                                  <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#EF4444' }}>Class C: </span>
                                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{c.class_c_note}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {c.checks.map((check, i) => (
                                  <span key={i} className="text-[9px] px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{check}</span>
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
            </div>
          )}

          {/* Audit History */}
          {history.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Recent Audit Runs</p>
              <div className="space-y-1.5">
                {history.filter(h => h.details?.readiness_score !== undefined).slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: (h.details.readiness_score || 0) >= 90 ? '#10B981' : '#F59E0B' }} />
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: (h.details.readiness_score || 0) >= 90 ? '#10B981' : '#F59E0B' }}>{h.details.readiness_score}%</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{h.details.mode || 'full'}</span>
                    <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>{new Date(h.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 border-[3px] border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
          <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Running IEC 62304 audit...</p>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Checking {plan.length} clauses against repository evidence</p>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {result && !loading && groups && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Verdict Distribution</p>
              <button onClick={() => setShowMethodology(true)} className="flex items-center gap-1 text-[10px] font-semibold hover:opacity-80" style={{ color: 'var(--accent-teal)' }}>
                <Info size={10} /> How are these graded?
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Strong', count: result.summary.strong, color: '#10B981', pts: 100, desc: 'Full evidence — audit ready' },
                { label: 'Adequate', count: result.summary.adequate, color: '#F59E0B', pts: 75, desc: 'Partial — may pass with questions' },
                { label: 'Weak', count: result.summary.weak, color: '#F97316', pts: 40, desc: 'Minimal — likely audit finding' },
                { label: 'Missing', count: result.summary.missing, color: '#EF4444', pts: 0, desc: 'No evidence — will fail audit' },
              ].map(({ label, count, color, pts, desc }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold" style={{ color }}>{pts} pts</span>
                  </div>
                  <span className="text-[24px] font-extrabold" style={{ color }}>{count}</span>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  <p className="text-[9px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                    Contributes {count * pts} pts
                  </p>
                </div>
              ))}
            </div>

            {/* Score breakdown calculation */}
            <div className="mt-2 rounded-xl p-3 font-mono text-[10px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Calculation:</span> (
                <span style={{ color: '#10B981' }}>{result.summary.strong}×100</span> +{' '}
                <span style={{ color: '#F59E0B' }}>{result.summary.adequate}×75</span> +{' '}
                <span style={{ color: '#F97316' }}>{result.summary.weak}×40</span> +{' '}
                <span style={{ color: '#EF4444' }}>{result.summary.missing}×0</span>
              ) ÷ ({result.summary.total_checks}×100) × 100 ={' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{result.readiness_score}%</span>
            </div>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Clause-by-Clause Results</p>

          {Object.entries(groups).map(([group, questions]) => {
            const pass = questions.filter(q => q.score === 'strong' || q.score === 'adequate').length;
            return (
              <div key={group} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{group}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pass}/{questions.length} passing</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {questions.map(q => <div key={q.clause} className="w-2.5 h-2.5 rounded-full" title={`${q.clause}: ${q.score}`} style={{ background: (SCORE_CONFIG[q.score] || SCORE_CONFIG.missing).color }} />)}
                  </div>
                </div>

                {questions.map(q => {
                  const cfg = SCORE_CONFIG[q.score] || SCORE_CONFIG.missing;
                  const Icon = cfg.icon;
                  const isOpen = expandedClause === q.clause;
                  return (
                    <div key={q.clause} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => setExpandedClause(isOpen ? null : q.clause)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        <code className="text-[11px] font-mono font-bold shrink-0 w-8" style={{ color: 'var(--text-muted)' }}>{q.clause}</code>
                        <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{q.question || q.title}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                          style={{ background: `${cfg.color}12`, color: cfg.color, boxShadow: `inset 0 0 0 1px ${cfg.color}25` }}>
                          <Icon size={10} /> {cfg.label}
                        </span>
                        <ChevronRight size={13} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2 ml-11">
                          {q.description && <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}><p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{q.description}</p></div>}

                          {/* Verdict explanation — why this clause got this score */}
                          <div className="p-3 rounded-lg" style={{ background: `${cfg.color}08`, border: `1px solid ${cfg.color}20` }}>
                            <div className="flex items-center gap-2 mb-1">
                              <Icon size={11} style={{ color: cfg.color }} />
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                                Why this scored {cfg.label} ({q.score === 'strong' ? '100' : q.score === 'adequate' ? '75' : q.score === 'weak' ? '40' : '0'} pts)
                              </span>
                            </div>
                            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                              {VERDICT_RULES[q.score] || ''}
                            </p>
                          </div>

                          {q.where_we_check && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.1)' }}>
                              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Checked:</span>
                              <code className="text-[10px] font-mono" style={{ color: 'var(--accent-teal)' }}>{q.where_we_check}</code>
                            </div>
                          )}
                          {q.class_c_note && (
                            <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)' }}>
                              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#EF4444' }}>Class C: </span>
                              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{q.class_c_note}</span>
                            </div>
                          )}
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Checks</p>
                            {q.checks.map((c, i) => <div key={i} className="flex items-center gap-2 text-[11px] py-0.5" style={{ color: 'var(--text-secondary)' }}><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} /> {c}</div>)}
                          </div>
                          {q.evidence.length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Evidence</p>
                              {q.evidence.map((e, i) => (
                                <div key={i} className="rounded-lg p-2.5 mb-1.5" style={{ background: 'var(--code-bg)', border: '1px solid var(--code-border)' }}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{e.type}</span>
                                    <code className="text-[10px] font-mono" style={{ color: 'var(--accent-teal)' }}>{e.reference}</code>
                                  </div>
                                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{e.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {(q.score === 'weak' || q.score === 'missing') && q.form_if_fails && (
                            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                              <ArrowRight size={13} style={{ color: '#F59E0B' }} />
                              <div className="flex-1">
                                <p className="text-[10px] font-bold" style={{ color: '#D97706' }}>Action: Create {q.form_if_fails}</p>
                              </div>
                              <button onClick={() => navigate('/forms')} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>Create →</button>
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

          {result.gaps.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Gaps ({result.gaps.length})</p>
              {result.gaps.map((gap, i) => (
                <div key={i} className="rounded-xl p-4 mb-2 flex gap-3" style={{ background: gap.severity === 'critical' ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))' : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))', border: `1px solid ${gap.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}` }}>
                  <ArrowRight size={14} className="shrink-0 mt-0.5" style={{ color: gap.severity === 'critical' ? '#EF4444' : '#F59E0B' }} />
                  <div className="flex-1">
                    <span className="text-[10px] font-bold uppercase" style={{ color: gap.severity === 'critical' ? '#EF4444' : '#F59E0B' }}>{gap.severity}</span>
                    <code className="text-[10px] font-mono ml-2" style={{ color: 'var(--text-muted)' }}>Clause {gap.clause}</code>
                    <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{gap.recommendation}</p>
                  </div>
                  <button onClick={() => navigate('/forms')} className="shrink-0 self-start text-[10px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: `${gap.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}`, color: gap.severity === 'critical' ? '#DC2626' : '#D97706' }}>Create Form →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
