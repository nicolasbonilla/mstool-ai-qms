import { useEffect, useState } from 'react';
import { getComplianceScore, getAuthCoverage, getDocuments, getTests } from '../api/compliance';
import { Activity, Shield, FileCheck, TestTube, Lock, AlertTriangle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [scoreRes, authRes, docsRes, testsRes] = await Promise.all([
          getComplianceScore(),
          getAuthCoverage(),
          getDocuments(),
          getTests(),
        ]);
        setData(scoreRes.data);
        setAuth(authRes.data);
        setDocs(docsRes.data);
        setTests(testsRes.data);
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
      <p className="text-red-500 text-xs mt-1">
        Make sure MSTOOL_AI_REPO_PATH is configured in backend/.env
      </p>
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time analysis of MSTool-AI | Last computed: {new Date(data.computed_at).toLocaleString()}
        </p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <ScoreCard title="IEC 62304" score={data.scores.iec62304} icon={FileCheck} color="bg-blue-500" />
        <ScoreCard title="ISO 13485" score={data.scores.iso13485} icon={Shield} color="bg-purple-500" />
        <ScoreCard title="Cybersecurity" score={data.scores.cybersecurity} icon={Lock} color="bg-teal" />
        <ScoreCard title="CE Mark Overall" score={data.scores.ce_mark_overall} icon={Activity} color="bg-navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance Breakdown</h2>
          {Object.entries(data.breakdown).map(([key, val]) => (
            <BreakdownItem key={key} label={breakdownLabels[key] || key} value={val} />
          ))}
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
          {/* Auth Coverage */}
          {auth && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Authentication</h2>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-green-500">{auth.coverage_pct}%</span>
                <span className="text-sm text-gray-500">
                  {auth.protected} / {auth.total_endpoints} endpoints protected
                </span>
              </div>
              <div className="mt-3 space-y-1">
                {auth.files.filter(f => f.status === 'unprotected').map(f => (
                  <div key={f.file} className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle size={12} /> {f.file}: {f.endpoints - f.protected} unprotected
                  </div>
                ))}
                {auth.files.every(f => f.status === 'protected') && (
                  <div className="text-xs text-green-600">All endpoints protected</div>
                )}
              </div>
            </div>
          )}

          {/* Document & Test Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <span className="text-3xl font-bold text-blue-600">{docs.total}</span>
              <p className="text-sm text-gray-500 mt-1">Regulatory Documents</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <span className="text-3xl font-bold text-purple-600">{tests.total}</span>
              <p className="text-sm text-gray-500 mt-1">Unit Test Files</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
