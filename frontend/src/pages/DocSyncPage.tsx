import { useEffect, useState } from 'react';
import { getDocuments } from '../api/compliance';
import { FileText, ChevronDown, AlertTriangle, Clock, CheckCircle2, ExternalLink, User, GitCommit, Calendar } from 'lucide-react';
import PageSkeleton from '../components/ui/PageSkeleton';

/* ─── Types ─── */
interface Doc {
  path: string;
  doc_id: string;
  title: string;
  standard: string;
  standard_label: string;
  owner: string;
  lines: number;
  size_bytes: number;
  github_url: string;
  last_modified: string | null;
  days_since_modified: number | null;
  next_review_due: string | null;
  days_until_review: number | null;
  review_status: 'current' | 'due_soon' | 'overdue' | 'unknown';
  review_cycle_days: number;
  last_author: string | null;
  last_commit_sha: string | null;
  last_commit_message: string | null;
  last_commit_url: string | null;
  freshness: string;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/* ═══════════════════════════════════════════════════════
   DOC SYNC PAGE — 3-Level Information Architecture

   Level 1: Status — "Are my regulatory docs up to date?"
   Level 2: Documents grouped by review urgency (Overdue → Due Soon → Current)
   Level 3: Per-document detail — last modified, last commit, owner, next review

   ISO 13485 §4.2.4 (Control of Documents) — requires periodic review,
   IEC 62304 §5.1.7 (Software Configuration Management) — change traceability.
   Industry practice: 365-day review cycle for QMS documents.
   ═══════════════════════════════════════════════════════ */
export default function DocSyncPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('overdue');
  const [filterStandard, setFilterStandard] = useState<string>('');

