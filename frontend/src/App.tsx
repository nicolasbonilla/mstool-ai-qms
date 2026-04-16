import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, FileText, GitBranch, ShieldCheck,
  Package, RefreshCw, LogOut, User, BookOpen,
  Sun, Moon, ChevronRight, Activity, TrendingUp, Tag, Sparkles, Brain,
} from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FormsPage from './pages/FormsPage';
import TraceabilityPage from './pages/TraceabilityPage';
import AuditPage from './pages/AuditPage';
import SOUPPage from './pages/SOUPPage';
import DocSyncPage from './pages/DocSyncPage';
import GuidePage from './pages/GuidePage';
import ActivityPage from './pages/ActivityPage';
import TrendsPage from './pages/TrendsPage';
import ReleasesPage from './pages/ReleasesPage';
import AgentsPage from './pages/AgentsPage';
import InsightsPage from './pages/InsightsPage';
import AIAssistant from './components/AIAssistant';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/trends', label: 'Trends', icon: TrendingUp },
      { path: '/activity', label: 'Activity', icon: Activity },
    ],
  },
  {
    label: 'Daily Work',
    items: [
      { path: '/forms', label: 'Forms', icon: FileText },
      { path: '/audit', label: 'Audit', icon: ShieldCheck },
      { path: '/releases', label: 'Releases', icon: Tag },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { path: '/traceability', label: 'Traceability', icon: GitBranch },
      { path: '/soup', label: 'SOUP', icon: Package },
      { path: '/docsync', label: 'Doc Sync', icon: RefreshCw },
    ],
  },
  {
    label: 'AI',
    items: [
      { path: '/agents', label: 'Agents', icon: Sparkles },
      { path: '/insights', label: 'Insights', icon: Brain },
    ],
  },
  {
    label: 'Resources',
    items: [
      { path: '/guide', label: 'Guide', icon: BookOpen },
    ],
  },
];

const ROLES: Record<string, string> = {
  admin: 'Admin', qms_manager: 'QMS Manager', developer: 'Developer',
  qa: 'QA', clinical_advisor: 'Clinical', viewer: 'Viewer',
};

export default function App() {
  const location = useLocation();
  const { user, profile, loading, init, logout } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();

  useEffect(() => { const unsub = init(); return unsub; }, [init]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
    </div>
  );

  if (!user) return <LoginPage />;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
      {/* ─── Sidebar ─── */}
      <aside className="w-[260px] h-full flex flex-col shrink-0" style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}>
        {/* Brand */}
        <div className="h-14 px-5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-glow-sm" style={{ background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)' }}>
            <ShieldCheck size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-white leading-none tracking-tight">MSTool-AI</p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--sidebar-text)' }}>Quality Management</p>
          </div>
        </div>

        {/* Navigation — grouped by workflow */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] px-4 pt-3 pb-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {section.label}
              </p>
              {section.items.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path}
                    className="flex items-center gap-3 h-9 px-3 mx-1 rounded-lg text-[13px] font-medium transition-all duration-150"
                    style={{
                      background: active ? 'var(--sidebar-active)' : 'transparent',
                      color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)'; }}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.7} style={{ color: active ? 'var(--accent-teal)' : undefined }} />
                    <span className="flex-1">{label}</span>
                    {active && <ChevronRight size={13} style={{ color: 'rgba(14,165,233,0.5)' }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Theme Toggle + IEC Badge */}
        <div className="px-3 space-y-2 mb-3">
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200"
            style={{ background: 'var(--sidebar-hover)', color: 'var(--sidebar-text)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text)'; }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span className="text-[12px] font-medium">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          {/* IEC Badge */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.1)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent-teal)' }} />
              <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>IEC 62304 Class C</p>
            </div>
            <p className="text-[9px] ml-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Monitoring active</p>
          </div>
        </div>

        {/* User */}
        <div className="p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-2.5">
            {profile?.picture ? (
              <img src={profile.picture} alt="" className="w-8 h-8 rounded-lg object-cover" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }} />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.1)' }}>
                <User size={14} style={{ color: 'var(--accent-teal)' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/80 truncate">{profile?.name || user.email}</p>
              <p className="text-[10px]" style={{ color: 'var(--sidebar-text)' }}>{ROLES[profile?.role || 'viewer']}</p>
            </div>
            <button onClick={logout}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.15)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-[1400px] mx-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/releases" element={<ReleasesPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/forms" element={<FormsPage />} />
                <Route path="/traceability" element={<TraceabilityPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/soup" element={<SOUPPage />} />
                <Route path="/docsync" element={<DocSyncPage />} />
                <Route path="/guide" element={<GuidePage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AIAssistant />
    </div>
  );
}
