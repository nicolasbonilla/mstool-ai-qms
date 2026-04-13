import { ShieldCheck } from 'lucide-react';

export default function AuditPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Audit Simulator</h1>
      <p className="text-sm text-gray-500 mb-8">Simulate Notified Body audit questions</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Full Audit', desc: 'Simulate complete IEC 62304 + ISO 13485 audit', mode: 'full' },
          { title: 'Random Commit', desc: 'Pick a random commit and trace to requirements', mode: 'random_commit' },
          { title: 'Random Requirement', desc: 'Pick a random REQ-ID and show all evidence', mode: 'random_requirement' },
        ].map(({ title, desc, mode }) => (
          <button
            key={mode}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:border-teal hover:shadow-md transition"
          >
            <ShieldCheck size={24} className="text-teal mb-3" />
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-2">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
