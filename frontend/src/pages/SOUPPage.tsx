import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Search, ChevronDown, Shield, Package } from 'lucide-react';
import { getDependencies, getSOUPSummary, scanVulnerabilities } from '../api/soup';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface Dependency { name: string; version: string; source: string; safety_class: string; license: string | null; pinned: boolean; manufacturer?: string; purpose?: string; anomaly_url?: string }
interface Summary { total_dependencies: number; backend: number; frontend: number; by_safety_class: { A: number; B: number; C: number }; sbom_exists: boolean; review_records: number; review_coverage_pct: number }
interface ScanResult { scanned_at: string; vulnerabilities: { cve_id: string; package: string; severity: string; cvss_score: number; description: string }[]; summary: { critical: number; high: number; medium: number; low: number } }

const SEV_COLORS: Record<string, string> = { CRITICAL: 'bg-red-700 text-white', HIGH: 'bg-red-500 text-white', MEDIUM: 'bg-orange-400 text-white', LOW: 'bg-yellow-400 text-gray-800' };

/* ═══════════════════════════════════════════════════════
   SOUP PAGE — 3-Level Information Architecture

   Level 1: Status — "Are my dependencies safe?"
   Level 2: Safety class groups + CVE summary
   Level 3: Individual dependency detail + CVE drill-down

   IEC 81001-5-1 Clause 5.3.11-12 + IEC 62304 Clause 8
   ═══════════════════════════════════════════════════════ */
