import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getDependencies, getSOUPSummary, scanVulnerabilities } from '../api/soup';

interface Dependency { name: string; version: string; source: string; safety_class: string; license: string | null; pinned: boolean; }
interface Summary { total_dependencies: number; backend: number; frontend: number; by_safety_class: { A: number; B: number; C: number }; sbom_exists: boolean; review_records: number; review_coverage_pct: number; }
interface ScanResult { scanned_at: string; vulnerabilities: { cve_id: string; package: string; severity: string; cvss_score: number; description: string }[]; summary: { critical: number; high: number; medium: number; low: number }; }

const CLASS_COLORS: Record<string, string> = { A: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-200/50', B: 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-200/50', C: 'bg-red-500/10 text-red-500 ring-1 ring-red-200/50' };
const SEV_COLORS: Record<string, string> = { CRITICAL: 'bg-red-700 text-white', HIGH: 'bg-red-500 text-white', MEDIUM: 'bg-orange-400 text-white', LOW: 'bg-yellow-400 text-[var(--text-primary)]' };
const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

export default function SOUPPage() {
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDependencies(), getSOUPSummary()])
      .then(([dRes, sRes]) => { setDeps(dRes.data.dependencies || []); setSummary(sRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try { const { data } = await scanVulnerabilities(); setScan(data); }
    catch { /* */ }
    setScanning(false);
  };

  const filtered = deps.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterClass && d.safety_class !== filterClass) return false;
    return true;
  });

  const pieData = summary ? [
    { name: 'Class A', value: summary.by_safety_class.A },
    { name: 'Class B', value: summary.by_safety_class.B },
    { name: 'Class C', value: summary.by_safety_class.C },
  ] : [];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">SOUP Monitor</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Software of Unknown Provenance — IEC 81001-5-1</p>
        </div>
        <button onClick={handleScan} disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white rounded-xl disabled:opacity-50 transition-all duration-200 hover:shadow-lg hover:shadow-teal/20 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
          <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} /> {scanning ? 'Scanning...' : 'Scan for CVEs'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card hover:shadow-card-hover transition-all duration-200 p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">Total Dependencies</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.total_dependencies}</p>
            <p className="text-xs text-[var(--text-muted)]">{summary.backend} backend / {summary.frontend} frontend</p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card hover:shadow-card-hover transition-all duration-200 p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">Class C (Safety)</p>
            <p className="text-2xl font-bold text-red-600">{summary.by_safety_class.C}</p>
            <p className="text-xs text-[var(--text-muted)]">Clinical data processing</p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card hover:shadow-card-hover transition-all duration-200 p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">SBOM Status</p>
            <p className={`text-2xl font-bold ${summary.sbom_exists ? 'text-green-600' : 'text-red-600'}`}>
              {summary.sbom_exists ? 'Present' : 'Missing'}
            </p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card hover:shadow-card-hover transition-all duration-200 p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">Review Records</p>
            <p className="text-2xl font-bold text-blue-600">{summary.review_records}</p>
            <p className="text-xs text-[var(--text-muted)]">{summary.review_coverage_pct}% coverage</p>
          </div>
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-default)] p-5 flex items-center justify-center">
            <ResponsiveContainer width={100} height={80}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={35}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CVE Scan Results */}
      {scan && scan.vulnerabilities.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50/50 border border-red-200/60 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-red-600" />
            <h3 className="font-semibold text-red-800">Vulnerabilities Found</h3>
          </div>
          <div className="flex gap-4 mb-4 text-sm">
            {Object.entries(scan.summary).map(([sev, count]) => (
              <span key={sev} className={`px-3 py-1 rounded-full text-xs ${SEV_COLORS[sev.toUpperCase()] || 'bg-gray-200'}`}>
                {sev}: {count}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-[var(--text-muted)] border-b border-red-200">
                <th className="pb-2">CVE ID</th><th className="pb-2">Package</th><th className="pb-2">Severity</th><th className="pb-2">CVSS</th><th className="pb-2">Description</th>
              </tr></thead>
              <tbody>
                {scan.vulnerabilities.map((v, i) => (
                  <tr key={i} className="border-b border-red-100">
                    <td className="py-2 font-mono text-xs">{v.cve_id}</td>
                    <td className="py-2">{v.package}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${SEV_COLORS[v.severity] || ''}`}>{v.severity}</span></td>
                    <td className="py-2">{v.cvss_score}</td>
                    <td className="py-2 text-xs text-[var(--text-secondary)] max-w-xs truncate">{v.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dependencies Table */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card">
        <div className="p-4 border-b border-[var(--card-border)] flex items-center gap-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search packages..." className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border-default)] rounded-lg focus:outline-none focus:border-teal" />
          </div>
          <div className="flex gap-2">
            {['', 'A', 'B', 'C'].map(c => (
              <button key={c} onClick={() => setFilterClass(c)}
                className={`px-3 py-1.5 text-xs rounded-lg ${filterClass === c ? 'bg-navy text-white' : 'bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200'}`}>
                {c || 'All'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--card-border)]">
              <th className="px-4 py-3">Package</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Safety Class</th><th className="px-4 py-3">Pinned</th>
            </tr></thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.version}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${d.source === 'backend' ? 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-200/50' : 'bg-purple-500/10 text-purple-600 ring-1 ring-purple-200/50'}`}>{d.source}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${CLASS_COLORS[d.safety_class] || ''}`}>Class {d.safety_class}</span></td>
                  <td className="px-4 py-3">{d.pinned ? <span className="text-green-600 text-xs">Pinned</span> : <span className="text-yellow-600 text-xs">Unpinned</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-[var(--text-muted)] border-t border-[var(--card-border)]">
          Showing {filtered.length} of {deps.length} dependencies
        </div>
      </div>
    </div>
  );
}