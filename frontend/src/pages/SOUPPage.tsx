import { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle, RefreshCw, Search, ChevronDown, Shield, Package,
  Download, ExternalLink, Lock, Sparkles, Bug, Clock, GitBranch, X,
  CheckCircle2, FileText,
} from 'lucide-react';
import {
  getDependencies, getSOUPSummary, scanVulnerabilities,
  getScanHistory, getLatestScan, getLatestSOUPAgentRun,
  getUnpinnedClassC,
  generateReviewDrafts, generateReviewDraftFor, listReviewDrafts,
  getDependencyDetail,
} from '../api/soup';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface Dependency {
  name: string;
  version: string;
  source: string;
  safety_class: string;
  license: string | null;
  pinned: boolean;
  manufacturer?: string;
  purpose?: string;
  homepage?: string;
  anomaly_url?: string;
  registry_fetched?: boolean;
}
interface Summary {
  total_dependencies: number;
  backend: number;
  frontend: number;
  by_safety_class: { A: number; B: number; C: number };
  pinned_versions?: number;
  unpinned_versions?: number;
  sbom_exists: boolean;
  review_records: number;
  review_coverage_pct: number;
  last_checked?: string;
}
interface ScanResult {
  scanned_at: string;
  vulnerabilities: { cve_id: string; package: string; severity: string; cvss_score: number; description: string }[];
  summary: { critical: number; high: number; medium: number; low: number };
  total_dependencies?: number;
  scanned?: number;
  errors?: number;
}
interface ScanHistoryItem {
  id: string;
  scanned_at: string;
  vulnerability_count: number;
  summary: { critical: number; high: number; medium: number; low: number };
  invoked_by: string;
}
interface UnpinnedItem {
  name: string;
  version: string;
  source: string;
  safety_class: string;
}
interface AnomalyItem {
  title: string;
  url: string;
  created_at: string;
  state: string;
  labels: string[];
  comments: number;
}
interface AgentRun {
  id: string;
  agent_name: string;
  started_at: string;
  duration_ms: number;
  status: string;
  result: { summary: string; findings_count: number };
}

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-700 text-white',
  HIGH: 'bg-red-500 text-white',
  MEDIUM: 'bg-orange-400 text-white',
  LOW: 'bg-yellow-400 text-gray-800',
};

