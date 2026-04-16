import { useEffect, useState } from 'react';
import {
  Sparkles, Play, CheckCircle2, AlertTriangle, Clock, Cpu, ExternalLink,
  ShieldCheck, X, GitBranch, Package, FileCode, FileText,
  MessageSquare, ClipboardCheck, Shield, Globe, Wand2, BookOpen, Plug, Activity,
} from 'lucide-react';
import {
  listAgents, invokeAgent, listAgentRuns, approveAgentRun, AgentMeta,
  listSkills, listMcpTools, runCanary, getDriftHistory, generatePCCP,
} from '../api/agents';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface AgentRun {
  id: string;
  agent_name: string;
  model_id: string;
  tier: string;
  invoked_by_email: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: 'ok' | 'error';
  error: string | null;
  result: {
    summary: string;
    findings_count: number;
    citations_count: number;
    confidence: number;
    requires_human_signoff: boolean;
    findings: any[];
    citations: any[];
  };
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
}

const AGENT_ICONS: Record<string, any> = {
  traceability: GitBranch,
  soup_monitor: Package,
  pr_reviewer: FileCode,
  doc_drift: FileText,
  capa_drafter: AlertTriangle,
  clause_chat: MessageSquare,
  audit_prep: ClipboardCheck,
  risk_analyst: Shield,
  regulatory_watch: Globe,
  autonomous_gap_closer: Wand2,
};

const TIER_META: Record<string, { color: string; label: string }> = {
  haiku:  { color: '#06B6D4', label: 'Haiku — fast pattern matching' },
  sonnet: { color: '#8B5CF6', label: 'Sonnet — reasoning with citations' },
  opus:   { color: '#EC4899', label: 'Opus — whole-project analysis' },
};

const formatMs = (ms: number): string => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ═══════════════════════════════════════════════════════
   AGENTS PAGE — validated AI agents (Phase 4)

   Shows the 5 MVP agents with tier (Haiku/Sonnet/Opus), model version
   pin (SOUP evidence), and run history with approval status.

   Citations appear inline on each finding so Notified Body auditors can
   verify every AI assertion back to the source (commit, clause, REQ).

   References:
   - Ketryx 5-step validated loop
   - Anthropic Claude models overview
   - Cognition "Don't Build Multi-Agents" (single supervisor + read-only workers)
   ═══════════════════════════════════════════════════════ */
