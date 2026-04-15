import { useEffect, useState } from 'react';
import { getDocuments } from '../api/compliance';
import { RefreshCw, FileText, Filter, Hash, Search } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

interface Doc { path: string; doc_id: string; title: string; standard: string; last_modified: string; lines: number; freshness: string; }

const FRESHNESS_CONFIG: Record<string, { label: string; bg: string; text: string; ring: string; dot: string }> = {
  green: {
    label: 'Fresh',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-1 ring-emerald-200/50',
    dot: 'bg-emerald-400',
  },
  yellow: {
    label: 'Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-1 ring-amber-200/50',
    dot: 'bg-amber-400',
  },
  red: {
    label: 'Outdated',
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-1 ring-red-200/50',
    dot: 'bg-red-400',
  },
};

export default function DocSyncPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getDocuments().then(r => setDocs(r.data.documents));
  }, []);

  const filtered = filter ? docs.filter(d => d.standard === filter) : docs;
  const standards = [...new Set(docs.map(d => d.standard))];

  const freshCounts = {
    green: docs.filter(d => d.freshness === 'green').length,
    yellow: docs.filter(d => d.freshness === 'yellow').length,
    red: docs.filter(d => d.freshness === 'red').length,
  };

  return (
    <div className="space-y-6">
      {/* ═══ LEVEL 1 — STATUS BANNER ═══ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: freshCounts.red > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))' : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
          border: `1px solid ${freshCounts.red > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: freshCounts.red > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)' }}>
            <RefreshCw size={24} style={{ color: freshCounts.red > 0 ? '#EF4444' : '#10B981' }} />
          </div>
          <div>
            <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>{docs.length} Regulatory Documents</span>
            <p className="text-[13px] mt-0.5 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{freshCounts.green} fresh</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{freshCounts.yellow} review needed</span>
              {freshCounts.red > 0 && <span className="flex items-center gap-1 text-red-500 font-semibold"><span className="w-2 h-2 rounded-full bg-red-500" />{freshCounts.red} outdated</span>}
              <span>· ISO 13485 Clause 4.2.4</span>
            </p>
          </div>
        </div>
      </div>

      {/* ═══ LEVEL 2 — FILTERS + DOCUMENT GRID ═══ */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-[var(--text-muted)]" />
        <button
          onClick={() => setFilter('')}
          className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-all duration-200 ${
            !filter
              ? 'bg-gradient-to-r from-navy to-navy-light text-white shadow-sm'
              : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] hover:border-gray-300'
          }`}
        >All ({docs.length})</button>
        {standards.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-all duration-200 ${
              filter === s
                ? 'bg-gradient-to-r from-navy to-navy-light text-white shadow-sm'
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] hover:border-gray-300'
            }`}
          >{s} ({docs.filter(d => d.standard === s).length})</button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(doc => {
          const freshness = FRESHNESS_CONFIG[doc.freshness] || FRESHNESS_CONFIG.green;
          return (
            <div
              key={doc.path}
              className="bg-[var(--card-bg)] rounded-2xl shadow-card border border-[var(--card-border)] p-5 hover:shadow-card-hover hover:scale-[1.02] transition-all duration-200 cursor-default group"
            >
              {/* Top row: icon + freshness badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-lg bg-[var(--bg-tertiary)] p-2.5 group-hover:bg-teal/10 transition-colors duration-200">
                  <FileText size={18} className="text-[var(--text-muted)] group-hover:text-teal transition-colors duration-200" />
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${freshness.bg} ${freshness.text} ${freshness.ring}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${freshness.dot}`} />
                  {freshness.label}
                </span>
              </div>

              {/* Doc ID */}
              <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">{doc.doc_id}</h3>

              {/* Path */}
              <p className="text-xs text-[var(--text-muted)] mt-1 truncate" title={doc.path}>{doc.path}</p>

              {/* Footer: lines + standard */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--card-border)]">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Hash size={12} />
                  <span>{doc.lines} lines</span>
                </div>
                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                  {doc.standard}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && docs.length > 0 && (
        <EmptyState
          icon={<Search size={28} style={{ color: 'var(--text-muted)' }} />}
          title="No documents match this filter"
          description="Try selecting a different standard or clearing the filter to see all documents."
          action={{ label: 'Show All', onClick: () => setFilter('') }}
        />
      )}
    </div>
  );
}
