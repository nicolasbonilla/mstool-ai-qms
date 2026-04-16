import { useEffect, useState } from 'react';
import {
  Tag, Plus, CheckCircle2, Clock, Shield, GitBranch,
  Package, TrendingUp, TrendingDown, Minus, AlertTriangle, X,
} from 'lucide-react';
import { listBaselines, createBaseline, signBaseline, diffBaselines } from '../api/baselines';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface Baseline {
  id: string;
  version_tag: string;
  created_at: string;
  created_by_email: string;
  auto_triggered: boolean;
  notes: string;
  status: 'draft' | 'signed' | 'submitted';
  hash: string;
  compliance: {
    scores: {
      iec62304: number;
      iso13485: number;
      cybersecurity: number;
      ce_mark_overall: number;
    };
    breakdown: Record<string, number>;
  };
  traceability: {
    stats: Record<string, number>;
    orphan_count: number;
  };
  soup: {
    summary: { total_dependencies: number };
    dependencies: any[];
  };
  signatures: Array<{
    signer_email: string;
    signer_role: string;
    signed_at: string;
    meaning: string;
  }>;
}

interface Diff {
  from: { version_tag: string; created_at: string };
  to: { version_tag: string; created_at: string };
  score_delta: Record<string, { from: number; to: number; delta: number }>;
  soup: {
    added: any[];
    removed: any[];
    changed: Array<{ name: string; from: string; to: string }>;
  };
  traceability_delta: Record<string, { from: number; to: number; delta: number }>;
}

const STATUS_META: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  draft:     { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: Clock,         label: 'Draft' },
  signed:    { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2,  label: 'Signed' },
  submitted: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  icon: Shield,        label: 'Submitted' },
};

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

/* ═══════════════════════════════════════════════════════
   RELEASES PAGE — immutable baselines (Phase 3)

   Evidence artifact for CE Mark / FDA submission.
   Reference: Jama Connect Baselines, Codebeamer Compare Baselines,
   21 CFR 820.30(j) Design History File immutability.

   Level 1: List of baselines with status + score summary
   Level 2: Detail modal with signatures + breakdown
   Level 3: Diff viewer (select 2 baselines → structured delta)
   ═══════════════════════════════════════════════════════ */
