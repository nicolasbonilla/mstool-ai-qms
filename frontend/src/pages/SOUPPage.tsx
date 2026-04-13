import { Package } from 'lucide-react';

export default function SOUPPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">SOUP Monitor</h1>
      <p className="text-sm text-gray-500 mb-8">Dependency tracking + CVE vulnerability scanning</p>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">CycloneDX SBOM</h2>
          <button className="px-3 py-1.5 bg-teal text-white text-sm rounded-lg hover:bg-teal-light">
            Scan Now
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Dependencies', value: '28', color: 'text-blue-600' },
            { label: 'Critical CVEs', value: '0', color: 'text-green-600' },
            { label: 'High CVEs', value: '0', color: 'text-green-600' },
            { label: 'Class C SOUP', value: '7', color: 'text-amber-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
