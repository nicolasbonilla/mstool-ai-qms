import { useEffect, useState } from 'react';
import { getDetailedScore, getCommits, getCIRuns } from '../api/compliance';
import {
  Activity, Shield, Lock, AlertTriangle, ExternalLink,
  GitCommit, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
  ShieldCheck, Code, FileText, Users, Bug, Sparkles,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Evidence {
  file: string;
  github_url: string;
  detail: string;
  status: string;
  test_url?: string;
}

interface Check {
  id: string;
  title: string;
  standard: string;
  description: string;
  score: number;
  status: string;
  evidence: Evidence[];
  summary: string;
  action: string | null;
  github_url?: string;
}

interface DetailedData {
  computed_at: string;
  scores: { iec62304: number; iso13485: number; cybersecurity: number; ce_mark_overall: number };
  breakdown: Record<string, number>;
  checks: Check[];
  repo: string;
}

interface CommitData { sha: string; message: string; author: string; date: string; }
interface CIRun { id: number; name: string; status: string; conclusion: string | null; created_at: string; head_sha: string; }

const SCORE_ICONS: Record<string, React.ElementType> = {
  auth_coverage: Lock,
  input_validation: ShieldCheck,
  test_coverage: Code,
  risk_verification: AlertTriangle,
  doc_completeness: FileText,
  doc_freshness: Clock,
  soup_vulnerability: Bug,
  codeowners_coverage: Users,
};

function ScoreRing({ score, label, sublabel, size = 'lg' }: { score: number; label: string; sublabel?: string; size?: 'lg' | 'sm' }) {
  const radius = size === 'lg' ? 54 : 36;
  const stroke = size === 'lg' ? 6 : 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 90 ? '#10B981' : score >= 70 ? '#F59E0B' : '#EF4444';
  const center = radius + stroke;
  const svgSize = (radius + stroke) * 2;

  return (
    <div className="flex flex-col items-center">
      <svg width={svgSize} height={svgSize} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#1E293B" strokeWidth={stroke} />
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: svgSize, height: svgSize }}>
        <span className={`font-bold ${size === 'lg' ? 'text-2xl' : 'text-lg'}`} style={{ color }}>{score}%</span>
      </div>
      <p className={`mt-2 font-semibold text-gray-800 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400">{sublabel}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pass: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'PASS' },
    warn: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'WARNING' },
    fail: { bg: 'bg-red-50', text: 'text-red-700', label: 'FAIL' },
    protected: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'OK' },
    unprotected: { bg: 'bg-red-50', text: 'text-red-700', label: 'MISSING' },
  };
  const c = config[status] || config.fail;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.label}</span>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DetailedData | null>(null);
  const [commits, setCommits] = useState<CommitData[]>([]);
  const [ciRuns, setCIRuns] = useState<CIRun[]>([]);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getDetailedScore(), getCommits(10), getCIRuns(5)])
      .then(([scoreRes, commitsRes, ciRes]) => {
        setData(scoreRes.data);
        setCommits(commitsRes.data.commits || []);
        setCIRuns(ciRes.data.ci_runs || []);
      })
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 border-2 border-teal border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Analyzing repository compliance...</p>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 text-red-700"><AlertTriangle size={20} /><span className="font-medium">Error</span></div>
      <p className="text-red-600 text-sm mt-2">{error}</p>
    </div>
  );

  if (!data) return null;

  const chartData = data.checks.map(c => ({
    name: c.title.split(' ').slice(0, 2).join(' '),
    value: c.score,
    fullTitle: c.title,
  }));

  const passCount = data.checks.filter(c => c.status === 'pass').length;
  const warnCount = data.checks.filter(c => c.status === 'warn').length;
  const failCount = data.checks.filter(c => c.status === 'fail').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gradient-to-br from-teal to-blue-500 rounded-xl flex items-center justify-center">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
            <p className="text-xs text-gray-400">
              Last analyzed: {new Date(data.computed_at).toLocaleString()} &middot;{' '}
              <a href={data.repo} target="_blank" rel="noopener" className="text-teal hover:underline inline-flex items-center gap-1">
                nicolasbonilla/medical-imaging-viewer <ExternalLink size={10} />
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Score Rings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="grid grid-cols-4 gap-8">
          {[
            { key: 'ce_mark_overall', label: 'CE Mark Overall', sub: 'EU MDR 2017/745' },
            { key: 'iec62304', label: 'IEC 62304', sub: 'Software Lifecycle' },
            { key: 'iso13485', label: 'ISO 13485', sub: 'Quality Management' },
            { key: 'cybersecurity', label: 'Cybersecurity', sub: 'IEC 81001-5-1' },
          ].map(({ key, label, sub }) => (
            <div key={key} className="relative flex justify-center">
              <ScoreRing score={(data.scores as any)[key]} label={label} sublabel={sub} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-50">
          <span className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 size={14} /> {passCount} passing</span>
          <span className="flex items-center gap-1.5 text-xs text-amber-600"><AlertTriangle size={14} /> {warnCount} warnings</span>
          <span className="flex items-center gap-1.5 text-xs text-red-600"><XCircle size={14} /> {failCount} failing</span>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Score Breakdown</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
            <Tooltip formatter={(val: number, _: any, props: any) => [`${val}%`, props.payload.fullTitle]} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.value >= 90 ? '#10B981' : entry.value >= 70 ? '#F59E0B' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Checks — the main content */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Compliance Checks — Evidence & Audit Trail</h2>
        <p className="text-xs text-gray-400 mb-6">
          Each check analyzes real files in the repository via GitHub API. Click to expand and see the evidence, source code links, and recommended actions.
        </p>

        <div className="space-y-3">
          {data.checks.map((check) => {
            const isExpanded = expandedCheck === check.id;
            const Icon = SCORE_ICONS[check.id] || Shield;
            const barColor = check.score >= 90 ? 'bg-emerald-500' : check.score >= 70 ? 'bg-amber-500' : 'bg-red-500';

            return (
              <div key={check.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedCheck(isExpanded ? null : check.id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-gray-50/50 transition text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    check.status === 'pass' ? 'bg-emerald-50 text-emerald-600' :
                    check.status === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{check.title}</h3>
                      <StatusBadge status={check.status} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{check.standard}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${check.score >= 90 ? 'text-emerald-600' : check.score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {check.score}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full">
                        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(check.score, 100)}%` }} />
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded Evidence */}
                {isExpanded && (
                  <div className="border-t border-gray-50 bg-gray-50/30">
                    {/* Description */}
                    <div className="px-5 pt-4 pb-3">
                      <div className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                        <Sparkles size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-700 leading-relaxed">{check.description}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            <span className="font-medium">Standard:</span> {check.standard}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="px-5 pb-3">
                      <p className="text-sm font-medium text-gray-700">{check.summary}</p>
                    </div>

                    {/* Evidence Table */}
                    <div className="px-5 pb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 border-b border-gray-100">
                            <th className="text-left py-2 font-medium">File</th>
                            <th className="text-left py-2 font-medium">Evidence</th>
                            <th className="text-left py-2 font-medium">Status</th>
                            <th className="text-left py-2 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {check.evidence.map((ev, i) => (
                            <tr key={i} className="border-b border-gray-50 last:border-0">
                              <td className="py-2.5 font-mono text-xs text-gray-600">{ev.file}</td>
                              <td className="py-2.5 text-xs text-gray-600">{ev.detail}</td>
                              <td className="py-2.5"><StatusBadge status={ev.status} /></td>
                              <td className="py-2.5">
                                <a href={ev.github_url} target="_blank" rel="noopener"
                                  className="inline-flex items-center gap-1 text-xs text-teal hover:underline">
                                  View <ExternalLink size={10} />
                                </a>
                                {ev.test_url && (
                                  <a href={ev.test_url} target="_blank" rel="noopener"
                                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline ml-2">
                                    Test <ExternalLink size={10} />
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Action Required */}
                    {check.action && (
                      <div className="px-5 pb-4">
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-800">Action Required</p>
                            <p className="text-xs text-amber-700 mt-0.5">{check.action}</p>
                          </div>
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

      {/* Bottom Row: Commits + CI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Commits */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <GitCommit size={16} /> Recent Commits
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {commits.map((c) => (
              <div key={c.sha} className="flex items-start gap-3 text-sm">
                <span className="font-mono text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 shrink-0 mt-0.5">{c.sha}</span>
                <div className="min-w-0">
                  <p className="text-gray-700 text-xs truncate">{c.message}</p>
                  <p className="text-[10px] text-gray-400">{c.author} &middot; {new Date(c.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CI Pipeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Activity size={16} /> CI Pipeline
          </h2>
          <div className="space-y-3">
            {ciRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-3 text-sm">
                {run.conclusion === 'success' ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> :
                 run.conclusion === 'failure' ? <XCircle size={16} className="text-red-500 shrink-0" /> :
                 <Clock size={16} className="text-amber-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">{run.name}</p>
                  <p className="text-[10px] text-gray-400">{run.head_sha} &middot; {new Date(run.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                  run.conclusion === 'success' ? 'bg-emerald-50 text-emerald-700' :
                  run.conclusion === 'failure' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                }`}>{run.conclusion || run.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}