const formatRelative = (iso?: string): string => {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/* ═══════════════════════════════════════════════════════
   SOUP PAGE — full IEC 62304 §8 implementation

   Sections:
   L1 — Status banner with CVE summary + SBOM + agent run cross-link
   L2a — UNPINNED CLASS C alert (IEC 62304 §5.1.7 violation)
   L2b — Safety class groups (C → B → A) with CVE badges per package
   L2c — Scan history timeline
   L3 — Per-package detail modal: anomalies, EOL, AI review draft

   Plus: SBOM download, generate AI review drafts in bulk, all-packages
   tab with sort + pagination.
   ═══════════════════════════════════════════════════════ */
export default function SOUPPage() {
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [unpinned, setUnpinned] = useState<UnpinnedItem[]>([]);
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [draftingAll, setDraftingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>('C');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'groups' | 'all' | 'history'>('groups');
  const [allSort, setAllSort] = useState<'name' | 'safety' | 'pinned'>('safety');
  const [allPage, setAllPage] = useState(0);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [pkgDetail, setPkgDetail] = useState<any>(null);
  const [pkgLoading, setPkgLoading] = useState(false);

  // Initial load — graceful per-call failures
  useEffect(() => {
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    Promise.all([
      safe(getDependencies()),
      safe(getSOUPSummary()),
      safe(getLatestScan()),
      safe(getScanHistory(15)),
      safe(getUnpinnedClassC()),
      safe(getLatestSOUPAgentRun()),
      safe(listReviewDrafts(200)),
    ])
      .then(([d, s, sc, sh, up, ag, rd]) => {
        if (d) setDeps(d.data.dependencies || []);
        if (s) setSummary(s.data);
        if (sc && sc.data?.summary) setScan(sc.data);
        if (sh) setScanHistory(sh.data.scans || []);
        if (up) setUnpinned(up.data.items || []);
        if (ag && ag.data?.id) setAgentRun(ag.data);
        if (rd) setReviewDrafts(rd.data.drafts || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const { data } = await scanVulnerabilities();
      setScan(data);
      const sh = await getScanHistory(15).catch(() => null);
      if (sh) setScanHistory(sh.data.scans || []);
    } catch { /* */ }
    setScanning(false);
  };

  const handleGenerateAllDrafts = async () => {
    setDraftingAll(true);
    try {
      await generateReviewDrafts();
      const rd = await listReviewDrafts(200).catch(() => null);
      if (rd) setReviewDrafts(rd.data.drafts || []);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Bulk draft failed');
    }
    setDraftingAll(false);
  };

  const handleSelectPackage = async (name: string) => {
    setSelectedPkg(name);
    setPkgLoading(true);
    setPkgDetail(null);
    try {
      const { data } = await getDependencyDetail(name);
      setPkgDetail(data);
    } catch (e: any) {
      setPkgDetail({ error: e.response?.data?.detail || 'Failed to load detail' });
    }
    setPkgLoading(false);
  };

  const handleDraftSingle = async (name: string) => {
    try {
      await generateReviewDraftFor(name);
      const rd = await listReviewDrafts(200).catch(() => null);
      if (rd) setReviewDrafts(rd.data.drafts || []);
      alert(`Draft generated for ${name}`);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Draft failed');
    }
  };

  // CVE map by package — used to badge per-dep cards
  const cvesByPackage = useMemo(() => {
    const m: Record<string, ScanResult['vulnerabilities']> = {};
    (scan?.vulnerabilities || []).forEach(v => {
      if (!m[v.package]) m[v.package] = [];
      m[v.package].push(v);
    });
    return m;
  }, [scan]);

  // Drafts existence by package
  const draftedNames = useMemo(
    () => new Set(reviewDrafts.map((d: any) => d.dep_name)),
    [reviewDrafts]
  );

  if (loading) return <PageSkeleton rows={4} />;

  const filtered = deps.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  );

  const classC = deps.filter(d => d.safety_class === 'C');
  const classB = deps.filter(d => d.safety_class === 'B');
  const classA = deps.filter(d => d.safety_class === 'A');
  const totalVulns = scan
    ? scan.summary.critical + scan.summary.high + scan.summary.medium + scan.summary.low
    : 0;

  // Sort the all-packages tab
  const sortedAll = [...filtered].sort((a, b) => {
    if (allSort === 'name') return a.name.localeCompare(b.name);
    if (allSort === 'safety') {
      const order = { C: 0, B: 1, A: 2 } as Record<string, number>;
      return (order[a.safety_class] ?? 9) - (order[b.safety_class] ?? 9);
    }
    if (allSort === 'pinned') {
      return (a.pinned ? 1 : 0) - (b.pinned ? 1 : 0); // unpinned first
    }
    return 0;
  });
  const PAGE_SIZE = 25;
  const pagedAll = sortedAll.slice(allPage * PAGE_SIZE, (allPage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sortedAll.length / PAGE_SIZE);

  const reviewPctIsBad = (summary?.review_coverage_pct ?? 0) < 80;
  const sbomDownloadUrl = `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/soup/sbom`;

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════
          LEVEL 1 — STATUS BANNER (extended)
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
        style={{
          background: totalVulns > 0
            ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))'
            : reviewPctIsBad
              ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))'
              : summary?.sbom_exists
                ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))'
                : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))',
          border: `1px solid ${totalVulns > 0 ? 'rgba(239,68,68,0.15)' : reviewPctIsBad ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: totalVulns > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }}>
            {totalVulns > 0
              ? <AlertTriangle size={24} style={{ color: '#EF4444' }} />
              : <Shield size={24} style={{ color: '#10B981' }} />}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {summary?.total_dependencies || 0} Dependencies
              </span>
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
                ({summary?.backend || 0} backend · {summary?.frontend || 0} frontend)
              </span>
            </div>
            <p className="text-[13px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-flex items-center gap-1">
                {summary?.sbom_exists
                  ? <CheckCircle2 size={11} style={{ color: '#10B981' }} />
                  : <X size={11} style={{ color: '#EF4444' }} />}
                SBOM
              </span>
              <span>·</span>
              <span style={{ color: reviewPctIsBad ? '#EF4444' : 'var(--text-muted)', fontWeight: reviewPctIsBad ? 600 : 400 }}>
                Reviews: {summary?.review_records || 0} ({summary?.review_coverage_pct || 0}%) {reviewPctIsBad && '⚠ <80%'}
              </span>
              <span>·</span>
              <span>Class C: {summary?.by_safety_class?.C || 0}</span>
              {scan && (
                <>
                  <span>·</span>
                  <span>Last scan: {formatRelative(scan.scanned_at)}</span>
                </>
              )}
              {totalVulns > 0 && (
                <>
                  <span>·</span>
                  <span className="text-red-500 font-semibold">{totalVulns} CVEs found</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={sbomDownloadUrl} download
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-xl transition-all hover:opacity-80"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <Download size={12} /> SBOM (CycloneDX)
          </a>
          <button onClick={handleGenerateAllDrafts} disabled={draftingAll}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-white px-3 py-2 rounded-xl disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}>
            <Sparkles size={12} /> {draftingAll ? 'Drafting…' : 'AI Review Drafts'}
          </button>
          <button onClick={handleScan} disabled={scanning}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white rounded-xl disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
            <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Scan for CVEs'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          ALERT — Unpinned Class C (IEC 62304 §5.1.7)
          ═══════════════════════════════════════ */}
      {unpinned.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.20)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Lock size={14} style={{ color: '#EF4444' }} />
            <span className="text-[12px] font-bold" style={{ color: '#EF4444' }}>
              Unpinned Class C dependencies — IEC 62304 §5.1.7 violation ({unpinned.length})
            </span>
          </div>
          <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
            Every SOUP item must be uniquely identified. These Class C deps don't pin to an exact version — auditor will flag.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unpinned.slice(0, 12).map(u => (
              <button key={u.name} onClick={() => handleSelectPackage(u.name)}
                className="text-[10px] font-mono font-bold px-2 py-1 rounded-md hover:opacity-80"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444' }}>
                {u.name}@{u.version}
              </button>
            ))}
            {unpinned.length > 12 && (
              <span className="text-[10px] px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                +{unpinned.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* CVE Alert (with cross-link to drill) */}
      {scan && totalVulns > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.12)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: '#EF4444' }} />
            <span className="text-[14px] font-bold" style={{ color: '#EF4444' }}>Vulnerabilities Detected</span>
            <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>
              Scan {formatRelative(scan.scanned_at)} · {scan.scanned}/{scan.total_dependencies} pkgs
            </span>
          </div>
          <div className="flex gap-3 mb-3 flex-wrap">
            {Object.entries(scan.summary).map(([sev, count]) => count > 0 && (
              <span key={sev} className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${SEV_COLORS[sev.toUpperCase()] || ''}`}>
                {count} {sev}
              </span>
            ))}
          </div>
          <div className="space-y-1.5">
            {scan.vulnerabilities.slice(0, 6).map((v, i) => (
              <div key={i}
                className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:opacity-80"
                style={{ background: 'rgba(239,68,68,0.04)' }}
                onClick={() => handleSelectPackage(v.package)}>
                <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>{v.cve_id}</code>
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{v.package}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEV_COLORS[v.severity] || ''}`}>{v.severity}</span>
                <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{v.description}</span>
                <ExternalLink size={10} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOUP Monitor agent cross-link */}
      {agentRun && (
        <div className="rounded-2xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)' }}>
          <Sparkles size={13} style={{ color: '#06B6D4' }} />
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <strong>SOUP Monitor agent</strong> last ran {formatRelative(agentRun.started_at)}
            {' '}({agentRun.result?.findings_count ?? 0} findings)
          </span>
          <a href={`/agents`}
            className="ml-auto text-[10px] font-semibold inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: '#06B6D4' }}>
            View runs →
          </a>
        </div>
      )}

      {/* ═══════════════════════════════════════
          TAB BAR
          ═══════════════════════════════════════ */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
        {([
          { k: 'groups', label: 'Safety Class Groups', icon: Shield },
          { k: 'all', label: `All Packages (${deps.length})`, icon: Package },
          { k: 'history', label: `Scan History (${scanHistory.length})`, icon: Clock },
        ] as const).map(t => {
          const Icon = t.icon;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
              style={{
                background: tab === t.k ? 'var(--card-bg)' : 'transparent',
                color: tab === t.k ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: tab === t.k ? 'var(--card-shadow)' : 'none',
              }}>
              <Icon size={11} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════
          TAB: SAFETY CLASS GROUPS (default)
          ═══════════════════════════════════════ */}
      {tab === 'groups' && (
        <div className="space-y-3">
          {[
            { cls: 'C', label: 'Class C — Clinical Data Processing', desc: 'Directly processes medical data. Errors could affect diagnosis.', color: '#EF4444', items: classC, examples: 'nibabel, numpy, scipy, pydicom' },
            { cls: 'B', label: 'Class B — Core Application', desc: 'Core app logic with indirect safety impact.', color: '#F59E0B', items: classB, examples: 'fastapi, react, firebase' },
            { cls: 'A', label: 'Class A — Development Tools', desc: 'Build/test tools only. No runtime presence.', color: '#10B981', items: classA, examples: 'pytest, vite, typescript' },
          ].map(({ cls, label, desc, color, items, examples }) => {
            const isOpen = expandedClass === cls;
            const cveCountInClass = items.reduce((acc, it) => acc + (cvesByPackage[it.name]?.length || 0), 0);
            const draftedInClass = items.filter(it => draftedNames.has(it.name)).length;
            return (
              <div key={cls} className="rounded-2xl overflow-hidden transition-all"
                style={{ background: 'var(--card-bg)', border: `1px solid ${isOpen ? `${color}30` : 'var(--card-border)'}`, boxShadow: isOpen ? `0 4px 20px ${color}08` : 'var(--card-shadow)' }}>
                <button onClick={() => setExpandedClass(isOpen ? null : cls)}
                  className="w-full flex items-center gap-4 p-4 text-left">
                  <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${color}12`, color }}>{items.length}</span>
                      {cveCountInClass > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                          <Bug size={9} /> {cveCountInClass} CVEs
                        </span>
                      )}
                      {cls === 'C' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                          style={{ background: 'rgba(236,72,153,0.12)', color: '#EC4899' }}>
                          <Sparkles size={9} /> {draftedInClass}/{items.length} drafted
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc} <span className="font-mono">e.g. {examples}</span></p>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="pt-3 space-y-1">
                      {items.map((d, i) => {
                        const pkgCves = cvesByPackage[d.name] || [];
                        const drafted = draftedNames.has(d.name);
                        return (
                          <div key={i} className="p-3 rounded-lg cursor-pointer transition-colors"
                            onClick={() => handleSelectPackage(d.name)}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                            <div className="flex items-center gap-3 flex-wrap">
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
                              {pkgCves.length > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                                  style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                                  <Bug size={9} /> {pkgCves.length} CVE{pkgCves.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {drafted && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                                  style={{ background: 'rgba(236,72,153,0.12)', color: '#EC4899' }}>
                                  <Sparkles size={9} /> draft
                                </span>
                              )}
                              {d.license && (
                                <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                  {d.license}
                                </span>
                              )}
                            </div>
                            {(d.purpose || d.manufacturer) && (
                              <div className="ml-7 mt-1">
                                {d.manufacturer && <span className="text-[9px] mr-2" style={{ color: 'var(--text-muted)' }}>{d.manufacturer}</span>}
                                {d.purpose && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>— {d.purpose}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════
          TAB: ALL PACKAGES — sort + paginate
          ═══════════════════════════════════════ */}
      {tab === 'all' && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-2.5" style={{ color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setAllPage(0); }}
                placeholder="Search all packages…"
                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              {(['safety', 'name', 'pinned'] as const).map(s => (
                <button key={s} onClick={() => setAllSort(s)}
                  className="px-2 py-1 text-[10px] font-semibold rounded transition-all"
                  style={{
                    background: allSort === s ? 'var(--card-bg)' : 'transparent',
                    color: allSort === s ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>
                  Sort: {s}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {sortedAll.length} packages · page {allPage + 1}/{totalPages || 1}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {pagedAll.map((d, i) => {
              const pkgCves = cvesByPackage[d.name] || [];
              return (
                <div key={i}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  onClick={() => handleSelectPackage(d.name)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <code className="text-[12px] font-mono font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{d.name}</code>
                  <code className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{d.version}</code>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                    style={{ background: `${d.safety_class === 'C' ? '#EF4444' : d.safety_class === 'B' ? '#F59E0B' : '#10B981'}12`, color: d.safety_class === 'C' ? '#EF4444' : d.safety_class === 'B' ? '#F59E0B' : '#10B981' }}>
                    Class {d.safety_class}
                  </span>
                  {!d.pinned && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">unpinned</span>
                  )}
                  {pkgCves.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                      <Bug size={9} /> {pkgCves.length}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="p-3 flex items-center justify-center gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setAllPage(Math.max(0, allPage - 1))} disabled={allPage === 0}
                className="px-3 py-1 text-[11px] font-semibold rounded-lg disabled:opacity-30"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                ← prev
              </button>
              <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                {allPage + 1} of {totalPages}
              </span>
              <button onClick={() => setAllPage(Math.min(totalPages - 1, allPage + 1))} disabled={allPage >= totalPages - 1}
                className="px-3 py-1 text-[11px] font-semibold rounded-lg disabled:opacity-30"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          TAB: SCAN HISTORY
          ═══════════════════════════════════════ */}
      {tab === 'history' && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
              CVE Scan History — {scanHistory.length} runs persisted
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Each scan is recorded in qms_soup_scans (Firestore). Review the timeline for trend regression.
            </p>
          </div>
          {scanHistory.length === 0 ? (
            <p className="p-6 text-[12px] text-center" style={{ color: 'var(--text-muted)' }}>
              No scans yet. Click "Scan for CVEs" above to start.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {scanHistory.map(s => {
                const total = (s.summary?.critical || 0) + (s.summary?.high || 0)
                  + (s.summary?.medium || 0) + (s.summary?.low || 0);
                return (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                    <code className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(s.scanned_at).toLocaleString()}
                    </code>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {s.invoked_by}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {s.summary?.critical > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-700 text-white">{s.summary.critical} CRIT</span>
                      )}
                      {s.summary?.high > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">{s.summary.high} HIGH</span>
                      )}
                      {s.summary?.medium > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-400 text-white">{s.summary.medium} MED</span>
                      )}
                      {s.summary?.low > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-400 text-gray-800">{s.summary.low} LOW</span>
                      )}
                      {total === 0 && (
                        <span className="text-[10px] font-bold text-emerald-600">clean</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: PACKAGE DETAIL (anomalies + EOL + CVEs + AI draft)
          ═══════════════════════════════════════ */}
      {selectedPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedPkg(null)}>
          <div className="rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>{selectedPkg}</h2>
              <button onClick={() => setSelectedPkg(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                <X size={14} />
              </button>
            </div>
            {pkgLoading && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {pkgDetail?.error && <p className="text-[12px]" style={{ color: '#EF4444' }}>{pkgDetail.error}</p>}
            {pkgDetail && !pkgDetail.error && (
              <div className="space-y-3">
                {/* Metadata grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Version</div>
                    <code className="font-mono">{pkgDetail.version}</code>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Class</div>
                    <span className="font-bold">Class {pkgDetail.safety_class}</span>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>License</div>
                    <span>{pkgDetail.license || '—'}</span>
                  </div>
                  <div className="rounded-lg p-2 col-span-2 md:col-span-3" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Manufacturer</div>
                    <span>{pkgDetail.manufacturer || '—'}</span>
                  </div>
                </div>

                {/* Recommendation */}
                {pkgDetail.recommendation && (
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#0EA5E9' }}>Recommendation</div>
                    <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{pkgDetail.recommendation}</p>
                  </div>
                )}

                {/* CVEs */}
                {(pkgDetail.vulnerabilities || []).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                      Vulnerabilities ({pkgDetail.vulnerabilities.length})
                    </div>
                    <div className="space-y-1">
                      {pkgDetail.vulnerabilities.slice(0, 8).map((v: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.05)' }}>
                          <code className="font-mono font-bold">{v.cve_id}</code>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEV_COLORS[v.severity] || ''}`}>{v.severity}</span>
                          <span style={{ color: 'var(--text-muted)' }} className="truncate">{v.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anomalies */}
                {pkgDetail.anomalies?.items?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <GitBranch size={11} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Recent open bugs ({pkgDetail.anomalies.items.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {pkgDetail.anomalies.items.slice(0, 8).map((a: AnomalyItem, i: number) => (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-lg text-[11px] hover:opacity-80"
                          style={{ background: 'var(--bg-tertiary)' }}>
                          <Bug size={10} style={{ color: '#F59E0B' }} />
                          <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{a.title}</span>
                          <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{a.comments} 💬</span>
                          <ExternalLink size={9} style={{ color: 'var(--text-muted)' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {pkgDetail.anomalies?.reason && (
                  <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
                    Anomalies note: {pkgDetail.anomalies.reason}
                  </p>
                )}

                {/* EOL */}
                {pkgDetail.eol && (
                  <div className="p-3 rounded-lg" style={{ background: pkgDetail.eol.eol_date && new Date(pkgDetail.eol.eol_date) < new Date() ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${pkgDetail.eol.eol_date && new Date(pkgDetail.eol.eol_date) < new Date() ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}` }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: pkgDetail.eol.eol_date && new Date(pkgDetail.eol.eol_date) < new Date() ? '#EF4444' : '#F59E0B' }}>
                      End-of-life information (cycle {pkgDetail.eol.cycle})
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      EOL: <strong>{pkgDetail.eol.eol_date || '—'}</strong> · Latest: {pkgDetail.eol.latest || '—'} · LTS: {pkgDetail.eol.lts ? 'yes' : 'no'}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button onClick={() => handleDraftSingle(selectedPkg)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg"
                    style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}>
                    <Sparkles size={11} /> AI-draft review record
                  </button>
                  {pkgDetail.anomaly_url && (
                    <a href={pkgDetail.anomaly_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <FileText size={11} /> Issue tracker
                    </a>
                  )}
                  {pkgDetail.homepage && (
                    <a href={pkgDetail.homepage} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <ExternalLink size={11} /> Homepage
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
