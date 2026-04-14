import { useEffect, useState } from 'react';
import { getComplianceScore, getAuthCoverage, getDocuments, getTests, getCommits, getCIRuns } from '../api/compliance';
import {
  Activity, Shield, FileCheck, Lock, AlertTriangle,
  GitCommit, CheckCircle2, XCircle, Clock, FileText, TestTube2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ComplianceData {
  scores: { iec62304: number; iso13485: number; cybersecurity: number; ce_mark_overall: number };
  breakdown: Record<string, number>;
  computed_at: string;
}

interface AuthData {
  files: { file: string; endpoints: number; protected: number; status: string }[];
  total_endpoints: number;
  protected: number;
  coverage_pct: number;
}

interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
}

interface CIRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_sha: string;
}

function ScoreCard({ title, score, icon: Icon, color }: {
  title: string; score: number; icon: React.ElementType; color: string;
}) {
  const getColor = (s: number) => s >= 80 ? 'text-green-500' : s >= 60 ? 'text-yellow-500' : 'text-red-500';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <span className={`text-3xl font-bold ${getColor(score)}`}>{score}%</span>
      </div>
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-24 bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${
              value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
        <span className="text-sm font-medium w-12 text-right">{value}%</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [docs, setDocs] = useState<{ total: number }>({ total: 0 });
  const [tests, setTests] = useState<{ total: number }>({ total: 0 });
  const [commits, setCommits] = useState<CommitData[]>([]);
  const [ciRuns, setCIRuns] = useState<CIRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [scoreRes, authRes, docsRes, testsRes, commitsRes, ciRes] = await Promise.all([
          getComplianceScore(),
          getAuthCoverage(),
          getDocuments(),
          getTests(),
          getCommits(10),
          getCIRuns(5),
        ]);
        setData(scoreRes.data);
        setAuth(authRes.data);
        setDocs(docsRes.data);
        setTests(testsRes.data);
        setCommits(commitsRes.data.commits || []);
        setCIRuns(ciRes.data.ci_runs || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load compliance data');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-center gap-2 text-red-700">
        <AlertTriangle size={20} />
        <span className="font-medium">Error loading compliance data</span>
      </div>
      <p className="text-red-600 text-sm mt-2">{error}</p>
    </div>
  );

  if (!data) return null;

  const breakdownLabels: Record<string, string> = {
    auth_coverage: 'Authentication Coverage',
    input_validation: 'Input Validation',
    test_coverage: 'Test Coverage',
    risk_verification: 'Risk Verification',
    doc_completeness: 'Document Completeness',
    doc_freshness: 'Document Freshness',
    soup_vulnerability: 'SOUP Vulnerability',
    codeowners_coverage: 'CODEOWNERS Coverage',
  };

  const chartData = Object.entries(data.breakdown).map(([key, val]) => ({
    name: breakdownLabels[key]?.split(' ')[0] || key,
    value: val,
  }));

  const getBarColor = (val: number) => val >= 80 ? '#10B981' : val >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time analysis of <span className="font-mono text-gray-700">nicolasbonilla/medical-imaging-viewer</span>
          {' '}| Last computed: {new Date(data.computed_at).toLocaleString()}
        </p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <ScoreCard title="IEC 62304" score={data.scores.iec62304} icon={FileCheck} color="bg-blue-500" />
        <ScoreCard title="ISO 13485" score={data.scores.iso13485} icon={Shield} color="bg-purple-500" />
        <ScoreCard title="Cybersecurity" score={data.scores.cybersecurity} icon={Lock} color="bg-teal" />
        <ScoreCard title="CE Mark Overall" score={data.scores.ce_mark_overall} icon={Activity} color="bg-navy" />
      </div>

      {/* Breakdown Chart + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Breakdown</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(val: number) => `${val}%`} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detail List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Score Details</h2>
          {Object.entries(data.breakdown).map(([key, val]) => (
            <BreakdownItem key={key} label={breakdownLabels[key] || key} value={val} />
          ))}
        </div>
      </div>

      {/* Bottom Row: Activity + CI + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Commits */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <GitCommit size={18} /> Recent Commits
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {commits.map((c) => (
              <div key={c.sha} className="flex items-start gap-3 text-sm">
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 shrink-0 mt-0.5">
                  {c.sha}
                </span>
                <div className="min-w-0">
                  <p className="text-gray-800 truncate">{c.message}</p>
                  <p className="text-xs text-gray-400">{c.author} &middot; {new Date(c.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {commits.length === 0 && <p className="text-sm text-gray-400">No commits loaded</p>}
          </div>
        </div>

        {/* CI Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={18} /> CI Pipeline
          </h2>
          <div className="space-y-3">
            {ciRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-3 text-sm">
                {run.conclusion === 'success' ? (
                  <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                ) : run.conclusion === 'failure' ? (
                  <XCircle size={18} className="text-red-500 shrink-0" />
                ) : (
                  <Clock size={18} className="text-yellow-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-gray-800 truncate">{run.name}</p>
                  <p className="text-xs text-gray-400">
                    {run.head_sha} &middot; {new Date(run.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  run.conclusion === 'success' ? 'bg-green-100 text-green-700' :
                  run.conclusion === 'failure' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {run.conclusion || run.status}
                </span>
              </div>
            ))}
            {ciRuns.length === 0 && <p className="text-sm text-gray-400">No CI runs loaded</p>}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          {auth && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Lock size={16} /> Auth Coverage
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-green-500">{auth.coverage_pct}%</span>
                <span className="text-xs text-gray-500">{auth.protected}/{auth.total_endpoints} endpoints</span>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FileText size={16} /> Regulatory Docs
            </h2>
            <span className="text-2xl font-bold text-blue-600">{docs.total}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <TestTube2 size={16} /> Test Files
            </h2>
            <span className="text-2xl font-bold text-purple-600">{tests.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}