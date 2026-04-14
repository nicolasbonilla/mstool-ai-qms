import { useEffect, useState } from 'react';
import { getDetailedScore, getCommits, getCIRuns } from '../api/compliance';
import {
  Activity, Shield, Lock, AlertTriangle, ExternalLink,
  GitCommit, CheckCircle2, XCircle, Clock, ChevronRight,
  ShieldCheck, Code, FileText, Users, Bug, Sparkles, ArrowUpRight, CircleDot,
} from 'lucide-react';

/* ─── Types ─── */
interface Evidence { file: string; github_url: string; detail: string; status: string; test_url?: string }
interface Check { id: string; title: string; standard: string; description: string; score: number; status: string; evidence: Evidence[]; summary: string; action: string | null }
interface Data { computed_at: string; scores: Record<string, number>; checks: Check[]; repo: string }
interface Commit { sha: string; message: string; author: string; date: string }
interface CIRun { id: number; name: string; conclusion: string | null; created_at: string; head_sha: string }

const ICONS: Record<string, React.ElementType> = {
  auth_coverage: Lock, input_validation: ShieldCheck, test_coverage: Code,
  risk_verification: AlertTriangle, doc_completeness: FileText, doc_freshness: Clock,
  soup_vulnerability: Bug, codeowners_coverage: Users,
};

