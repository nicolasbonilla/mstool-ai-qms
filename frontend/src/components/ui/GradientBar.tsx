interface GradientBarProps {
  value: number;
  colorFrom: string;
  colorTo: string;
  height?: number;
  className?: string;
}

export default function GradientBar({ value, colorFrom, colorTo, height = 6, className = '' }: GradientBarProps) {
  return (
    <div className={`w-full rounded-full overflow-hidden ${className}`} style={{ height, background: 'var(--bg-tertiary)' }}>
      <div className="h-full rounded-full" style={{
        width: `${Math.min(value, 100)}%`,
        background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
        boxShadow: `0 0 8px ${colorFrom}30`,
        transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  );
}
