import { useEffect, useState } from 'react';
import { getDocuments } from '../api/compliance';
import {
  FileText, ChevronDown, AlertTriangle, Clock, CheckCircle2,
  ExternalLink, User, GitCommit, Calendar, Search, Download,
  Shield,
} from 'lucide-react';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface Doc {
  path: string; doc_id: string; title: string; standard: string;
  standard_label: string; owner: string; lines: number;
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

export default function DocSyncPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [filterStandard, setFilterStandard] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getDocuments()
      .then(r => setDocs(r.data.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton rows={4} />;

  const filtered = docs.filter(d => {
    if (filterStandard && d.standard !== filterStandard) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())
        && !d.doc_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const standards = [...new Set(docs.map(d => d.standard))];

  const getStatus = (d: Doc): string => d.review_event_status || d.review_status || 'unknown';

  // Group by status
  const groups: Record<string, Doc[]> = {};
  for (const d of filtered) {
    const s = getStatus(d);
    if (!groups[s]) groups[s] = [];
    groups[s].push(d);
  }

  // Merge similar statuses
  const overdue = [...(groups['overdue'] || []), ...(groups['overdue_review'] || [])];
  const neverReviewed = groups['never_reviewed'] || [];
  const modifiedSince = groups['modified_since_review'] || [];
  const dueSoon = groups['due_soon'] || [];
  const current = [...(groups['current'] || []), ...(groups['fresh'] || [])];
  const unknown = groups['unknown'] || [];

  const actionNeeded = overdue.length + neverReviewed.length + modifiedSince.length;
  const csvUrl = `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/docsync/export`;

  const statusSections = [
    { key: 'never', label: 'Never Reviewed', desc: 'No review record — ISO 13485 §4.2.4(b) violation', color: '#EF4444', icon: AlertTriangle, items: neverReviewed },
    { key: 'modified', label: 'Modified Since Review', desc: 'Content changed after last review — re-review required', color: '#F59E0B', icon: AlertTriangle, items: modifiedSince },
    { key: 'overdue', label: 'Overdue (>365 days)', desc: 'Past annual review cycle', color: '#EF4444', icon: Clock, items: overdue },
    { key: 'due', label: 'Due Within 30 Days', desc: 'Review approaching', color: '#F59E0B', icon: Clock, items: dueSoon },
    { key: 'current', label: 'Current', desc: 'Within review cycle', color: '#10B981', icon: CheckCircle2, items: current },
    { key: 'unknown', label: 'Unknown', desc: 'No data available', color: '#94A3B8', icon: FileText, items: unknown },
  ].filter(s => s.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl p-5" style={{
        background: actionNeeded > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))' : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
        border: `1px solid ${actionNeeded > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}`,
      }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: actionNeeded > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }}>
              {actionNeeded > 0 ? <AlertTriangle size={24} style={{ color: '#EF4444' }} /> : <CheckCircle2 size={24} style={{ color: '#10B981' }} />}
            </div>
            <div>
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{docs.length} Regulatory Documents</span>
              <p className="text-[12px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                {neverReviewed.length > 0 && <span className="text-red-500 font-semibold">{neverReviewed.length} never reviewed</span>}
                {modifiedSince.length > 0 && <span className="text-amber-600 font-semibold">{modifiedSince.length} modified since review</span>}
                {overdue.length > 0 && <span className="text-red-500">{overdue.length} overdue</span>}
                <span className="text-emerald-600">{current.length} current</span>
                <span>· ISO 13485 §4.2.4 · 365-day cycle</span>
              </p>
            </div>
          </div>
          <a href={csvUrl} download className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-80"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <Download size={11} /> Export CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search docs…"
            className="w-full pl-9 pr-3 py-1.5 text-[12px] rounded-lg"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        </div>
        <button onClick={() => setFilterStandard('')}
          className="px-3 py-1 text-[11px] rounded-lg font-semibold"
          style={{ background: !filterStandard ? 'var(--accent-teal)' : 'var(--card-bg)', color: !filterStandard ? 'white' : 'var(--text-secondary)', border: `1px solid ${!filterStandard ? 'var(--accent-teal)' : 'var(--border-default)'}` }}>
          All ({docs.length})
        </button>
        {standards.map(s => (
          <button key={s} onClick={() => setFilterStandard(s)}
            className="px-3 py-1 text-[11px] rounded-lg font-semibold"
            style={{ background: filterStandard === s ? 'var(--accent-teal)' : 'var(--card-bg)', color: filterStandard === s ? 'white' : 'var(--text-secondary)', border: `1px solid ${filterStandard === s ? 'var(--accent-teal)' : 'var(--border-default)'}` }}>
            {s} ({docs.filter(d => d.standard === s).length})
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Documents by Review Status (ISO 13485 §4.2.4)
        </p>
        {statusSections.map(({ key, label, desc, color, icon: Icon, items }) => {
          const isOpen = expandedGroup === key;
          return (
            <div key={key} className="rounded-2xl overflow-hidden transition-all"
              style={{ background: 'var(--card-bg)', border: `1px solid ${isOpen ? `${color}30` : 'var(--card-border)'}`, boxShadow: isOpen ? `0 4px 20px ${color}08` : 'var(--card-shadow)' }}>
              <button onClick={() => setExpandedGroup(isOpen ? null : key)}
                className="w-full flex items-center gap-4 p-4 text-left">
                <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: color }} />
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${color}12`, color }}>{items.length}</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
              </button>

              {isOpen && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="pt-3 space-y-2">
                    {items.map(doc => (
                      <div key={doc.path} className="rounded-xl p-3.5"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <code className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>{doc.doc_id}</code>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>{doc.standard_label || doc.standard}</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{doc.lines} lines</span>
                            </div>
                            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{doc.title}</h4>
                            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{doc.path}</p>
                          </div>
                          <a href={doc.github_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md hover:opacity-80 shrink-0"
                            style={{ color: 'var(--accent-teal)', background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
                            View <ExternalLink size={10} />
                          </a>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
                              <Calendar size={8} /> Modified
                            </div>
                            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDate(doc.last_modified)}</div>
                            {doc.days_since_modified !== null && (
                              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{doc.days_since_modified}d ago</div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
                              <Clock size={8} /> Next Review
                            </div>
                            <div className="text-[11px] font-semibold" style={{ color: (doc.days_until_review ?? 999) < 0 ? '#EF4444' : (doc.days_until_review ?? 999) < 30 ? '#F59E0B' : 'var(--text-primary)' }}>
                              {formatDate(doc.next_review_due)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
                              <User size={8} /> Owner
                            </div>
                            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{doc.owner}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
                              <GitCommit size={8} /> Last Commit
                            </div>
                            <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{doc.last_author || '—'}</div>
                            {doc.last_commit_sha && (
                              <a href={doc.last_commit_url || '#'} target="_blank" rel="noopener noreferrer"
                                className="text-[9px] font-mono hover:opacity-80" style={{ color: 'var(--accent-teal)' }}>
                                {doc.last_commit_sha}
                              </a>
                            )}
                          </div>
                        </div>

                        {doc.last_commit_message && (
                          <div className="mt-2 pt-2 flex items-start gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <GitCommit size={11} style={{ color: 'var(--text-muted)' }} className="mt-0.5 shrink-0" />
                            <p className="text-[11px] italic flex-1" style={{ color: 'var(--text-secondary)' }}>
                              &quot;{doc.last_commit_message}&quot;
                            </p>
                          </div>
                        )}

                        {doc.last_reviewed_at && (
                          <div className="mt-2 pt-2 text-[10px] flex items-center gap-2" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                            <Shield size={10} style={{ color: '#10B981' }} />
                            Reviewed {formatDate(doc.last_reviewed_at)} by {doc.last_reviewer_email}
                            {doc.content_unchanged_since_review === false && (
                              <span style={{ color: '#F59E0B' }}> — content changed since</span>
                            )}
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
    </div>
  );
}
