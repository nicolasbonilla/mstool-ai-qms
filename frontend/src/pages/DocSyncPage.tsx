import { useEffect, useState } from 'react';
import { getDocuments } from '../api/compliance';
import { RefreshCw, FileText } from 'lucide-react';

interface Doc { path: string; doc_id: string; title: string; standard: string; last_modified: string; lines: number; freshness: string; }

const FRESHNESS_COLORS: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

export default function DocSyncPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getDocuments().then(r => setDocs(r.data.documents));
  }, []);

  const filtered = filter ? docs.filter(d => d.standard === filter) : docs;
  const standards = [...new Set(docs.map(d => d.standard))];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Sync</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor document freshness and drift</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal-light">
          <RefreshCw size={16} /> Check Drift
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 text-sm rounded-lg ${!filter ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >All ({docs.length})</button>
        {standards.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg ${filter === s ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >{s} ({docs.filter(d => d.standard === s).length})</button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => (
          <div key={doc.path} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <FileText size={18} className="text-gray-400 mt-0.5" />
              <span className={`text-xs px-2 py-0.5 rounded-full ${FRESHNESS_COLORS[doc.freshness]}`}>
                {doc.freshness === 'green' ? 'Fresh' : doc.freshness === 'yellow' ? 'Review' : 'Outdated'}
              </span>
            </div>
            <h3 className="font-medium text-sm text-gray-900 mt-2 truncate">{doc.doc_id}</h3>
            <p className="text-xs text-gray-400 mt-1 truncate">{doc.path}</p>
            <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
              <span>{doc.lines} lines</span>
              <span>{doc.standard}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