export default function SOUPPage() {
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDependencies(), getSOUPSummary()])
      .then(([dRes, sRes]) => { setDeps(dRes.data.dependencies || []); setSummary(sRes.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try { const { data } = await scanVulnerabilities(); setScan(data); }
    catch { /* */ }
    setScanning(false);
  };

  if (loading) return <PageSkeleton rows={4} />;

  const filtered = deps.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterClass && d.safety_class !== filterClass) return false;
    return true;
  });

  const classC = deps.filter(d => d.safety_class === 'C');
  const classB = deps.filter(d => d.safety_class === 'B');
  const classA = deps.filter(d => d.safety_class === 'A');
  const totalVulns = scan ? scan.summary.critical + scan.summary.high + scan.summary.medium + scan.summary.low : 0;

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════
          LEVEL 1 — STATUS BANNER
          "Are my dependencies safe?"
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: totalVulns > 0
            ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))'
            : summary?.sbom_exists
              ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))'
              : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))',
          border: `1px solid ${totalVulns > 0 ? 'rgba(239,68,68,0.15)' : summary?.sbom_exists ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: totalVulns > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }}>
            {totalVulns > 0 ? <AlertTriangle size={24} style={{ color: '#EF4444' }} /> : <Shield size={24} style={{ color: '#10B981' }} />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {summary?.total_dependencies || 0} Dependencies
              </span>
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
                ({summary?.backend || 0} backend · {summary?.frontend || 0} frontend)
              </span>
            </div>
            <p className="text-[13px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <span>SBOM: {summary?.sbom_exists ? '✓' : '✗'}</span>
              <span>·</span>
              <span>Reviews: {summary?.review_records || 0} ({summary?.review_coverage_pct || 0}%)</span>
              <span>·</span>
              <span>Class C: {summary?.by_safety_class?.C || 0} clinical packages</span>
              {totalVulns > 0 && <><span>·</span><span className="text-red-500 font-semibold">{totalVulns} CVEs found</span></>}
            </p>
          </div>
        </div>
        <button onClick={handleScan} disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white rounded-xl disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
          <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} /> {scanning ? 'Scanning...' : 'Scan for CVEs'}
        </button>
      </div>

      {/* CVE Alert */}
      {scan && totalVulns > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.12)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: '#EF4444' }} />
            <span className="text-[14px] font-bold" style={{ color: '#EF4444' }}>Vulnerabilities Detected</span>
          </div>
          <div className="flex gap-3 mb-3">
            {Object.entries(scan.summary).map(([sev, count]) => count > 0 && (
              <span key={sev} className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${SEV_COLORS[sev.toUpperCase()] || ''}`}>
                {count} {sev}
              </span>
            ))}
          </div>
          <div className="space-y-1.5">
            {scan.vulnerabilities.slice(0, 5).map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.04)' }}>
                <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>{v.cve_id}</code>
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{v.package}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEV_COLORS[v.severity] || ''}`}>{v.severity}</span>
                <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{v.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEVEL 2 — SAFETY CLASS GROUPS
          "Which dependencies are safety-critical?"
          Grouped by IEC 62304 safety class (C→B→A)
          ═══════════════════════════════════════ */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Dependencies by Safety Class (IEC 62304 Clause 8)</p>

        {[
          { cls: 'C', label: 'Class C — Clinical Data Processing', desc: 'Directly processes medical data. Errors could affect diagnosis.', color: '#EF4444', items: classC, examples: 'nibabel, numpy, scipy, pydicom' },
          { cls: 'B', label: 'Class B — Core Application', desc: 'Core app logic with indirect safety impact.', color: '#F59E0B', items: classB, examples: 'fastapi, react, firebase' },
          { cls: 'A', label: 'Class A — Development Tools', desc: 'Build/test tools only. No runtime presence.', color: '#10B981', items: classA, examples: 'pytest, vite, typescript' },
        ].map(({ cls, label, desc, color, items, examples }) => {
          const isOpen = expandedClass === cls;
          return (
            <div key={cls} className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{ background: 'var(--card-bg)', border: `1px solid ${isOpen ? `${color}30` : 'var(--card-border)'}`, boxShadow: isOpen ? `0 4px 20px ${color}08` : 'var(--card-shadow)' }}>
              <button onClick={() => setExpandedClass(isOpen ? null : cls)}
                className="w-full flex items-center gap-4 p-4 text-left group">
                <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${color}12`, color }}>{items.length}</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc} <span className="font-mono">e.g. {examples}</span></p>
                </div>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
              </button>

              {/* ═══════════════════════════════
                  LEVEL 3 — DEPENDENCY LIST
                  Individual packages with versions
                  ═══════════════════════════════ */}
              {isOpen && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="pt-3 space-y-1">
                    {items.map((d, i) => (
                      <div key={i} className="p-3 rounded-lg transition-colors"
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        <div className="flex items-center gap-3">
                          <Package size={13} style={{ color: 'var(--text-muted)' }} />
                          <code className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{d.name}</code>
                          <code className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{d.version}</code>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: d.source === 'backend' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)', color: d.source === 'backend' ? '#3B82F6' : '#8B5CF6' }}>
                            {d.source}
                          </span>
                          {d.pinned ? (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">pinned</span>
                          ) : (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">unpinned</span>
                          )}
                        </div>
                        {/* IEC 62304 §5.3.3 enrichment — manufacturer + purpose */}
                        {(d.purpose || d.manufacturer) && (
                          <div className="ml-7 mt-1 flex items-center gap-3">
                            {d.manufacturer && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{d.manufacturer}</span>}
                            {d.purpose && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>— {d.purpose}</span>}
                          </div>
                        )}
                        {d.anomaly_url && (
                          <div className="ml-7 mt-0.5">
                            <a href={d.anomaly_url} target="_blank" rel="noopener" className="text-[9px] font-semibold inline-flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--accent-teal)' }}>
                              Known anomalies →
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full search table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5" style={{ color: 'var(--text-muted)' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all packages..." className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl transition-all"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          </div>
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} of {deps.length}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.slice(0, 30).map((d, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <code className="text-[12px] font-mono font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{d.name}</code>
              <code className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{d.version}</code>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: `${d.safety_class === 'C' ? '#EF4444' : d.safety_class === 'B' ? '#F59E0B' : '#10B981'}12`, color: d.safety_class === 'C' ? '#EF4444' : d.safety_class === 'B' ? '#F59E0B' : '#10B981' }}>
                Class {d.safety_class}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
