import { useEffect, useState } from 'react';
import {
  Brain, AlertTriangle, CheckCircle2, Clock, TrendingDown,
  GitCommit, Target, Info, Download, FileText, Link2, Scan, Eye,
} from 'lucide-react';
import {
  getClausePredictions, getChangeImpact, getGapExplanation,
  getValidationDossier, validateAgent,
  getSuspectLinks, getMissingLinks, getSamdScan,
} from '../api/predict';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface ClausePrediction {
  clause: string;
  title: string;
  score: number;
  threshold_pass: number;
  margin: number;
  p_fail: number;
  verdict: 'pass_likely' | 'at_risk' | 'fail_likely';
  inputs: Record<string, number | null>;
}

interface ImpactFinding {
  commit_sha: string;
  commit_message: string;
  author: string;
  date: string;
  class_c_touched: string[];
  suggested_reqs: string[];
  orphan_reqs_touched: string[];
  impact_severity: 'low' | 'medium' | 'high';
}

interface GapItem {
  key: string;
  description: string;
  standard: string;
  cost_pts: number;
  current_value: number;
  fix_action: string;
  form_id: string;
}

const VERDICT_META: Record<string, { color: string; label: string; icon: any }> = {
  pass_likely:  { color: '#10B981', label: 'Pass likely',  icon: CheckCircle2 },
  at_risk:      { color: '#F59E0B', label: 'At risk',      icon: AlertTriangle },
  fail_likely:  { color: '#EF4444', label: 'Fail likely',  icon: TrendingDown },
};

