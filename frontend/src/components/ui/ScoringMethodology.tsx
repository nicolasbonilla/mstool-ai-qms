import { X, Activity, ShieldCheck, ArrowRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   SCORING METHODOLOGY EXPLAINER

   Two complementary scores, two philosophies:
   - Health Score (Dashboard): continuous telemetry, rewards partial progress
   - Audit Verdict (Audit): discrete auditor judgment, penalizes gaps

   This modal explains WHY both exist, HOW each is calculated, and
   WHEN to trust which one.
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  healthScore: number;
  auditScore: number | null;
  onClose: () => void;
}

export default function ScoringMethodology({ healthScore, auditScore, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Scoring Methodology</h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Why this tool shows two complementary scores — and how each is calculated</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ─── Side-by-side comparison ─── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Health Score */}
            <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(14,165,233,0.02))', border: '1px solid rgba(14,165,233,0.20)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.12)' }}>
                  <Activity size={16} style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#0EA5E9' }}>Dashboard</div>
                  <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Health Score</div>
                </div>
                <span className="ml-auto text-[22px] font-extrabold" style={{ color: '#0EA5E9' }}>{healthScore}%</span>
              </div>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                A continuous telemetry number answering: <strong>"How well is the repo instrumented right now?"</strong>
              </p>
              <div className="space-y-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-start gap-2"><span style={{ color: '#0EA5E9' }}>•</span><span><strong>Granularity:</strong> each metric is a real % (e.g., 88% of endpoints have auth)</span></div>
                <div className="flex items-start gap-2"><span style={{ color: '#0EA5E9' }}>•</span><span><strong>Rewards:</strong> incremental progress — 88% of endpoints protected → 88 points</span></div>
                <div className="flex items-start gap-2"><span style={{ color: '#0EA5E9' }}>•</span><span><strong>Best for:</strong> daily tracking, spotting regressions, measuring improvement</span></div>
                <div className="flex items-start gap-2"><span style={{ color: '#0EA5E9' }}>•</span><span><strong>Updates:</strong> every page load (re-analyzes the repo)</span></div>
              </div>
            </div>

            {/* Audit Verdict */}
            <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))', border: '1px solid rgba(139,92,246,0.20)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
                  <ShieldCheck size={16} style={{ color: '#8B5CF6' }} />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#8B5CF6' }}>Audit</div>
                  <div className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Audit Verdict</div>
                </div>
                <span className="ml-auto text-[22px] font-extrabold" style={{ color: '#8B5CF6' }}>{auditScore !== null ? `${auditScore}%` : '—'}</span>
              </div>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                A discrete simulation answering: <strong>"Would a Notified Body pass this repo today?"</strong>
              </p>
              <div className="space-y-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-start gap-2"><span style={{ color: '#8B5CF6' }}>•</span><span><strong>Granularity:</strong> per clause, one of 4 verdicts — strong / adequate / weak / missing</span></div>
                <div className="flex items-start gap-2"><span style={{ color: '#8B5CF6' }}>•</span><span><strong>Penalizes:</strong> gaps — a clause with minimal evidence is still "weak" (40 pts), not 88%</span></div>
                <div className="flex items-start gap-2"><span style={{ color: '#8B5CF6' }}>•</span><span><strong>Best for:</strong> pre-audit readiness, CE Mark submission prep, Notified Body reviews</span></div>
                <div className="flex items-start gap-2"><span style={{ color: '#8B5CF6' }}>•</span><span><strong>Updates:</strong> only when you click <em>"Run Audit"</em> (on-demand)</span></div>
              </div>
            </div>
          </div>

          {/* ─── Why they differ ─── */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-[13px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Why are the two scores different?</h3>
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
              They measure the same project with different lenses. Consider authentication at <strong>88% coverage</strong>:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#0EA5E9' }}>Dashboard says</p>
                <p className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  <strong>88 points</strong> — proportional. "88% of endpoints are protected."
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#8B5CF6' }}>Audit says</p>
                <p className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  <strong>Adequate (75 points)</strong> — partial evidence. "An auditor will ask about the missing 12%."
                </p>
              </div>
            </div>
            <p className="text-[11px] mt-3 italic" style={{ color: 'var(--text-muted)' }}>
              Both perspectives are useful. Track the Health Score daily to improve; check the Audit Verdict before submission.
            </p>
          </div>

          {/* ─── Dashboard formula ─── */}
          <div>
            <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Activity size={14} style={{ color: '#0EA5E9' }} /> Dashboard — Health Score Formula
            </h3>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--code-bg)', border: '1px solid var(--code-border)' }}>
              <div className="px-4 py-2.5 text-[10px] font-mono" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                backend/app/services/compliance_service.py — compute_full_score()
              </div>
              <div className="p-4 space-y-2 font-mono text-[11px]" style={{ color: 'var(--code-text)' }}>
                <div><span style={{ color: '#8B5CF6' }}>iec62304</span> = test_coverage×0.25 + risk_verification×0.20 + doc_completeness×0.20 + input_validation×0.15 + auth_coverage×0.10 + codeowners×0.10</div>
                <div><span style={{ color: '#8B5CF6' }}>iso13485</span>  = doc_completeness×0.30 + doc_freshness×0.20 + risk_verification×0.20 + test_coverage×0.15 + codeowners×0.15</div>
                <div><span style={{ color: '#8B5CF6' }}>cybersec</span>   = auth_coverage×0.30 + input_validation×0.25 + soup×0.25 + codeowners×0.20</div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 8 }}>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>ce_mark</span> = iec62304×0.35 + iso13485×0.30 + cybersec×0.20 + doc_completeness×0.15
                </div>
              </div>
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
              Each input metric is a continuous percentage computed by static analysis of the GitHub repo. Example: <code style={{ color: 'var(--accent-teal)' }}>auth_coverage</code> = endpoints with <code>Depends(get_current_active_user)</code> ÷ total endpoints.
            </p>
          </div>

          {/* ─── Audit formula ─── */}
          <div>
            <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ShieldCheck size={14} style={{ color: '#8B5CF6' }} /> Audit — Verdict Formula
            </h3>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--code-bg)', border: '1px solid var(--code-border)' }}>
              <div className="px-4 py-2.5 text-[10px] font-mono" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                backend/app/services/audit_engine.py — readiness_score
              </div>
              <div className="p-4 font-mono text-[11px]" style={{ color: 'var(--code-text)' }}>
                <div className="mb-2">
                  <span style={{ color: '#8B5CF6' }}>score_map</span> = {'{'} strong: <span style={{ color: '#10B981' }}>100</span>, adequate: <span style={{ color: '#F59E0B' }}>75</span>, weak: <span style={{ color: '#F97316' }}>40</span>, missing: <span style={{ color: '#EF4444' }}>0</span> {'}'}
                </div>
                <div>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>readiness_score</span> = sum(score_map[clause.score] for clause in 20 clauses) ÷ (20 × 100) × 100
                </div>
              </div>
            </div>

            {/* Verdict examples */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[
                { label: 'Strong',   color: '#10B981', pts: 100, rule: 'Document exists · Required IDs present · Evidence linked' },
                { label: 'Adequate', color: '#F59E0B', pts: 75,  rule: 'Most of the required evidence is present · 1 gap' },
                { label: 'Weak',     color: '#F97316', pts: 40,  rule: 'Minimal evidence · Multiple gaps · Auditor will flag' },
                { label: 'Missing',  color: '#EF4444', pts: 0,   rule: 'Document missing or no evidence at all' },
              ].map(v => (
                <div key={v.label} className="rounded-lg p-3" style={{ background: `${v.color}08`, border: `1px solid ${v.color}25` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: v.color }}>{v.label}</span>
                    <span className="text-[11px] font-mono font-bold" style={{ color: v.color }}>{v.pts} pts</span>
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.rule}</p>
                </div>
              ))}
            </div>

            {/* Worked example */}
            <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Worked example — your last audit:</p>
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: '#10B981' }}>13 × strong</span><span>×100 pts</span><span className="text-right" style={{ color: 'var(--text-primary)' }}>1,300</span>
                <span style={{ color: '#F59E0B' }}>3 × adequate</span><span>×75 pts</span><span className="text-right" style={{ color: 'var(--text-primary)' }}>225</span>
                <span style={{ color: '#F97316' }}>2 × weak</span><span>×40 pts</span><span className="text-right" style={{ color: 'var(--text-primary)' }}>80</span>
                <span style={{ color: '#EF4444' }}>2 × missing</span><span>×0 pts</span><span className="text-right" style={{ color: 'var(--text-primary)' }}>0</span>
                <span className="col-span-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}><strong>Total</strong> · 1,605 ÷ 2,000</span>
                <span className="text-right pt-1" style={{ color: '#10B981', fontWeight: 700, borderTop: '1px solid var(--border-subtle)' }}>= 80.25%</span>
              </div>
            </div>
          </div>

          {/* ─── How to use both ─── */}
          <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.04), rgba(16,185,129,0.01))', border: '1px solid rgba(16,185,129,0.15)' }}>
            <h3 className="text-[13px] font-bold mb-3" style={{ color: '#10B981' }}>How to use both scores together</h3>
            <div className="space-y-2">
              {[
                { step: 1, title: 'Daily work', desc: 'Track Health Score on the Dashboard. A drop means a regression — fix today.' },
                { step: 2, title: 'Weekly', desc: 'Run the Audit to get the Verdict. Look at strong/adequate/weak/missing distribution.' },
                { step: 3, title: 'Fix gaps', desc: 'For every "weak" or "missing" clause, create the suggested form. The form closes the gap.' },
                { step: 4, title: 'Pre-submission', desc: 'Target ≥95% on BOTH scores. Health ≥95% means good instrumentation; Audit ≥95% means evidence is audit-ready.' },
              ].map(s => (
                <div key={s.step} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>{s.step}</div>
                  <div className="flex-1">
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
                    <ArrowRight size={11} className="inline mx-1.5" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
