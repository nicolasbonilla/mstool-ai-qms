/* Generic page skeleton — status banner + content cards */

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ background: 'var(--bg-tertiary)' }}>
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(90deg, transparent 0%, var(--bg-elevated) 50%, transparent 100%)',
        animation: 'shimmer 1.5s infinite',
      }} />
    </div>
  );
}

export default function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Status banner */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
        <Shimmer className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-5 w-44" />
          <Shimmer className="h-3 w-80" />
        </div>
      </div>

      {/* Content rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-4">
            <Shimmer className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-48" />
              <Shimmer className="h-3 w-32" />
            </div>
            <Shimmer className="h-5 w-16" />
          </div>
        </div>
      ))}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
