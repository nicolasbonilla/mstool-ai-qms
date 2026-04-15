import { ReactNode } from 'react';

type Variant = 'pass' | 'warn' | 'fail' | 'info' | 'neutral';

interface BadgeProps {
  variant: Variant;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

const STYLES: Record<Variant, { bg: string; text: string; ring: string; dot: string }> = {
  pass: { bg: 'var(--status-pass-bg)', text: 'var(--status-pass-text)', ring: 'var(--status-pass-ring)', dot: 'var(--accent-emerald)' },
  warn: { bg: 'var(--status-warn-bg)', text: 'var(--status-warn-text)', ring: 'var(--status-warn-ring)', dot: 'var(--accent-amber)' },
  fail: { bg: 'var(--status-fail-bg)', text: 'var(--status-fail-text)', ring: 'var(--status-fail-ring)', dot: 'var(--accent-red)' },
  info: { bg: 'rgba(14,165,233,0.1)', text: 'var(--accent-teal)', ring: 'rgba(14,165,233,0.2)', dot: 'var(--accent-teal)' },
  neutral: { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', ring: 'var(--border-default)', dot: 'var(--text-muted)' },
};

export default function Badge({ variant, children, dot = false, className = '' }: BadgeProps) {
  const s = STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${className}`}
      style={{ background: s.bg, color: s.text, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />}
      {children}
    </span>
  );
}
