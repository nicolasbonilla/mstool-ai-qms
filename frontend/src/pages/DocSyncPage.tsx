import { useEffect, useState, useMemo } from 'react';
import { getDocuments } from '../api/compliance';
import {
  reviewDoc, listDocReviews, getDocHistory, getDocDiff,
  getDocCompleteness, getDocPreview, runDocAIDrift, draftDocUpdate,
  getDocTimeline,
} from '../api/docsync';
import {
  FileText, ChevronDown, AlertTriangle, Clock, CheckCircle2,
  ExternalLink, User, GitCommit, Calendar, Search, Download,
  Sparkles, Eye, Shield, X, ArrowUpDown, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface Doc {
  path: string; doc_id: string; title: string; standard: string;
  standard_label: string; owner: string; lines: number; size_bytes: number;
  github_url: string; last_modified: string | null;
  days_since_modified: number | null; next_review_due: string | null;
  days_until_review: number | null; review_status: string;
  review_cycle_days: number; last_author: string | null;
  last_commit_sha: string | null; last_commit_message: string | null;
  last_commit_url: string | null; freshness: string;
  review_event_status?: string; review_event_reason?: string;
  last_reviewed_at?: string | null; last_reviewer_email?: string | null;
  content_unchanged_since_review?: boolean | null;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const STATUS_META: Record<string, { color: string; label: string; icon: any }> = {
  fresh:                   { color: '#10B981', label: 'Reviewed & Current',       icon: CheckCircle2 },
  current:                 { color: '#10B981', label: 'Current (not yet reviewed)',icon: Clock },
  modified_since_review:   { color: '#F59E0B', label: 'Modified since review',    icon: AlertTriangle },
  never_reviewed:          { color: '#EF4444', label: 'Never reviewed',           icon: AlertTriangle },
  overdue_review:          { color: '#EF4444', label: 'Review overdue',           icon: AlertTriangle },
  overdue:                 { color: '#EF4444', label: 'Overdue',                  icon: AlertTriangle },
  due_soon:                { color: '#F59E0B', label: 'Due soon',                 icon: Clock },
  unknown:                 { color: '#94A3B8', label: 'Unknown',                  icon: FileText },
};

export default function DocSyncPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('never_reviewed');
  const [filterStandard, setFilterStandard] = useState('');
  const [search, setSearch] = useState('');
  const [timeline, setTimeline] = useState<any>(null);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [modalTab, setModalTab] = useState<'info' | 'reviews' | 'history' | 'diff' | 'completeness' | 'preview'>('info');
  const [modalData, setModalData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionRunning, setActionRunning] = useState<string | null>(null);

  useEffect(() => {
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    Promise.all([safe(getDocuments()), safe(getDocTimeline())])
      .then(([d, t]) => {
        if (d) setDocs(d.data.documents || []);
        if (t) setTimeline(t.data);
      }).finally(() => setLoading(false));
  }, []);

  const reload = async () => { try { const r = await getDocuments(); setDocs(r.data.documents || []); } catch {} };

  const openDoc = async (doc: Doc, tab: typeof modalTab = 'info') => {
    setSelectedDoc(doc); setModalTab(tab); setModalData(null);
    if (tab === 'info') return;
    setModalLoading(true);
    try {
      if (tab === 'reviews') { const r = await listDocReviews(doc.path); setModalData(r.data.reviews || []); }
      else if (tab === 'history') { const r = await getDocHistory(doc.path); setModalData(r.data.commits || []); }
      else if (tab === 'diff') { const r = await getDocDiff(doc.path); setModalData(r.data); }
      else if (tab === 'completeness') { const r = await getDocCompleteness(doc.path); setModalData(r.data); }
      else if (tab === 'preview') { const r = await getDocPreview(doc.path); setModalData(r.data); }
    } catch (e: any) { setModalData({ error: e.response?.data?.detail || 'Failed' }); }
    setModalLoading(false);
  };

  const handleReview = async (doc: Doc) => {
    const role = prompt('Your role (e.g., QMS Manager, Software Lead):');
    if (!role) return;
    setActionRunning('review');
    try { await reviewDoc(doc.path, role); await reload(); alert(`Review recorded for ${doc.doc_id}`); } catch (e: any) { alert(e.response?.data?.detail || 'Failed'); }
    setActionRunning(null);
  };

  const handleAIDrift = async (doc: Doc) => {
    setActionRunning('drift');
    try { const r = await runDocAIDrift(doc.path); alert(`Drift: ${r.data?.result?.summary || 'done'}`); } catch (e: any) { alert(e.response?.data?.detail || 'Failed'); }
    setActionRunning(null);
  };

  const handleAIUpdate = async (doc: Doc) => {
    setActionRunning('update');
    try { const r = await draftDocUpdate(doc.path); setSelectedDoc(doc); setModalTab('info'); setModalData({ aiDraft: r.data }); } catch (e: any) { alert(e.response?.data?.detail || 'Failed'); }
    setActionRunning(null);
  };

  if (loading) return <PageSkeleton rows={4} />;

  const filtered = docs.filter(d => {
    if (filterStandard && d.standard !== filterStandard) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.doc_id.toLowerCase().includes(search.toLowerCase()) && !d.path.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const standards = [...new Set(docs.map(d => d.standard))];
  const effectiveStatus = (d: Doc): string => d.review_event_status || d.review_status || 'unknown';

  const groups = useMemo(() => {
    const g: Record<string, Doc[]> = { never_reviewed: [], modified_since_review: [], overdue_review: [], overdue: [], due_soon: [], current: [], fresh: [], unknown: [] };
    for (const d of filtered) { const s = effectiveStatus(d); if (g[s]) g[s].push(d); else if (s.includes('overdue')) g.overdue.push(d); else if (s.includes('never')) g.never_reviewed.push(d); else if (s.includes('modified')) g.modified_since_review.push(d); else g.unknown.push(d); }
    return g;
  }, [filtered]);

  const neverReviewed = groups.never_reviewed.length;
  const modifiedSince = groups.modified_since_review.length;
  const overdue = groups.overdue.length + groups.overdue_review.length;
  const freshCount = groups.fresh.length + groups.current.length;
  const actionNeeded = neverReviewed + modifiedSince + overdue;
  const csvUrl = `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/docsync/export`;

  return (
    <div className="space-y-6">
      {/* L1 — STATUS */}
      <div className="rounded-2xl p-5" style={{ background: actionNeeded > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))' : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))', border: `1px solid ${actionNeeded > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}` }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: actionNeeded > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }}>
              {actionNeeded > 0 ? <AlertTriangle size={24} style={{ color: '#EF4444' }} /> : <CheckCircle2 size={24} style={{ color: '#10B981' }} />}
            </div>
            <div>
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{docs.length} Regulatory Documents</span>
              <p className="text-[12px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                {neverReviewed > 0 && <span className="text-red-500 font-semibold">{neverReviewed} never reviewed</span>}
                {modifiedSince > 0 && <span className="text-amber-600 font-semibold">{modifiedSince} modified since review</span>}
                {overdue > 0 && <span className="text-red-500">{overdue} overdue</span>}
                <span className="text-emerald-600">{freshCount} current</span>
                <span>· ISO 13485 §4.2.4 · 365-day cycle</span>
              </p>
            </div>
          </div>
          <a href={csvUrl} download className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-80" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <Download size={11} /> Export CSV
          </a>
        </div>
      </div>

      {/* TIMELINE + FORECAST */}
      {timeline && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-center gap-2 mb-2"><BarChart3 size={13} style={{ color: 'var(--text-muted)' }} /><span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Document commits per month</span></div>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline.monthly_commits || []}>
                  <XAxis dataKey="month" style={{ fontSize: 9 }} stroke="var(--text-muted)" />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(timeline.monthly_commits || []).map((_: any, i: number) => (<Cell key={i} fill="var(--accent-teal)" opacity={0.5 + (i / ((timeline.monthly_commits?.length || 1) * 2))} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
            <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Review expiry forecast</span>
            <div className="mt-3 space-y-2 text-[11px]">
              {[{ label: 'Overdue now', key: 'overdue', color: '#EF4444' }, { label: '0-30 days', key: '0_30', color: '#F59E0B' }, { label: '31-60 days', key: '31_60', color: '#F59E0B' }, { label: '61-90 days', key: '61_90', color: '#F59E0B' }, { label: 'Safe (91-365d)', key: '91_365', color: '#10B981' }].map(b => (
                <div key={b.key} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} /><span className="flex-1" style={{ color: 'var(--text-secondary)' }}>{b.label}</span><span className="font-bold tabular-nums" style={{ color: b.color }}>{timeline.expiry_forecast?.[b.key] ?? 0}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search docs…" className="w-full pl-9 pr-3 py-1.5 text-[12px] rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        </div>
        <button onClick={() => setFilterStandard('')} className="px-3 py-1 text-[11px] rounded-lg font-semibold" style={{ background: !filterStandard ? 'var(--accent-teal)' : 'var(--card-bg)', color: !filterStandard ? 'white' : 'var(--text-secondary)', border: `1px solid ${!filterStandard ? 'var(--accent-teal)' : 'var(--border-default)'}` }}>All ({docs.length})</button>
        {standards.map(s => (<button key={s} onClick={() => setFilterStandard(s)} className="px-3 py-1 text-[11px] rounded-lg font-semibold" style={{ background: filterStandard === s ? 'var(--accent-teal)' : 'var(--card-bg)', color: filterStandard === s ? 'white' : 'var(--text-secondary)', border: `1px solid ${filterStandard === s ? 'var(--accent-teal)' : 'var(--border-default)'}` }}>{s} ({docs.filter(d => d.standard === s).length})</button>))}
      </div>

      {/* L2 — REVIEW STATUS GROUPS */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Documents by Review Status (ISO 13485 §4.2.4)</p>
        {[
          { key: 'never_reviewed', label: 'Never Reviewed — Audit Finding', desc: 'No review record. ISO 13485 §4.2.4(b) requires review before use.', color: '#EF4444', items: groups.never_reviewed },
          { key: 'modified_since_review', label: 'Modified Since Last Review', desc: 'Content hash diverged from reviewed version. Re-review required.', color: '#F59E0B', items: groups.modified_since_review },
          { key: 'overdue', label: 'Overdue Review (>365 days)', desc: 'Past annual cycle. Must be re-reviewed and re-approved.', color: '#EF4444', items: [...groups.overdue, ...groups.overdue_review] },
          { key: 'due_soon', label: 'Due Within 30 Days', desc: 'Annual review approaching.', color: '#F59E0B', items: groups.due_soon },
          { key: 'fresh', label: 'Reviewed & Current', desc: 'Reviewed within cycle and content unchanged.', color: '#10B981', items: [...groups.fresh, ...groups.current] },
          ...(groups.unknown.length > 0 ? [{ key: 'unknown', label: 'Unknown', desc: 'No data.', color: '#94A3B8', items: groups.unknown }] : []),
        ].map(({ key, label, desc, color, items }) => {
          if (items.length === 0) return null;
          const isOpen = expandedGroup === key;
          const Icon = STATUS_META[key]?.icon || FileText;
          return (
            <div key={key} className="rounded-2xl overflow-hidden transition-all" style={{ background: 'var(--card-bg)', border: `1px solid ${isOpen ? `${color}30` : 'var(--card-border)'}`, boxShadow: isOpen ? `0 4px 20px ${color}08` : 'var(--card-shadow)' }}>
              <button onClick={() => setExpandedGroup(isOpen ? null : key)} className="w-full flex items-center gap-4 p-4 text-left">
                <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: color }} />
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12` }}><Icon size={16} style={{ color }} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span><span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${color}12`, color }}>{items.length}</span></div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="pt-3 space-y-2">
                    {items.map(doc => (
                      <div key={doc.path} className="rounded-xl p-3.5 cursor-pointer transition-all hover:shadow-md" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }} onClick={() => openDoc(doc)}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <code className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{doc.doc_id}</code>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>{doc.standard_label}</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{doc.lines} lines</span>
                              {doc.review_event_status === 'never_reviewed' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>never reviewed</span>}
                              {doc.review_event_status === 'modified_since_review' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>modified since review</span>}
                            </div>
                            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{doc.title}</h4>
                            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{doc.path}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={e => { e.stopPropagation(); handleReview(doc); }} disabled={actionRunning !== null} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md hover:opacity-80" style={{ background: 'rgba(16,185,129,0.10)', color: '#10B981', border: '1px solid rgba(16,185,129,0.20)' }}><Shield size={10} /> Review</button>
                            <a href={doc.github_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md" style={{ color: 'var(--accent-teal)', background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}><ExternalLink size={10} /></a>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <div><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}><Calendar size={8} /> Modified</div><div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDate(doc.last_modified)}</div>{doc.days_since_modified !== null && <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{doc.days_since_modified}d ago</div>}</div>
                          <div><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}><Clock size={8} /> Next Review</div><div className="text-[11px] font-semibold" style={{ color: (doc.days_until_review ?? 999) < 0 ? '#EF4444' : (doc.days_until_review ?? 999) < 30 ? '#F59E0B' : 'var(--text-primary)' }}>{formatDate(doc.next_review_due)}</div></div>
                          <div><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}><User size={8} /> Owner</div><div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{doc.owner}</div></div>
                          <div><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}><GitCommit size={8} /> Last Commit</div><div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{doc.last_author || '—'}</div>{doc.last_commit_sha && <code className="text-[9px] font-mono" style={{ color: 'var(--accent-teal)' }}>{doc.last_commit_sha}</code>}</div>
                        </div>
                        {doc.last_reviewed_at && <div className="mt-2 pt-2 text-[10px] flex items-center gap-2" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}><Shield size={10} style={{ color: '#10B981' }} />Reviewed {formatDate(doc.last_reviewed_at)} by {doc.last_reviewer_email}{doc.content_unchanged_since_review === false && <span style={{ color: '#F59E0B' }}> — content changed</span>}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DETAIL MODAL */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedDoc(null)}>
          <div className="rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div><h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>{selectedDoc.doc_id} — {selectedDoc.title}</h2><p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{selectedDoc.path}</p></div>
              <button onClick={() => setSelectedDoc(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}><X size={14} /></button>
            </div>
            <div className="flex items-center gap-1 px-5 pt-3 flex-wrap">
              {([{ k: 'info', label: 'Info', icon: FileText }, { k: 'reviews', label: 'Reviews', icon: Shield }, { k: 'history', label: 'History', icon: GitCommit }, { k: 'diff', label: 'Diff vs Reviewed', icon: ArrowUpDown }, { k: 'completeness', label: 'Sections', icon: CheckCircle2 }, { k: 'preview', label: 'Preview', icon: Eye }] as const).map(t => {
                const I = t.icon; return (<button key={t.k} onClick={() => openDoc(selectedDoc, t.k)} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-all" style={{ background: modalTab === t.k ? 'var(--accent-teal)' : 'var(--bg-tertiary)', color: modalTab === t.k ? 'white' : 'var(--text-muted)' }}><I size={10} /> {t.label}</button>);
              })}
            </div>
            <div className="p-5 space-y-3">
              {modalLoading && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
              {modalData?.error && <p className="text-[12px]" style={{ color: '#EF4444' }}>{modalData.error}</p>}

              {modalTab === 'info' && !modalLoading && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}><div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Standard</div><span>{selectedDoc.standard_label}</span></div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}><div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Owner</div><span>{selectedDoc.owner}</span></div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--bg-tertiary)' }}><div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</div><span style={{ color: STATUS_META[effectiveStatus(selectedDoc)]?.color }}>{STATUS_META[effectiveStatus(selectedDoc)]?.label || effectiveStatus(selectedDoc)}</span></div>
                  </div>
                  {selectedDoc.review_event_reason && <p className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>{selectedDoc.review_event_reason}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handleReview(selectedDoc)} disabled={actionRunning !== null} className="flex items-center gap-1.5 text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: '#10B981' }}><Shield size={11} /> {actionRunning === 'review' ? 'Recording…' : 'Review & Sign (e-sig)'}</button>
                    <button onClick={() => handleAIDrift(selectedDoc)} disabled={actionRunning !== null} className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'rgba(236,72,153,0.1)', color: '#EC4899', border: '1px solid rgba(236,72,153,0.2)' }}><Sparkles size={11} /> {actionRunning === 'drift' ? 'Checking…' : 'AI: Detect drift'}</button>
                    <button onClick={() => handleAIUpdate(selectedDoc)} disabled={actionRunning !== null} className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}><Sparkles size={11} /> {actionRunning === 'update' ? 'Drafting…' : 'AI: Draft update'}</button>
                  </div>
                  {modalData?.aiDraft && (<div className="rounded-lg p-3" style={{ background: 'var(--code-bg)', border: '1px solid var(--code-border)' }}><div className="text-[10px] font-bold mb-1" style={{ color: '#8B5CF6' }}>AI-drafted update:</div><pre className="text-[11px] whitespace-pre-wrap font-mono" style={{ color: 'var(--code-text)' }}>{modalData.aiDraft.draft || '(empty)'}</pre></div>)}
                </div>
              )}

              {modalTab === 'reviews' && !modalLoading && Array.isArray(modalData) && (<div>{modalData.length === 0 && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No review records yet. Click "Review & Sign" to create the first one.</p>}<div className="space-y-1.5">{modalData.map((r: any) => (<div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}><CheckCircle2 size={12} style={{ color: '#10B981' }} /><div className="flex-1 min-w-0"><span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{r.reviewer_email}</span><span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>as {r.reviewer_role} · {r.meaning}</span></div><span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{formatDate(r.reviewed_at)}</span>{r.reviewed_at_commit && <code className="text-[9px] font-mono" style={{ color: 'var(--accent-teal)' }}>@{r.reviewed_at_commit}</code>}</div>))}</div></div>)}

              {modalTab === 'history' && !modalLoading && Array.isArray(modalData) && (<div>{modalData.length === 0 && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No commits found.</p>}<div className="space-y-1">{modalData.map((c: any) => (<a key={c.sha} href={c.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg text-[11px] hover:opacity-80" style={{ background: 'var(--bg-tertiary)' }}><code className="font-mono font-bold shrink-0" style={{ color: 'var(--accent-teal)' }}>{c.sha}</code><span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{c.message}</span><span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{c.author} · {formatDate(c.date)}</span></a>))}</div></div>)}

              {modalTab === 'diff' && !modalLoading && modalData && !modalData.error && (<div>{!modalData.available && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{modalData.reason}</p>}{modalData.available && (<><div className="flex items-center gap-3 text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}><span>vs reviewed@{modalData.reviewed_at_commit} ({formatDate(modalData.reviewed_at)})</span><span className="text-emerald-600">+{modalData.additions}</span><span className="text-red-500">-{modalData.deletions}</span>{modalData.compare_url && <a href={modalData.compare_url} target="_blank" rel="noopener noreferrer" className="ml-auto font-semibold hover:opacity-80" style={{ color: 'var(--accent-teal)' }}>GitHub diff →</a>}</div><pre className="text-[10px] font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto p-3 rounded-lg" style={{ background: 'var(--code-bg)', color: 'var(--code-text)', border: '1px solid var(--code-border)' }}>{modalData.diff || '(no changes)'}</pre></>)}</div>)}

              {modalTab === 'completeness' && !modalLoading && modalData && !modalData.error && (<div>{!modalData.applicable && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{modalData.reason}</p>}{modalData.applicable && (<><div className="flex items-center gap-3 mb-3"><span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>{modalData.doc_type}: {modalData.completeness_pct}% complete</span>{modalData.missing?.length > 0 && <span className="text-[10px] font-bold" style={{ color: '#EF4444' }}>{modalData.missing.length} missing</span>}</div><div className="grid grid-cols-2 gap-1.5">{modalData.required_sections?.map((s: string) => { const ok = !modalData.missing?.includes(s); return (<div key={s} className="flex items-center gap-2 text-[11px] p-1.5 rounded" style={{ background: ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)' }}>{ok ? <CheckCircle2 size={10} style={{ color: '#10B981' }} /> : <X size={10} style={{ color: '#EF4444' }} />}<span style={{ color: ok ? 'var(--text-secondary)' : '#EF4444' }}>{s}</span></div>); })}</div></>)}</div>)}

              {modalTab === 'preview' && !modalLoading && modalData && !modalData.error && (<div><div className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>{modalData.lines} lines · {modalData.size} bytes</div><pre className="text-[11px] font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto p-3 rounded-lg" style={{ background: 'var(--code-bg)', color: 'var(--code-text)', border: '1px solid var(--code-border)' }}>{modalData.content || '(empty)'}</pre></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