export default function ReleasesPage() {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({ version_tag: '', notes: '' });
  const [selected, setSelected] = useState<Baseline | null>(null);
  const [diffFrom, setDiffFrom] = useState<string>('');
  const [diffTo, setDiffTo] = useState<string>('');
  const [diff, setDiff] = useState<Diff | null>(null);

  const load = async () => {
    try {
      const r = await listBaselines(50);
      setBaselines(r.data.baselines || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const onCreate = async () => {
    if (!form.version_tag.trim()) {
      setCreateError('Version tag required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await createBaseline(form.version_tag.trim(), form.notes);
      setShowCreate(false);
      setForm({ version_tag: '', notes: '' });
      await load();
    } catch (e: any) {
      setCreateError(e.response?.data?.detail || 'Failed to create baseline');
    } finally {
      setCreating(false);
    }
  };

  const onSign = async (versionTag: string) => {
    const role = prompt('Signing role (e.g., QMS Manager, Clinical Lead, Software Lead):');
    if (!role) return;
    try {
      await signBaseline(versionTag, role, 'approved');
      await load();
      if (selected?.version_tag === versionTag) {
        const refreshed = baselines.find(b => b.version_tag === versionTag);
        if (refreshed) setSelected(refreshed);
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Signing failed');
    }
  };

  const onDiff = async () => {
    if (!diffFrom || !diffTo || diffFrom === diffTo) return;
    try {
      const r = await diffBaselines(diffFrom, diffTo);
      setDiff(r.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Diff failed');
    }
  };

  if (loading) return <PageSkeleton rows={4} />;

  return (
    <div className="space-y-6">

      {/* ═══ Banner ═══ */}
      <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))', border: '1px solid rgba(139,92,246,0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <Tag size={24} style={{ color: '#8B5CF6' }} />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Release Baselines</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {baselines.length} baseline{baselines.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Immutable QMS snapshots for CE Mark / FDA submission. Each baseline captures compliance scores,
              traceability, SOUP, and activity at a point in time.{' '}
              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>21 CFR 820.30(j)</span>
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-white rounded-xl transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
          <Plus size={14} /> Create Baseline
        </button>
      </div>

      {/* ═══ Create modal ═══ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => !creating && setShowCreate(false)}>
          <div className="rounded-2xl max-w-md w-full p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>Create Baseline</h2>
              <button onClick={() => setShowCreate(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-tertiary)' }}>
                <X size={14} />
              </button>
            </div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Version tag</label>
            <input type="text" value={form.version_tag} onChange={e => setForm({ ...form, version_tag: e.target.value })}
              placeholder="v1.0.0-ce"
              className="w-full px-3 py-2 text-[13px] rounded-lg font-mono mb-3"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="What does this release represent?"
              rows={3}
              className="w-full px-3 py-2 text-[12px] rounded-lg mb-3"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            {createError && (
              <div className="rounded-lg p-2 mb-3 text-[11px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                {createError}
              </div>
            )}
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="text-[11px] font-semibold px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={onCreate} disabled={creating}
                className="text-[11px] font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
                {creating ? 'Capturing…' : 'Create Baseline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Diff viewer ═══ */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Compare</span>
          <select value={diffFrom} onChange={e => setDiffFrom(e.target.value)}
            className="text-[11px] font-mono px-2 py-1 rounded-lg"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            <option value="">— from —</option>
            {baselines.map(b => <option key={b.id} value={b.version_tag}>{b.version_tag}</option>)}
          </select>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>→</span>
          <select value={diffTo} onChange={e => setDiffTo(e.target.value)}
            className="text-[11px] font-mono px-2 py-1 rounded-lg"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            <option value="">— to —</option>
            {baselines.map(b => <option key={b.id} value={b.version_tag}>{b.version_tag}</option>)}
          </select>
          <button onClick={onDiff} disabled={!diffFrom || !diffTo || diffFrom === diffTo}
            className="text-[11px] font-semibold px-3 py-1 rounded-lg text-white disabled:opacity-50"
            style={{ background: 'var(--accent-teal)' }}>
            Compare
          </button>
        </div>

        {diff && (
          <div className="mt-4 space-y-3">
            {/* Score deltas */}
            {Object.keys(diff.score_delta).length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Compliance scores</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(diff.score_delta).map(([k, d]) => (
                    <div key={k} className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{d.from}%</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>→</span>
                        <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.to}%</span>
                        <span className="text-[10px] font-bold" style={{ color: d.delta >= 0 ? '#10B981' : '#EF4444' }}>
                          {d.delta >= 0 ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                          {' '}{d.delta >= 0 ? '+' : ''}{d.delta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SOUP */}
            {(diff.soup.added.length + diff.soup.removed.length + diff.soup.changed.length) > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>SOUP changes</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg p-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#10B981' }}>Added ({diff.soup.added.length})</div>
                    {diff.soup.added.slice(0, 5).map((d, i) => (
                      <div key={i} className="text-[10px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                        {d.name}@{d.version}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>Removed ({diff.soup.removed.length})</div>
                    {diff.soup.removed.slice(0, 5).map((d, i) => (
                      <div key={i} className="text-[10px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                        {d.name}@{d.version}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#F59E0B' }}>Changed ({diff.soup.changed.length})</div>
                    {diff.soup.changed.slice(0, 5).map((c, i) => (
                      <div key={i} className="text-[10px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                        {c.name}: {c.from}→{c.to}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Traceability */}
            {Object.keys(diff.traceability_delta).length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Traceability</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(diff.traceability_delta).map(([k, d]) => (
                    <div key={k} className="rounded-lg px-2 py-1 text-[10px]" style={{ background: 'var(--bg-tertiary)' }}>
                      <span className="font-bold">{k}</span>: {d.from} → {d.to}{' '}
                      <span style={{ color: d.delta >= 0 ? '#10B981' : '#EF4444' }}>
                        ({d.delta >= 0 ? '+' : ''}{d.delta})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Baselines list ═══ */}
      <div className="space-y-2">
        {baselines.length === 0 && (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <Tag size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>No baselines yet</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Create the first baseline at a release milestone to establish immutable evidence.
            </p>
          </div>
        )}

        {baselines.map(b => {
          const st = STATUS_META[b.status] || STATUS_META.draft;
          const StIcon = st.icon;
          return (
            <div key={b.id} className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
              onClick={() => setSelected(b)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: st.bg }}>
                    <StIcon size={16} style={{ color: st.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{b.version_tag}</code>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {b.auto_triggered && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                          auto
                        </span>
                      )}
                      {b.signatures.length > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                          <CheckCircle2 size={9} />{b.signatures.length} sig
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(b.created_at)} · {b.created_by_email}
                    </p>
                    {b.notes && <p className="text-[11px] mt-1 italic" style={{ color: 'var(--text-secondary)' }}>"{b.notes}"</p>}
                  </div>
                </div>

                {/* Score summary */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>CE Mark</div>
                    <div className="text-[20px] font-extrabold tabular-nums" style={{ color: b.compliance.scores.ce_mark_overall >= 95 ? '#10B981' : '#F59E0B' }}>
                      {b.compliance.scores.ce_mark_overall}%
                    </div>
                  </div>
                  <div className="w-px h-10" style={{ background: 'var(--border-subtle)' }} />
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1" title="Dependencies"><Package size={11} />{b.soup?.summary?.total_dependencies ?? 0}</span>
                    <span className="flex items-center gap-1" title="Orphans">
                      {b.traceability?.orphan_count > 0 ? <AlertTriangle size={11} style={{ color: '#F59E0B' }} /> : <CheckCircle2 size={11} style={{ color: '#10B981' }} />}
                      {b.traceability?.orphan_count ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Detail modal ═══ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelected(null)}>
          <div className="rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{selected.version_tag}</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(selected.created_at)} · {selected.created_by_email}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-tertiary)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {Object.entries(selected.compliance.scores).map(([k, v]) => (
                <div key={k} className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</div>
                  <div className="text-[16px] font-bold" style={{ color: v >= 90 ? '#10B981' : '#F59E0B' }}>{v}%</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Hash</div>
              <code className="text-[10px] font-mono break-all" style={{ color: 'var(--accent-teal)' }}>{selected.hash}</code>
            </div>

            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Signatures ({selected.signatures.length})
              </div>
              {selected.signatures.length === 0 && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No signatures yet.</p>
              )}
              {selected.signatures.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg mb-1" style={{ background: 'rgba(16,185,129,0.06)' }}>
                  <CheckCircle2 size={12} style={{ color: '#10B981' }} />
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{s.signer_email}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>as {s.signer_role}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>{formatDate(s.signed_at)}</span>
                </div>
              ))}
              <button onClick={() => onSign(selected.version_tag)}
                className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.20)' }}>
                <CheckCircle2 size={11} /> Add signature (21 CFR Part 11 §11.50)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
                  <GitBranch size={11} /> Traceability
                </div>
                <div>{selected.traceability?.stats?.requirements ?? 0} requirements</div>
                <div>{selected.traceability?.stats?.tests ?? 0} tests</div>
                <div style={{ color: selected.traceability?.orphan_count > 0 ? '#F59E0B' : 'var(--text-muted)' }}>
                  {selected.traceability?.orphan_count ?? 0} orphans
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
                  <Package size={11} /> SOUP
                </div>
                <div>{selected.soup?.summary?.total_dependencies ?? 0} dependencies</div>
                <div style={{ color: 'var(--text-muted)' }}>frozen at baseline time</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder reference to silence unused icon if no diff yet */}
      <div className="hidden"><Minus size={0} /></div>
    </div>
  );
}
