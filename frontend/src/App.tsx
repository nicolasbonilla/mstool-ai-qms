import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, GitBranch, ShieldCheck,
  Package, RefreshCw, Bell, LogOut, User, BookOpen,
  ChevronRight,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm font-medium">Loading MSTool-AI-QMS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex">
      {/* Sidebar */}
      <aside className="w-[260px] bg-navy fixed h-full flex flex-col z-40">
        {/* Brand */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-teal to-accent rounded-xl flex items-center justify-center shadow-glow-sm">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-white tracking-tight">MSTool-AI-QMS</h1>
              <p className="text-[10px] text-gray-500 font-medium">Regulatory Compliance</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 space-y-0.5">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`sidebar-item ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-teal/60" />}
              </Link>
            );
          })}
        </nav>

        {/* IEC Badge */}
        <div className="mx-4 mb-3 p-3 rounded-xl bg-gradient-to-r from-teal/[0.08] to-accent/[0.05] border border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal/20 flex items-center justify-center">
              <Bell size={12} className="text-teal" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-300">IEC 62304 Class C</p>
              <p className="text-[9px] text-gray-500">Highest Safety Classification</p>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            {profile?.picture ? (
              <img src={profile.picture} alt="" className="w-9 h-9 rounded-xl object-cover ring-2 ring-white/10" />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-teal/20 to-accent/20 rounded-xl flex items-center justify-center ring-1 ring-white/10">
                <User size={15} className="text-teal-light" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{profile?.name || user.email}</p>
              <p className="text-[10px] text-gray-500 font-medium">{ROLE_LABELS[profile?.role || 'viewer']}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-[11px] text-gray-500 hover:text-red-400 transition-all duration-200 w-full py-1.5 px-2 rounded-lg hover:bg-red-500/[0.06]"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-[260px] p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto animate-fade-in">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/forms" element={<FormsPage />} />
            <Route path="/traceability" element={<TraceabilityPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/soup" element={<SOUPPage />} />
            <Route path="/docsync" element={<DocSyncPage />} />
            <Route path="/guide" element={<GuidePage />} />
          </Routes>
        </div>
      </main>

      <AIAssistant />
    </div>
  );
}