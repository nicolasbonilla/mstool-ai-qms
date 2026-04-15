import { useState } from 'react';
import { ShieldCheck, GitCommit, FileText, Download, CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown } from 'lucide-react';
import { runAudit, exportAuditPDF } from '../api/audit';

interface AuditEvidence { type: string; reference: string; content: string; }
interface AuditQuestion { clause: string; group: string; question: string; checks: string[]; evidence: AuditEvidence[]; score: string; }
interface AuditResult {
  id: string; started_at: string; completed_at: string; mode: string;
  questions: AuditQuestion[]; readiness_score: number;
  gaps: { clause: string; title: string; severity: string; recommendation: string }[];
  summary: { total_checks: number; strong: number; adequate: number; weak: number; missing: number };
}

const SCORE_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  strong: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  adequate: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  weak: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
  missing: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
};

const MODES = [
  { id: 'full', title: 'Full Audit', desc: 'Check all IEC 62304 clauses (5.1-9.3)', icon: ShieldCheck, checks: 20, time: '~30s' },
  { id: 'random_commit', title: 'Random Commit', desc: 'Trace a random commit to requirements', icon: GitCommit, checks: 3, time: '~10s' },
  { id: 'random_requirement', title: 'Random Requirement', desc: 'Trace a random REQ to evidence', icon: FileText, checks: 4, time: '~15s' },
];

export default function AuditPage() {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
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

  // Score colors used inline in SVG

  const groups = result?.questions.reduce<Record<string, AuditQuestion[]>>((acc, q) => {
    if (!acc[q.group]) acc[q.group] = [];
    acc[q.group].push(q);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Audit Simulator</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">IEC 62304:2006+A1:2015 compliance audit simulation</p>
        </div>
        {result && (
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg hover:bg-navy-light">
            <Download size={16} /> Export PDF
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"><p className="text-red-700 text-sm">{error}</p></div>}

      {!result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {MODES.map((mode) => (
            <button key={mode.id} onClick={() => handleRun(mode.id)}
              className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] p-6 text-left shadow-card hover:shadow-card-hover hover:border-teal/30 transition-all duration-200 group active:scale-[0.98]">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-teal/10"
                style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(139,92,246,0.08))' }}>
                <mode.icon size={22} className="text-teal" />
              </div>
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{mode.title}</h3>
              <p className="text-[13px] text-[var(--text-muted)] mt-2 leading-relaxed">{mode.desc}</p>
              <div className="flex items-center gap-4 mt-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                <span>{mode.checks} checks</span><span>{mode.time}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-teal border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">Running audit simulation...</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">Analyzing repository clause by clause</p>
        </div>
      )}

      {result && !loading && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-8">
            <div className="relative overflow-hidden rounded-2xl p-8 flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #0B1120, #1A2540)' }}>
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-teal/10 rounded-full blur-[60px]" />
              <div className="relative">
                <svg width="120" height="120" style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 14px ${result.readiness_score >= 80 ? '#10B98150' : '#F59E0B50'})` }}>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke={result.readiness_score >= 80 ? '#10B981' : result.readiness_score >= 60 ? '#F59E0B' : '#EF4444'} strokeWidth="10"
                    strokeDasharray={314} strokeDashoffset={314 - (result.readiness_score / 100) * 314}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[26px] font-extrabold text-white">{result.readiness_score}%</span>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-white/80 mt-3">Readiness Score</p>
              <p className="text-[10px] text-white/30 mt-0.5">Mode: {result.mode}</p>
            </div>
            {[
              { label: 'Strong', count: result.summary.strong, bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: CheckCircle2, desc: 'Full evidence' },
              { label: 'Adequate', count: result.summary.adequate, bg: 'bg-amber-500/10', text: 'text-amber-600', icon: Clock, desc: 'Partial evidence' },
              { label: 'Weak/Missing', count: result.summary.weak + result.summary.missing, bg: 'bg-red-500/10', text: 'text-red-500', icon: XCircle, desc: 'Needs attention' },
            ].map(({ label, count, bg, text, icon: Icon, desc }) => (
              <div key={label} className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card hover:shadow-card-hover transition-all duration-200 p-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}><Icon size={16} className={text} /></div>
                  <span className="text-[13px] font-bold text-[var(--text-secondary)]">{label}</span>
                </div>
                <span className={`text-[28px] font-extrabold ${text}`}>{count}</span>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">{desc}</p>
              </div>
            ))}
          </div>

          {groups && Object.entries(groups).map(([group, questions]) => (
            <div key={group} className="mb-6">
              <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">{group}</h3>
              <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card divide-y divide-gray-50">
                {questions.map((q) => {
                  const style = SCORE_STYLES[q.score] || SCORE_STYLES.missing;
                  const Icon = style.icon;
                  const isOpen = expandedClause === q.clause;
                  return (
                    <div key={q.clause}>
                      <button onClick={() => setExpandedClause(isOpen ? null : q.clause)}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-tertiary)] transition text-left">
                        <span className="font-mono text-sm text-[var(--text-muted)] w-12 shrink-0">{q.clause}</span>
                        <span className="flex-1 text-sm text-[var(--text-primary)]">{q.question}</span>
                        <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 shrink-0 ${style.bg} ${style.text}`}>
                          <Icon size={12} /> {q.score.toUpperCase()}
                        </span>
                        <ChevronDown size={16} className={`text-[var(--text-muted)] transition ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-4 bg-gradient-to-b from-gray-50/80 to-white">
                          <div className="ml-12">
                            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Checks:</p>
                            <ul className="text-xs text-[var(--text-secondary)] space-y-1 mb-3">{q.checks.map((c, i) => <li key={i}>- {c}</li>)}</ul>
                            {q.evidence.length > 0 && (<>
                              <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Evidence:</p>
                              {q.evidence.map((e, i) => (
                                <div key={i} className="text-xs bg-[var(--card-bg)] rounded-lg border border-[var(--border-default)] p-3 mb-2">
                                  <span className="text-[var(--text-muted)] uppercase mr-2">{e.type}</span>
                                  <span className="font-mono text-[var(--text-secondary)]">{e.reference}</span>
                                  <p className="text-[var(--text-secondary)] mt-1">{e.content}</p>
                                </div>
                              ))}
                            </>)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {result.gaps.length > 0 && (
            <div className="mb-8">
              <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Identified Gaps</h3>
              <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card p-6 space-y-3">
                {result.gaps.map((gap, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${gap.severity === 'critical' ? 'bg-gradient-to-r from-red-50 to-orange-50/50 border-red-200/60' : 'bg-gradient-to-r from-amber-50 to-yellow-50/50 border-amber-200/60'}`}>
                    <span className={`text-xs font-bold uppercase ${gap.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'}`}>{gap.severity}</span>
                    <span className="font-mono text-xs text-[var(--text-muted)] ml-2">Clause {gap.clause}</span>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{gap.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center"><button onClick={() => setResult(null)} className="text-sm text-teal hover:text-teal-light underline">Run another audit</button></div>
        </div>
      )}
    </div>
  );
}