  useEffect(() => {
    getDocuments()
      .then(r => setDocs(r.data.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton rows={4} />;

  const filtered = filterStandard ? docs.filter(d => d.standard === filterStandard) : docs;
  const standards = [...new Set(docs.map(d => d.standard))];

  const overdue = filtered.filter(d => d.review_status === 'overdue');
  const dueSoon = filtered.filter(d => d.review_status === 'due_soon');
  const current = filtered.filter(d => d.review_status === 'current');
  const unknown = filtered.filter(d => d.review_status === 'unknown');

  // Sort each group by urgency
  overdue.sort((a, b) => (a.days_until_review || 0) - (b.days_until_review || 0));
  dueSoon.sort((a, b) => (a.days_until_review || 0) - (b.days_until_review || 0));
  current.sort((a, b) => (b.days_until_review || 0) - (a.days_until_review || 0));

  const totalDocs = filtered.length;
  const compliancePct = totalDocs > 0 ? Math.round(((current.length + dueSoon.length) / totalDocs) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════
          LEVEL 1 — STATUS BANNER
          "Are my regulatory docs up to date?"
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: overdue.length > 0
            ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))'
            : dueSoon.length > 0
              ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))'
              : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
          border: `1px solid ${overdue.length > 0 ? 'rgba(239,68,68,0.15)' : dueSoon.length > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: overdue.length > 0 ? 'rgba(239,68,68,0.12)' : dueSoon.length > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)' }}>
            {overdue.length > 0
              ? <AlertTriangle size={24} style={{ color: '#EF4444' }} />
              : dueSoon.length > 0
                ? <Clock size={24} style={{ color: '#F59E0B' }} />
                : <CheckCircle2 size={24} style={{ color: '#10B981' }} />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {totalDocs} Regulatory Documents
              </span>
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
                ({compliancePct}% within review cycle)
              </span>
            </div>
            <p className="text-[13px] mt-0.5 flex items-center gap-3 flex-wrap" style={{ color: 'var(--text-muted)' }}>
              {overdue.length > 0 && (
                <span className="flex items-center gap-1.5 text-red-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {overdue.length} overdue review
                </span>
              )}
              {dueSoon.length > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {dueSoon.length} due within 30 days
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {current.length} current
              </span>
              {unknown.length > 0 && <span>· {unknown.length} unknown</span>}
              <span>· ISO 13485 §4.2.4 · 365-day review cycle</span>
            </p>
          </div>
        </div>
      </div>

      {/* Standard filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Filter:</span>
        <button onClick={() => setFilterStandard('')}
          className={`px-3 py-1 text-[11px] rounded-lg font-semibold transition-all`}
          style={{
            background: !filterStandard ? 'var(--accent-teal)' : 'var(--card-bg)',
            color: !filterStandard ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${!filterStandard ? 'var(--accent-teal)' : 'var(--border-default)'}`,
          }}>
          All ({docs.length})
        </button>
        {standards.map(s => (
          <button key={s} onClick={() => setFilterStandard(s)}
            className={`px-3 py-1 text-[11px] rounded-lg font-semibold transition-all`}
            style={{
              background: filterStandard === s ? 'var(--accent-teal)' : 'var(--card-bg)',
              color: filterStandard === s ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filterStandard === s ? 'var(--accent-teal)' : 'var(--border-default)'}`,
            }}>
            {s} ({docs.filter(d => d.standard === s).length})
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          LEVEL 2 — REVIEW STATUS GROUPS
          "Which documents need review?"
          Grouped by urgency (Overdue → Due Soon → Current)
          ═══════════════════════════════════════ */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Documents by Review Urgency (ISO 13485 §4.2.4)
        </p>

        {[
          {
            key: 'overdue',
            label: 'Overdue Review',
            desc: 'Past 365-day review cycle. ISO 13485 §4.2.4 requires re-review and re-approval. Update or formally extend the review.',
            color: '#EF4444',
            items: overdue,
            icon: AlertTriangle,
          },
          {
            key: 'due_soon',
            label: 'Due Within 30 Days',
            desc: 'Approaching annual review deadline. Schedule review before the date passes to maintain audit readiness.',
            color: '#F59E0B',
            items: dueSoon,
            icon: Clock,
          },
          {
            key: 'current',
            label: 'Current — No Action Needed',
            desc: 'Within 365-day review cycle and recently modified. No action required.',
            color: '#10B981',
            items: current,
            icon: CheckCircle2,
          },
          ...(unknown.length > 0 ? [{
            key: 'unknown',
            label: 'Unknown — No Commit History',
            desc: 'No commit history found for these files. Verify document tracking.',
            color: '#94A3B8',
            items: unknown,
            icon: FileText,
          }] : []),
        ].map(({ key, label, desc, color, items, icon: Icon }) => {
          const isOpen = expandedGroup === key;
          if (items.length === 0) return null;

          return (
            <div key={key} className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: 'var(--card-bg)',
                border: `1px solid ${isOpen ? `${color}30` : 'var(--card-border)'}`,
                boxShadow: isOpen ? `0 4px 20px ${color}08` : 'var(--card-shadow)',
              }}>
              <button onClick={() => setExpandedGroup(isOpen ? null : key)}
                className="w-full flex items-center gap-4 p-4 text-left">
                <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: color }} />
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${color}12`, color }}>
                      {items.length}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--text-muted)' }} />
              </button>

              {/* ═══════════════════════════════
                  LEVEL 3 — DOCUMENT DETAIL
                  Per-doc: ID, last modified, last commit, owner, next review
                  ═══════════════════════════════ */}
              {isOpen && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="pt-3 space-y-2">
                    {items.map(doc => (
                      <div key={doc.path} className="rounded-xl p-3.5"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                        {/* Header row: ID + Title + GitHub link */}
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                style={{ background: `${color}15`, color }}>
                                {doc.doc_id}
                              </code>
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                                {doc.standard_label}
                              </span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{doc.lines} lines</span>
                            </div>
                            <h4 className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                              {doc.title}
                            </h4>
                            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }} title={doc.path}>
                              {doc.path}
                            </p>
                          </div>
                          <a href={doc.github_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md hover:opacity-80 transition-opacity shrink-0"
                            style={{ color: 'var(--accent-teal)', background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
                            View <ExternalLink size={10} />
                          </a>
                        </div>

                        {/* Metadata grid: 4 columns */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          {/* Last Modified */}
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                              <Calendar size={9} /> Last Modified
                            </div>
                            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {formatDate(doc.last_modified)}
                            </div>
                            {doc.days_since_modified !== null && (
                              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                {doc.days_since_modified} days ago
                              </div>
                            )}
                          </div>

                          {/* Next Review Due */}
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                              <Clock size={9} /> Next Review Due
                            </div>
                            <div className="text-[11px] font-semibold" style={{ color: doc.review_status === 'overdue' ? '#EF4444' : doc.review_status === 'due_soon' ? '#F59E0B' : 'var(--text-primary)' }}>
                              {formatDate(doc.next_review_due)}
                            </div>
                            {doc.days_until_review !== null && (
                              <div className="text-[9px]" style={{ color: doc.review_status === 'overdue' ? '#EF4444' : 'var(--text-muted)' }}>
                                {doc.days_until_review < 0
                                  ? `${Math.abs(doc.days_until_review)} days overdue`
                                  : `in ${doc.days_until_review} days`}
                              </div>
                            )}
                          </div>

                          {/* Owner */}
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                              <User size={9} /> Document Owner
                            </div>
                            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {doc.owner}
                            </div>
                            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                              IEC 62304 §5.1.7
                            </div>
                          </div>

                          {/* Last Commit */}
                          <div>
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                              <GitCommit size={9} /> Last Change
                            </div>
                            <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }} title={doc.last_author || ''}>
                              {doc.last_author || '—'}
                            </div>
                            {doc.last_commit_sha && (
                              <a href={doc.last_commit_url || '#'} target="_blank" rel="noopener noreferrer"
                                className="text-[9px] font-mono hover:opacity-80 transition-opacity"
                                style={{ color: 'var(--accent-teal)' }}>
                                {doc.last_commit_sha}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Last commit message */}
                        {doc.last_commit_message && (
                          <div className="mt-3 pt-3 flex items-start gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <GitCommit size={11} style={{ color: 'var(--text-muted)' }} className="mt-0.5 shrink-0" />
                            <p className="text-[11px] italic flex-1" style={{ color: 'var(--text-secondary)' }}>
                              "{doc.last_commit_message}"
                            </p>
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
