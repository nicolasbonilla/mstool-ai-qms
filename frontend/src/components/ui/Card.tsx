import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const PAD = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export default function Card({ children, className = '', hover = false, padding = 'md', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl border
        ${PAD[padding]}
        ${hover ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{
        background: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        boxShadow: 'var(--card-shadow)',
        ...(hover ? {} : {}),
      }}
      onMouseEnter={(e) => { if (hover) e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
      onMouseLeave={(e) => { if (hover) e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`pb-3 mb-3 border-b ${className}`} style={{ borderColor: 'var(--border-subtle)' }}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-[15px] font-bold ${className}`} style={{ color: 'var(--text-primary)' }}>{children}</h3>;
}
