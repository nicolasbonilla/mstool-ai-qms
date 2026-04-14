import { useEffect, useState, useRef } from 'react';
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
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame: number;
    let start = 0;
    const duration = 1200;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * to * 10) / 10);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <span ref={ref}>{val}%</span>;
}

/* ─── Score Ring ─── */
function Ring({ value, color, size = 140 }: { value: number; color: string; size?: number }) {
  const sw = 10;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const mid = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 12px ${color}40)` }}>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)' }} />
    </svg>
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-[3px] border-blue-500/20 border-t-blue-500 animate-spin" />
        <p className="text-[13px] text-gray-400 animate-pulse">Analyzing repository compliance...</p>
      </div>
    </div>
  );
  if (!data) return null;

  const scores = [
    { key: 'ce_mark_overall', label: 'CE Mark', sub: 'Overall Readiness', color: '#3B82F6' },
    { key: 'iec62304', label: 'IEC 62304', sub: 'Software Lifecycle', color: '#10B981' },
    { key: 'iso13485', label: 'ISO 13485', sub: 'Quality Management', color: '#8B5CF6' },
    { key: 'cybersecurity', label: 'Cybersecurity', sub: 'IEC 81001-5-1', color: '#F59E0B' },
  ];

  const pass = data.checks.filter(c => c.status === 'pass').length;

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Compliance Dashboard</h1>
          <p className="text-[13px] text-gray-400 mt-1 flex items-center gap-1.5">
            <a href={data.repo} target="_blank" rel="noopener" className="hover:text-blue-600 transition-colors inline-flex items-center gap-1">
              nicolasbonilla/medical-imaging-viewer <ExternalLink size={11} />
            </a>
            <span className="text-gray-200">·</span>
            {new Date(data.computed_at).toLocaleString()}
          </p>
        </div>
        <div className="badge-success flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold">
          <CircleDot size={12} /> {pass}/{data.checks.length} passing
        </div>
      </div>

      {/* ─── Score Hero ─── */}
      <div className="relative overflow-hidden rounded-3xl" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)' }}>
        {/* Glow effects */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-purple-500/8 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative px-12 py-10">
          <div className="grid grid-cols-4 gap-6">
            {scores.map(({ key, label, sub, color }) => (
              <div key={key} className="flex flex-col items-center group">
                <div className="relative">
                  <Ring value={data.scores[key]} color={color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[26px] font-extrabold text-white tracking-tight">
                      <Counter to={data.scores[key]} />
                    </span>
                  </div>
                </div>
                <p className="text-[14px] font-bold text-white mt-4">{label}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Formula */}
          <div className="mt-8 pt-5 border-t border-white/[0.05] text-center">
            <code className="text-[11px] text-white/20 font-mono tracking-wide">
              CE Mark = IEC 62304 × 0.35 + ISO 13485 × 0.30 + Cybersecurity × 0.20 + Docs × 0.15
            </code>
          </div>
        </div>
      </div>

      {/* ─── Compliance Checks ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-gray-900">Compliance Evidence</h2>
          <span className="text-[11px] text-gray-400">Click to inspect evidence & source code</span>
        </div>

        <div className="grid gap-2.5">
          {data.checks.map((check) => {
            const isOpen = open === check.id;
            const Icon = ICONS[check.id] || Shield;
            const score = Math.round(check.score * 10) / 10;
            const pass = check.status === 'pass';
            const statusColor = pass ? '#10B981' : check.status === 'warn' ? '#F59E0B' : '#EF4444';

            return (
              <div key={check.id}
                className={`rounded-2xl border bg-white transition-all duration-200 ${
                  isOpen ? 'border-blue-200 shadow-lg shadow-blue-500/5' : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
                }`}>
                <button onClick={() => setOpen(isOpen ? null : check.id)}
                  className="w-full flex items-center gap-4 p-4 text-left group">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                    style={{ backgroundColor: `${statusColor}12`, color: statusColor }}>
                    <Icon size={18} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 leading-tight">{check.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{check.standard}</p>
                  </div>

                  {/* Score bar */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[16px] font-extrabold tabular-nums" style={{ color: statusColor }}>
                      {score}%
                    </span>
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: statusColor, transition: 'width 0.8s ease-out' }} />
                    </div>
                    <div className="w-4 text-gray-300 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : '' }}>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="px-5 pb-5 animate-fade-in">
                    <div className="border-t border-gray-50 pt-4">
                      {/* Description */}
                      <div className="flex gap-3 p-4 rounded-xl mb-4" style={{ backgroundColor: '#EFF6FF' }}>
                        <Sparkles size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[12px] text-blue-900 leading-relaxed font-medium">{check.description}</p>
                          <p className="text-[11px] text-blue-500 mt-1.5 font-mono">{check.standard}</p>
                        </div>
                      </div>

                      {/* Evidence */}
                      <div className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                          <FileText size={12} className="text-gray-400" />
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Evidence Trail</span>
                        </div>
                        {check.evidence.map((ev, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <code className="text-[11px] text-gray-500 font-mono">{ev.file}</code>
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{ev.detail}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-3">
                              {ev.status === 'protected' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                  <CheckCircle2 size={10} /> PASS
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                                  <XCircle size={10} /> FAIL
                                </span>
                              )}
                              <a href={ev.github_url} target="_blank" rel="noopener"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                                GitHub <ArrowUpRight size={10} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action */}
                      {check.action && (
                        <div className="flex gap-3 p-4 mt-3 rounded-xl bg-amber-50 border border-amber-100">
                          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-bold text-amber-800">Action Required</p>
                            <p className="text-[12px] text-amber-700 mt-0.5">{check.action}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Activity ─── */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <h3 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
            <GitCommit size={15} className="text-gray-400" /> Recent Commits
          </h3>
          <div className="space-y-3">
            {commits.map(c => (
              <div key={c.sha} className="flex items-start gap-3 group">
                <code className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  {c.sha}
                </code>
                <div className="min-w-0">
                  <p className="text-[12px] text-gray-700 truncate leading-snug">{c.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.author} · {new Date(c.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <h3 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={15} className="text-gray-400" /> CI Pipeline
          </h3>
          <div className="space-y-2.5">
            {ci.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  r.conclusion === 'success' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' :
                  r.conclusion === 'failure' ? 'bg-red-500 shadow-sm shadow-red-500/50' :
                  'bg-amber-500 animate-pulse'
                }`} />
                <span className="text-[12px] text-gray-700 truncate flex-1">{r.name}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${
                  r.conclusion === 'success' ? 'text-emerald-600' :
                  r.conclusion === 'failure' ? 'text-red-500' : 'text-amber-500'
                }`}>{r.conclusion || 'running'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}