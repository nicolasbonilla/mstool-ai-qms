interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ width, height, background: 'var(--bg-tertiary)' }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: `1px solid var(--card-border)` }}>
      <Skeleton height={12} width="40%" className="mb-3" />
      <Skeleton height={28} width="30%" className="mb-4" />
      <Skeleton height={6} className="rounded-full" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton width={36} height={36} className="rounded-xl shrink-0" />
      <div className="flex-1">
        <Skeleton height={14} width="60%" className="mb-2" />
        <Skeleton height={10} width="40%" />
      </div>
      <Skeleton width={60} height={20} className="rounded-md" />
    </div>
  );
}
