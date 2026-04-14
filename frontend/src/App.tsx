import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, GitBranch, ShieldCheck,
  Package, RefreshCw, Bell, LogOut, User, BookOpen,
} from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FormsPage from './pages/FormsPage';
import TraceabilityPage from './pages/TraceabilityPage';
import AuditPage from './pages/AuditPage';
import SOUPPage from './pages/SOUPPage';
import DocSyncPage from './pages/DocSyncPage';
import GuidePage from './pages/GuidePage';
import AIAssistant from './components/AIAssistant';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/forms', label: 'Forms', icon: FileText },
  { path: '/traceability', label: 'Traceability', icon: GitBranch },
  { path: '/audit', label: 'Audit', icon: ShieldCheck },
  { path: '/soup', label: 'SOUP', icon: Package },
  { path: '/docsync', label: 'Doc Sync', icon: RefreshCw },
  { path: '/guide', label: 'Guide', icon: BookOpen },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  qms_manager: 'QMS Manager',
  developer: 'Developer',
  qa: 'QA',
  clinical_advisor: 'Clinical Advisor',
  viewer: 'Viewer',
};

export default function App() {
  const location = useLocation();
  const { user, profile, loading, init, logout } = useAuthStore();

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading MSTool-AI-QMS...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <LoginPage />;
  }

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

        {/* User info + logout */}
        <div className="p-4 border-t border-navy-light">
          <div className="flex items-center gap-3 mb-3">
            {profile?.picture ? (
              <img src={profile.picture} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 bg-teal/20 rounded-full flex items-center justify-center">
                <User size={14} className="text-teal-light" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{profile?.name || user.email}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[profile?.role || 'viewer']}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors w-full"
          >
            <LogOut size={14} />
            Sign Out
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-3">
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
          <Route path="/guide" element={<GuidePage />} />
        </Routes>
      </main>

      {/* AI Assistant floating panel */}
      <AIAssistant />
    </div>
  );
}