export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [runs, setRuns] = useState<Record<string, AgentRun[]>>({});
  const [skills, setSkills] = useState<any[]>([]);
  const [mcpTools, setMcpTools] = useState<any[]>([]);
  const [driftHistory, setDriftHistory] = useState<any[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoking, setInvoking] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentRun | null>(null);

  const load = async () => {
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

    const [a, sk, mt, dh] = await Promise.all([
      safe(listAgents()),
      safe(listSkills()),
      safe(listMcpTools()),
      safe(getDriftHistory(undefined, 20)),
    ]);
    if (a) setAgents(a.data.agents);
    if (sk) setSkills(sk.data.skills || []);
    if (mt) setMcpTools(mt.data.tools || []);
    if (dh) setDriftHistory(dh.data.history || []);

    if (!a) return;
    // Load last 5 runs per agent
    const runMap: Record<string, AgentRun[]> = {};
    await Promise.all(a.data.agents.map(async (ag: AgentMeta) => {
      try {
        const rr = await listAgentRuns(ag.name, 5);
        runMap[ag.name] = rr.data.runs;
      } catch {
        runMap[ag.name] = [];
      }
    }));
    setRuns(runMap);
  };

  const handleCanaryRun = async () => {
    setRunning('canary');
    try {
      await runCanary();
      await load();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Canary run failed');
    } finally {
      setRunning(null);
    }
  };

  const handlePCCP = async () => {
    setRunning('pccp');
    try {
      const r = await generatePCCP();
      const blob = new Blob([JSON.stringify(r.data, null, 2)],
                             { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pccp-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'PCCP generation failed');
    } finally {
      setRunning(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const onInvoke = async (name: string) => {
    setInvoking(name);
    try {
      const context = name === 'capa_drafter'
        ? { problem: prompt('Describe the problem for CAPA:') || '', evidence: '' }
        : {};
      if (name === 'capa_drafter' && !context.problem) {
        setInvoking(null);
        return;
      }
      const r = await invokeAgent(name, context);
      await load();
      setSelected(r.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Agent invocation failed');
    } finally {
      setInvoking(null);
    }
  };

  const onApprove = async (runId: string) => {
    const notes = prompt('Approval notes (optional):') || '';
    try {
      await approveAgentRun(runId, notes);
      await load();
      setSelected(null);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Approval failed');
    }
  };

  if (loading) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-6">

      {/* ═══ Banner ═══ */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(6,182,212,0.02))', border: '1px solid rgba(6,182,212,0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.12)' }}>
            <Sparkles size={24} style={{ color: '#06B6D4' }} />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Validated AI Agents</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {agents.length} agent{agents.length !== 1 ? 's' : ''} · Claude 4.5/4.6
              </span>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Specialized Claude agents that analyze commits, dependencies, docs, and drafts — every output cited and approvable under 21 CFR Part 11 §11.50.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCanaryRun} disabled={running === 'canary'}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <Activity size={11} /> {running === 'canary' ? 'Running canaries…' : 'Run canaries'}
          </button>
          <button onClick={handlePCCP} disabled={running === 'pccp'}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
            <FileText size={11} /> {running === 'pccp' ? 'Drafting…' : 'Generate PCCP'}
          </button>
        </div>
      </div>

      {/* ═══ Skills + MCP tools + Drift compact summary ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Skills */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={13} style={{ color: '#10B981' }} />
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Skills loaded by agents</span>
          </div>
          {skills.length === 0 && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No skills found.</p>}
          <div className="space-y-1.5">
            {skills.map(s => (
              <div key={s.name} className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-1.5">
                  <code className="text-[10px] font-mono font-bold" style={{ color: '#10B981' }}>{s.name}</code>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.files?.length || 0} files</span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* MCP tools */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Plug size={13} style={{ color: '#0EA5E9' }} />
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>MCP tools (IDE integration)</span>
            <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{mcpTools.length}</span>
          </div>
          <p className="text-[9px] mb-2" style={{ color: 'var(--text-muted)' }}>
            POST /api/v1/mcp with JSON-RPC 2.0 envelope from any MCP-aware client.
          </p>
          <div className="space-y-1">
            {mcpTools.slice(0, 8).map((t: any) => (
              <div key={t.name} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                <code className="font-mono font-bold" style={{ color: '#0EA5E9' }}>{t.name}</code>
                <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>— {t.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Drift snapshots */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={13} style={{ color: '#F59E0B' }} />
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Recent drift canary runs</span>
            <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{driftHistory.length}</span>
          </div>
          {driftHistory.length === 0 && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              No canary runs yet. Click "Run canaries" above.
            </p>
          )}
          <div className="space-y-1">
            {driftHistory.slice(0, 6).map((d: any) => {
              const drift = d.drift_eval?.is_drift;
              return (
                <div key={d.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: drift ? '#EF4444' : '#10B981' }} />
                  <code className="font-mono" style={{ color: 'var(--text-secondary)' }}>{d.agent_name}</code>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    sim={d.drift_eval?.jaccard_similarity ?? '—'}
                  </span>
                  <span className="ml-auto text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    {d.captured_at ? new Date(d.captured_at).toLocaleDateString() : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Agent grid ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(a => {
          const Icon = AGENT_ICONS[a.name] || Cpu;
          const tier = TIER_META[a.tier] || TIER_META.sonnet;
          const agentRuns = runs[a.name] || [];
          const lastRun = agentRuns[0];
          return (
            <div key={a.name} className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tier.color}15` }}>
                  <Icon size={16} style={{ color: tier.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
                      {a.name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${tier.color}15`, color: tier.color }}>
                      {a.tier}
                    </span>
                    {a.requires_signoff_default && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                        <ShieldCheck size={9} /> Sign-off
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.description}</p>
                  <p className="text-[9px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                    Model: <span style={{ color: tier.color }}>{a.model}</span> (SOUP pinned)
                  </p>
                </div>
                <button onClick={() => onInvoke(a.name)} disabled={invoking === a.name}
                  className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition-all"
                  style={{ background: tier.color }}>
                  <Play size={11} /> {invoking === a.name ? 'Running…' : 'Run'}
                </button>
              </div>

              {/* Last run strip */}
              {lastRun && (
                <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span>Last run</span>
                    <span>{formatDate(lastRun.started_at)} · {formatMs(lastRun.duration_ms)}</span>
                  </div>
                  <div className="mt-1.5 rounded-lg p-2 cursor-pointer transition-colors"
                    style={{ background: 'var(--bg-tertiary)' }}
                    onClick={() => setSelected(lastRun)}>
                    <div className="flex items-center gap-2 mb-1">
                      {lastRun.status === 'ok'
                        ? <CheckCircle2 size={11} style={{ color: '#10B981' }} />
                        : <AlertTriangle size={11} style={{ color: '#EF4444' }} />}
                      <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {lastRun.result?.summary || lastRun.error || '(no summary)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      <span>{lastRun.result?.findings_count ?? 0} findings</span>
                      <span>·</span>
                      <span>{lastRun.result?.citations_count ?? 0} citations</span>
                      <span>·</span>
                      <span>conf {((lastRun.result?.confidence ?? 0) * 100).toFixed(0)}%</span>
                      {lastRun.approved && (
                        <span className="ml-auto inline-flex items-center gap-0.5" style={{ color: '#10B981' }}>
                          <CheckCircle2 size={9} /> approved
                        </span>
                      )}
                    </div>
                  </div>
                  {agentRuns.length > 1 && (
                    <div className="mt-1 text-[9px] text-right" style={{ color: 'var(--text-muted)' }}>
                      + {agentRuns.length - 1} earlier run{agentRuns.length > 2 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
              {!lastRun && (
                <div className="pt-3 mt-1 text-[10px] text-center" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  No runs yet — click Run to invoke
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ Run detail modal ═══ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelected(null)}>
          <div className="rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[16px] font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
                  {selected.agent_name.replace(/_/g, ' ')} — run {selected.id?.slice(0, 8)}
                </h2>
                <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                  Model: {selected.model_id} · Started: {formatDate(selected.started_at)} · Duration: {formatMs(selected.duration_ms)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="rounded-lg p-3 mb-3" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Summary</div>
              <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{selected.result?.summary || '(none)'}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span className="inline-flex items-center gap-1"><Clock size={10} />{formatMs(selected.duration_ms)}</span>
                <span>Confidence: {((selected.result?.confidence ?? 0) * 100).toFixed(0)}%</span>
                <span>{selected.result?.findings_count ?? 0} findings</span>
                <span>{selected.result?.citations_count ?? 0} citations</span>
              </div>
            </div>

            {/* Findings */}
            {(selected.result?.findings?.length ?? 0) > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Findings ({selected.result.findings.length})
                </div>
                <div className="space-y-1.5">
                  {selected.result.findings.slice(0, 10).map((f: any, i: number) => (
                    <div key={i} className="rounded-lg p-2.5 text-[11px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                      <pre className="whitespace-pre-wrap font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        {JSON.stringify(f, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Citations */}
            {(selected.result?.citations?.length ?? 0) > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Citations ({selected.result.citations.length})
                </div>
                <div className="space-y-1">
                  {selected.result.citations.slice(0, 20).map((c: any, i: number) => (
                    <a key={i} href={c.url || '#'} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg text-[10px] hover:opacity-80"
                      style={{ background: 'rgba(6,182,212,0.06)' }}>
                      <span className="font-bold uppercase" style={{ color: '#06B6D4' }}>{c.source}</span>
                      <code className="font-mono" style={{ color: 'var(--text-primary)' }}>{c.reference}</code>
                      {c.excerpt && <span className="truncate italic" style={{ color: 'var(--text-muted)' }}>"{c.excerpt}"</span>}
                      <ExternalLink size={9} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Approval */}
            <div className="rounded-lg p-3" style={{ background: selected.approved ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${selected.approved ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}` }}>
              {selected.approved ? (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: '#10B981' }}>
                  <CheckCircle2 size={12} /> Approved by <strong>{selected.approved_by}</strong> at {formatDate(selected.approved_at!)}
                </div>
              ) : selected.result?.requires_human_signoff ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px]" style={{ color: '#F59E0B' }}>
                    <AlertTriangle size={11} className="inline mr-1" />
                    This run requires human sign-off (21 CFR Part 11 §11.50) before acting.
                  </div>
                  <button onClick={() => onApprove(selected.id)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: '#10B981' }}>
                    Sign & Approve
                  </button>
                </div>
              ) : (
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Advisory only — no sign-off required.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