const SEVERITY_META: Record<string, { color: string; bg: string }> = {
  low:    { color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  high:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

/* ═══════════════════════════════════════════════════════
   INSIGHTS PAGE — Phase 5 + 6

   The predictive + self-validating AI view. Three sections:
   - Top 3 gaps (SHAP-inspired waterfall)
   - Clause-level failure predictions
   - Recent commit impact
   - AI Validation Dossier download (IQ/OQ/PQ + PCCP)

   References:
   - ProReFiCIA (arXiv 2511.00262) — LLM change-impact analysis
   - SHAP (Lundberg & Lee, 2017) — waterfall UX
   - FDA PCCP Final Guidance (Aug 2025)
   ═══════════════════════════════════════════════════════ */
export default function InsightsPage() {
  const [clauses, setClauses] = useState<ClausePrediction[]>([]);
  const [impact, setImpact] = useState<ImpactFinding[]>([]);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [suspect, setSuspect] = useState<any | null>(null);
  const [missing, setMissing] = useState<any | null>(null);
  const [samd, setSamd] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

  useEffect(() => {
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    setLoading(true);
    Promise.all([
      safe(getClausePredictions()),
      safe(getChangeImpact(10)),
      safe(getGapExplanation()),
      safe(getSuspectLinks()),
      safe(getMissingLinks(15, 0.2)),
      safe(getSamdScan()),
    ]).then(([c, i, g, s, m, sc]) => {
      if (c) setClauses(c.data.predictions || []);
      if (i) setImpact(i.data.findings || []);
      if (g) {
        setGaps(g.data.items || []);
        setTotalCost(g.data.total_cost_pts || 0);
        setScore(g.data.score || 0);
      }
      if (s) setSuspect(s.data);
      if (m) setMissing(m.data);
      if (sc) setSamd(sc.data);
    }).finally(() => setLoading(false));
  }, []);

  const onDownloadDossier = async () => {
    setGenerating(true);
    try {
      const r = await getValidationDossier();
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-validation-dossier-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to generate dossier');
    } finally {
      setGenerating(false);
    }
  };

  const onValidateAll = async () => {
    const names = ['traceability', 'soup_monitor', 'pr_reviewer', 'doc_drift', 'capa_drafter'];
    for (const n of names) {
      setValidating(n);
      try {
        await validateAgent(n);
      } catch (e) {
        console.error(`Validation failed for ${n}`, e);
      }
    }
    setValidating(null);
    alert('Golden suite run complete. Re-download dossier to see updated OQ results.');
  };

  if (loading) return <PageSkeleton rows={4} />;

  const atRisk = clauses.filter(c => c.verdict !== 'pass_likely');

  return (
    <div className="space-y-6">

      {/* ═══ Banner ═══ */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(236,72,153,0.02))', border: '1px solid rgba(236,72,153,0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(236,72,153,0.12)' }}>
            <Brain size={24} style={{ color: '#EC4899' }} />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Predictive Insights</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                Phase 5 + Phase 6
              </span>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Clause-level pass/fail prediction, commit impact, SHAP-style gap attribution, and the AI Validation Dossier.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onValidateAll} disabled={validating !== null}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <CheckCircle2 size={11} /> {validating ? `Validating ${validating}…` : 'Run golden suite (all)'}
          </button>
          <button onClick={onDownloadDossier} disabled={generating}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}>
            <Download size={11} /> {generating ? 'Generating…' : 'AI Validation Dossier'}
          </button>
        </div>
      </div>

      {/* ═══ SECTION 1 — Top gap attribution ═══ */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
              What's costing your compliance score?
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              SHAP-inspired rule-based attribution. Current score: <strong>{score.toFixed(1)}%</strong> · total penalty: <strong>-{totalCost.toFixed(1)} pts</strong>
            </p>
          </div>
          <Info size={12} style={{ color: 'var(--text-muted)' }} />
        </div>
        {gaps.length === 0 && (
          <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>
            No penalties detected — every metric at target.
          </p>
        )}
        <div className="space-y-2">
          {gaps.slice(0, 8).map((g, i) => {
            const pct = totalCost > 0 ? (g.cost_pts / gaps[0].cost_pts) * 100 : 0;
            return (
              <div key={g.key} className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{g.description}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--card-bg)', color: 'var(--text-muted)' }}>
                      {g.standard}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: '#EF4444' }}>
                    -{g.cost_pts.toFixed(1)} pts
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--card-bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #EF4444, #F59E0B)' }} />
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <span><strong>Fix:</strong> {g.fix_action}</span>
                  <span className="font-mono">Current: {g.current_value.toFixed(0)}% · Form: {g.form_id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SECTION 2 — Clause predictions ═══ */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Clause-level audit forecast
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              P(fail) per clause based on current breakdown metrics · {atRisk.length} at risk
            </p>
          </div>
          <Target size={12} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {clauses.map(c => {
            const meta = VERDICT_META[c.verdict];
            const Icon = meta.icon;
            return (
              <div key={c.clause} className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${meta.color}20` }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} style={{ color: meta.color }} />
                    <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{c.clause}</code>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.title}</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[18px] font-bold tabular-nums" style={{ color: meta.color }}>
                    {(c.p_fail * 100).toFixed(0)}%
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                    P(fail)
                  </span>
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Score: {c.score.toFixed(1)}% (target ≥{c.threshold_pass}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SECTION 3 — Commit impact ═══ */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Recent commit impact
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Which requirements, hazards, and Class C modules each commit likely affects (ProReFiCIA pattern)
            </p>
          </div>
          <GitCommit size={12} style={{ color: 'var(--text-muted)' }} />
        </div>
        {impact.length === 0 && (
          <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>No recent commits.</p>
        )}
        <div className="space-y-1.5">
          {impact.map(i => {
            const sev = SEVERITY_META[i.impact_severity];
            return (
              <div key={i.commit_sha} className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-teal)' }}>
                    {i.commit_sha}
                  </code>
                  <span className="text-[11px] font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{i.commit_message}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: sev.bg, color: sev.color }}>
                    {i.impact_severity}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 text-[9px]">
                  {i.class_c_touched.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                      Class C: {i.class_c_touched.length}
                    </span>
                  )}
                  {i.suggested_reqs.slice(0, 4).map(r => (
                    <code key={r} className="px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--card-bg)', color: 'var(--text-muted)' }}>
                      {r}{i.orphan_reqs_touched.includes(r) && '⚠'}
                    </code>
                  ))}
                  <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>{i.author} · {new Date(i.date).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SECTION 4 — Suspect Links ═══ */}
      {suspect && (suspect.suspect_code_ids?.length > 0 || suspect.suspect_req_ids?.length > 0) && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                Suspect trace links
              </span>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Trace edges whose underlying code/tests changed in the last {suspect.window_days} days — re-verify before next audit.
              </p>
            </div>
            <Eye size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#F59E0B' }}>Suspect REQs</div>
              <div className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{suspect.suspect_req_ids?.length ?? 0}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>Suspect Code</div>
              <div className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{suspect.suspect_code_ids?.length ?? 0}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#F59E0B' }}>Suspect Tests</div>
              <div className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{suspect.suspect_test_ids?.length ?? 0}</div>
            </div>
          </div>
          <div className="space-y-1">
            {(suspect.suspect_req_ids || []).slice(0, 6).map((id: string) => (
              <div key={id} className="flex items-center gap-2 text-[10px] p-1.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
                <code className="font-mono font-bold" style={{ color: '#F59E0B' }}>{id}</code>
                <span style={{ color: 'var(--text-muted)' }}>downstream of suspect code change — needs re-verification</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SECTION 5 — Missing Trace Link Predictor ═══ */}
      {missing && missing.predictions?.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                Predicted missing trace links
              </span>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                REQ↔test pairs with high token similarity but no explicit trace edge. Method: {missing.method}.
              </p>
            </div>
            <Link2 size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-[9px] font-bold uppercase tracking-wider px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>Requirement</th>
                <th className="text-[9px] font-bold uppercase tracking-wider px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>Likely test</th>
                <th className="text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 text-right" style={{ color: 'var(--text-muted)' }}>Similarity</th>
              </tr>
            </thead>
            <tbody>
              {missing.predictions.slice(0, 12).map((p: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-2 py-1.5"><code className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-teal)' }}>{p.req_id}</code></td>
                  <td className="px-2 py-1.5"><code className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{p.test_id}</code></td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: p.similarity > 0.4 ? '#10B981' : '#F59E0B' }}>
                      {(p.similarity * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ SECTION 6 — SaMD-specific scanner ═══ */}
      {samd && samd.findings?.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                SaMD-specific safety scanner
              </span>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                NIfTI/DICOM/voxel/ONNX-aware static rules. {samd.files_scanned} files scanned, {samd.rules_applied} rules applied, {samd.findings_count} findings.
              </p>
            </div>
            <Scan size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="space-y-1.5">
            {samd.findings.slice(0, 12).map((f: any, i: number) => (
              <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${f.severity === 'warning' ? 'rgba(245,158,11,0.20)' : 'rgba(100,116,139,0.15)'}` }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: f.severity === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)', color: f.severity === 'warning' ? '#F59E0B' : '#64748B' }}>
                    {f.severity}
                  </span>
                  <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{f.rule}</code>
                  <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>{f.file}:{f.line}</span>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{f.why}</p>
                <p className="text-[10px] mt-0.5"><span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>Fix: </span><span style={{ color: 'var(--text-secondary)' }}>{f.fix}</span></p>
                <p className="text-[9px] mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>{f.standard}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Methodology footer */}
      <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(236,72,153,0.04)', border: '1px solid rgba(236,72,153,0.12)' }}>
        <Info size={12} className="mt-0.5 shrink-0" style={{ color: '#EC4899' }} />
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Methodology:</strong>{' '}
          Clause predictions use interpretable weighted rules (replaceable with logistic regression once we have
          audit-label training data). Change impact uses keyword matching of commit messages against SRS requirement
          text + Class C path detection (pattern from <em>ProReFiCIA arXiv 2511.00262</em>). Gap attribution is
          SHAP-inspired rule-based decomposition — not strict Shapley values, but auditable and traceable to each
          source metric. The AI Validation Dossier exports IQ/OQ/PQ + PCCP per agent per{' '}
          <strong>FDA PCCP Final Guidance</strong> (Aug 2025).
        </p>
      </div>

      {/* Silence unused icon */}
      <div className="hidden"><Clock size={0} /><FileText size={0} /></div>
    </div>
  );
}
