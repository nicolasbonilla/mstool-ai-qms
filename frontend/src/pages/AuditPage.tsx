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

  const getScoreColor = (s: number) => s >= 90 ? 'text-green-500' : s >= 70 ? 'text-yellow-500' : 'text-red-500';
  const getScoreRing = (s: number) => s >= 90 ? 'border-green-500' : s >= 70 ? 'border-yellow-500' : 'border-red-500';

  const groups = result?.questions.reduce<Record<string, AuditQuestion[]>>((acc, q) => {
    if (!acc[q.group]) acc[q.group] = [];
    acc[q.group].push(q);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Simulator</h1>
          <p className="text-sm text-gray-500 mt-1">IEC 62304:2006+A1:2015 compliance audit simulation</p>
        </div>
        {result && (
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg hover:bg-navy-light">
            <Download size={16} /> Export PDF
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"><p className="text-red-700 text-sm">{error}</p></div>}

      {!result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {MODES.map((mode) => (
            <button key={mode.id} onClick={() => handleRun(mode.id)}
              className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-teal hover:shadow-md transition-all group">
              <div className="p-3 rounded-xl bg-teal/10 group-hover:bg-teal/20 transition inline-block mb-4">
                <mode.icon size={24} className="text-teal" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{mode.title}</h3>
              <p className="text-sm text-gray-500 mt-2">{mode.desc}</p>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                <span>{mode.checks} checks</span><span>{mode.time}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-teal border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-lg font-medium text-gray-700">Running audit simulation...</p>
          <p className="text-sm text-gray-400 mt-2">Analyzing repository clause by clause</p>
        </div>
      )}

      {result && !loading && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center">
              <div className={`w-32 h-32 rounded-full border-8 ${getScoreRing(result.readiness_score)} flex items-center justify-center`}>
                <span className={`text-4xl font-bold ${getScoreColor(result.readiness_score)}`}>{result.readiness_score}%</span>
              </div>
              <p className="text-sm text-gray-500 mt-3">Readiness Score</p>
              <p className="text-xs text-gray-400 mt-1">Mode: {result.mode}</p>
            </div>
            {[
              { label: 'Strong', count: result.summary.strong, color: 'green', icon: CheckCircle2, desc: 'Full evidence' },
              { label: 'Adequate', count: result.summary.adequate, color: 'yellow', icon: Clock, desc: 'Partial evidence' },
              { label: 'Weak/Missing', count: result.summary.weak + result.summary.missing, color: 'red', icon: XCircle, desc: 'Needs attention' },
            ].map(({ label, count, color, icon: Icon, desc }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className={`text-${color}-500`} /><span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <span className={`text-3xl font-bold text-${color}-600`}>{count}</span>
                <p className="text-xs text-gray-400 mt-1">{desc}</p>
              </div>
            ))}
          </div>

          {groups && Object.entries(groups).map(([group, questions]) => (
            <div key={group} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{group}</h3>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {questions.map((q) => {
                  const style = SCORE_STYLES[q.score] || SCORE_STYLES.missing;
                  const Icon = style.icon;
                  const isOpen = expandedClause === q.clause;
                  return (
                    <div key={q.clause}>
                      <button onClick={() => setExpandedClause(isOpen ? null : q.clause)}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition text-left">
                        <span className="font-mono text-sm text-gray-400 w-12 shrink-0">{q.clause}</span>
                        <span className="flex-1 text-sm text-gray-800">{q.question}</span>
                        <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 shrink-0 ${style.bg} ${style.text}`}>
                          <Icon size={12} /> {q.score.toUpperCase()}
                        </span>
                        <ChevronDown size={16} className={`text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-4 bg-gray-50">
                          <div className="ml-12">
                            <p className="text-xs font-medium text-gray-500 mb-2">Checks:</p>
                            <ul className="text-xs text-gray-600 space-y-1 mb-3">{q.checks.map((c, i) => <li key={i}>- {c}</li>)}</ul>
                            {q.evidence.length > 0 && (<>
                              <p className="text-xs font-medium text-gray-500 mb-2">Evidence:</p>
                              {q.evidence.map((e, i) => (
                                <div key={i} className="text-xs bg-white rounded-lg border border-gray-200 p-3 mb-2">
                                  <span className="text-gray-400 uppercase mr-2">{e.type}</span>
                                  <span className="font-mono text-gray-600">{e.reference}</span>
                                  <p className="text-gray-700 mt-1">{e.content}</p>
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
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Identified Gaps</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                {result.gaps.map((gap, i) => (
                  <div key={i} className={`p-4 rounded-lg border ${gap.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <span className={`text-xs font-bold uppercase ${gap.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'}`}>{gap.severity}</span>
                    <span className="font-mono text-xs text-gray-500 ml-2">Clause {gap.clause}</span>
                    <p className="text-sm text-gray-700 mt-1">{gap.recommendation}</p>
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