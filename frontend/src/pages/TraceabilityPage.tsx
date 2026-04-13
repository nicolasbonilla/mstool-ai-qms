import { GitBranch } from 'lucide-react';

export default function TraceabilityPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Traceability Explorer</h1>
      <p className="text-sm text-gray-500 mb-8">REQ → Design → Code → Test → Risk Control</p>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <GitBranch size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-600">Interactive Graph</h2>
        <p className="text-sm text-gray-400 mt-2">
          Traceability graph visualization will be built with @xyflow/react.
          Click any node to navigate to source code, test file, or regulatory document.
        </p>
        <div className="mt-6 grid grid-cols-5 gap-2">
          {['REQ', 'Design', 'Code', 'Test', 'Risk'].map((label, i) => (
            <div key={label} className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-red-500'][i]
              }`}>{label}</div>
              {i < 4 && <span className="text-gray-300 mt-1">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
