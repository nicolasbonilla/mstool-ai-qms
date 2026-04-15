/* Dashboard skeleton — shows the structure of the page while data loads.
   Follows the principle: "show a shimmer effect that hints at what's coming
   rather than blank spaces" (Mokkup.ai Interactive Dashboards Best Practices) */

function Shimmer({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ background: 'var(--bg-tertiary)', ...style }}>
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(90deg, transparent 0%, var(--bg-elevated) 50%, transparent 100%)',
        animation: 'shimmer 1.5s infinite',
      }} />
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status banner skeleton */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
        <Shimmer className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-6 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
      </div>

      {/* Area cards skeleton */}
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <Shimmer className="w-1.5 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-5 w-40" />
            <Shimmer className="h-3 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Shimmer className="w-2.5 h-2.5 rounded-full" />
            <Shimmer className="w-2.5 h-2.5 rounded-full" />
            <Shimmer className="w-2.5 h-2.5 rounded-full" />
          </div>
          <Shimmer className="h-6 w-16" />
        </div>
      ))}

      {/* Activity skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <Shimmer className="h-4 w-32 mb-4" />
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="flex items-center gap-3 mb-3">
                <Shimmer className="w-14 h-5 rounded" />
                <div className="flex-1 space-y-1">
                  <Shimmer className="h-3 w-full" />
                  <Shimmer className="h-2 w-24" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Shimmer animation keyframe injected via style tag */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
