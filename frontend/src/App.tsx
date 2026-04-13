import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, GitBranch, ShieldCheck,
  Package, RefreshCw, Bell,
} from 'lucide-react';
import DashboardPage from './pages/DashboardPage';
import FormsPage from './pages/FormsPage';
import TraceabilityPage from './pages/TraceabilityPage';
import AuditPage from './pages/AuditPage';
import SOUPPage from './pages/SOUPPage';
import DocSyncPage from './pages/DocSyncPage';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/forms', label: 'Forms', icon: FileText },
  { path: '/traceability', label: 'Traceability', icon: GitBranch },
  { path: '/audit', label: 'Audit', icon: ShieldCheck },
  { path: '/soup', label: 'SOUP', icon: Package },
  { path: '/docsync', label: 'Doc Sync', icon: RefreshCw },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-navy text-white flex flex-col fixed h-full">
        <div className="p-6 border-b border-navy-light">
          <h1 className="text-lg font-bold text-teal-light">MSTool-AI-QMS</h1>
          <p className="text-xs text-gray-400 mt-1">Regulatory Compliance</p>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  active
                    ? 'bg-teal/20 text-teal-light border-r-2 border-teal'
                    : 'text-gray-400 hover:text-white hover:bg-navy-light'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-navy-light">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Bell size={14} />
            <span>IEC 62304 Class C</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/traceability" element={<TraceabilityPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/soup" element={<SOUPPage />} />
          <Route path="/docsync" element={<DocSyncPage />} />
        </Routes>
      </main>
    </div>
  );
}