/* ─── Animated Counter ─── */
function Counter({ to }: { to: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame: number, start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setVal(Math.round(1 - Math.pow(1 - p, 3)) * to * 10 / 10);
      if (p < 1) frame = requestAnimationFrame(step);
      else setVal(to);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <>{val}%</>;
}

/* ─── SVG Ring ─── */
function Ring({ value, color, size = 130 }: { value: number; color: string; size?: number }) {
  const sw = 10, r = (size - sw) / 2, c = 2 * Math.PI * r, mid = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 14px ${color}50)` }}>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={c - (value / 100) * c}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)' }} />
    </svg>
  );
}

/* ─── Gradient Progress Bar ─── */
function GradientBar({ value, from, to: toColor }: { value: number; from: string; to: string }) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full" style={{
        width: `${Math.min(value, 100)}%`,
        background: `linear-gradient(90deg, ${from}, ${toColor})`,
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: `0 0 8px ${from}40`,
      }} />
    </div>
  );
}

/* ─── Main ─── */
export default function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [ci, setCi] = useState<CIRun[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDetailedScore(), getCommits(6), getCIRuns(5)])
      .then(([s, c, r]) => { setData(s.data); setCommits(c.data.commits || []); setCi(r.data.ci_runs || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] border-teal/20 border-t-teal animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Analyzing repository compliance...</p>
      </div>
    </div>
  );
  if (!data) return null;

  const scores = [
    { key: 'ce_mark_overall', label: 'CE Mark', sub: 'Overall Readiness', color: '#0EA5E9' },
    { key: 'iec62304', label: 'IEC 62304', sub: 'Software Lifecycle', color: '#10B981' },
    { key: 'iso13485', label: 'ISO 13485', sub: 'Quality Management', color: '#8B5CF6' },
    { key: 'cybersecurity', label: 'Cybersecurity', sub: 'IEC 81001-5-1', color: '#F59E0B' },
  ];

  const pass = data.checks.filter(c => c.status === 'pass').length;

  const statusColors: Record<string, { bg: string; text: string; gradient: [string, string] }> = {
    pass: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', gradient: ['#10B981', '#34D399'] },
    warn: { bg: 'bg-amber-500/10', text: 'text-amber-400', gradient: ['#F59E0B', '#FBBF24'] },
    fail: { bg: 'bg-red-500/10', text: 'text-red-400', gradient: ['#EF4444', '#F87171'] },
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Compliance Dashboard</h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
            <a href={data.repo} target="_blank" rel="noopener" className="hover:text-teal transition-colors inline-flex items-center gap-1">
              nicolasbonilla/medical-imaging-viewer <ExternalLink size={10} />
            </a>
            <span className="text-gray-300">·</span>
            {new Date(data.computed_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full ring-1 ring-emerald-200/50">
          <CircleDot size={11} /> {pass}/{data.checks.length} passing
        </div>
      </div>

      {/* ─── Score Hero (dark panel matching sidebar aesthetic) ─── */}
      <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0B1120 0%, #1A2540 50%, #0B1120 100%)' }}>
        {/* Glow effects matching sidebar colors */}
        <div className="absolute -top-24 left-1/4 w-80 h-80 bg-teal/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 w-72 h-72 bg-accent/8 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-[120px]" />

        <div className="relative px-10 py-10">
          <div className="grid grid-cols-4 gap-4">
            {scores.map(({ key, label, sub, color }) => (
              <div key={key} className="flex flex-col items-center py-4 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06] transition-all duration-300">
                <div className="relative">
                  <Ring value={data.scores[key]} color={color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[24px] font-extrabold text-white tracking-tight">
                      <Counter to={data.scores[key]} />
                    </span>
                  </div>
                </div>
                <p className="text-[13px] font-bold text-white/90 mt-3">{label}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-white/[0.04] text-center">
            <code className="text-[10px] text-white/15 font-mono">CE = IEC×0.35 + ISO×0.30 + Cyber×0.20 + Docs×0.15</code>
          </div>
        </div>
      </div>

      {/* ─── Compliance Checks (with depth matching sidebar) ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Compliance Evidence</h2>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Click to inspect</span>
        </div>

        <div className="grid gap-2">
          {data.checks.map((check) => {
            const isOpen = open === check.id;
            const Icon = ICONS[check.id] || Shield;
            const score = Math.round(check.score * 10) / 10;
            const sc = statusColors[check.status] || statusColors.fail;

            return (
              <div key={check.id} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                isOpen ? 'bg-white border-teal/30 shadow-lg shadow-teal/5' : 'bg-white border-gray-100/80 shadow-card hover:shadow-card-hover hover:border-gray-200'
              }`}>
                <button onClick={() => setOpen(isOpen ? null : check.id)}
                  className="w-full flex items-center gap-4 p-4 text-left group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sc.bg} transition-transform duration-200 group-hover:scale-110`}>
                    <Icon size={18} className={sc.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-gray-900">{check.title}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        check.status === 'pass' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50' :
                        check.status === 'warn' ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/50' :
                        'bg-red-50 text-red-600 ring-1 ring-red-200/50'
                      }`}>{check.status}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{check.standard}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[18px] font-extrabold tabular-nums" style={{ color: sc.gradient[0] }}>{score}%</span>
                    <div className="w-28">
                      <GradientBar value={score} from={sc.gradient[0]} to={sc.gradient[1]} />
                    </div>
                    <ChevronRight size={14} className={`text-gray-300 transition-transform duration-300 ${isOpen ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    {/* Educational description */}
                    <div className="flex gap-3 p-4 mt-3 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50/50 border border-sky-100/80">
                      <Sparkles size={14} className="text-sky-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] text-sky-900 leading-relaxed font-medium">{check.description}</p>
                        <p className="text-[10px] text-sky-500 mt-1.5 font-mono font-semibold">{check.standard}</p>
                      </div>
                    </div>

                    {/* Evidence */}
                    <div className="mt-3 rounded-xl border border-gray-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-gray-50 to-gray-50/50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                        <FileText size={12} className="text-gray-400" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Evidence Trail</span>
                      </div>
                      {check.evidence.map((ev, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group/row">
                          <div className="flex-1 min-w-0">
                            <code className="text-[11px] text-gray-600 font-mono font-medium">{ev.file}</code>
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{ev.detail}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                            {ev.status === 'protected' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg ring-1 ring-emerald-200/50">
                                <CheckCircle2 size={11} /> PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-lg ring-1 ring-red-200/50">
                                <XCircle size={11} /> FAIL
                              </span>
                            )}
                            <a href={ev.github_url} target="_blank" rel="noopener"
                              className="inline-flex items-center gap-1 text-[11px] text-teal hover:text-teal-dark font-semibold opacity-60 group-hover/row:opacity-100 transition-opacity">
                              GitHub <ArrowUpRight size={10} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>

                    {check.action && (
                      <div className="flex gap-3 p-4 mt-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-800">Recommended Action</p>
                          <p className="text-[12px] text-amber-700 mt-0.5">{check.action}</p>
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

      {/* ─── Activity (matching the depth/quality) ─── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-100/80 bg-white shadow-card hover:shadow-card-hover transition-all duration-200 p-5">
          <h3 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <GitCommit size={14} className="text-gray-500" />
            </div>
            Recent Commits
          </h3>
          <div className="space-y-3">
            {commits.map(c => (
              <div key={c.sha} className="flex items-start gap-3 group p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
                <code className="text-[10px] bg-gradient-to-r from-gray-100 to-gray-50 text-gray-500 px-2 py-0.5 rounded-md font-mono shrink-0 mt-0.5 group-hover:from-teal/10 group-hover:to-sky-50 group-hover:text-teal transition-all">
                  {c.sha}
                </code>
                <div className="min-w-0">
                  <p className="text-[12px] text-gray-700 truncate leading-snug font-medium">{c.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.author} · {new Date(c.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100/80 bg-white shadow-card hover:shadow-card-hover transition-all duration-200 p-5">
          <h3 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <Activity size={14} className="text-gray-500" />
            </div>
            CI Pipeline
          </h3>
          <div className="space-y-2">
            {ci.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  r.conclusion === 'success' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' :
                  r.conclusion === 'failure' ? 'bg-red-500 shadow-sm shadow-red-500/50' :
                  'bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50'
                }`} />
                <span className="text-[12px] text-gray-700 truncate flex-1 font-medium">{r.name}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                  r.conclusion === 'success' ? 'text-emerald-600 bg-emerald-50' :
                  r.conclusion === 'failure' ? 'text-red-500 bg-red-50' : 'text-amber-500 bg-amber-50'
                }`}>{r.conclusion || 'running'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}