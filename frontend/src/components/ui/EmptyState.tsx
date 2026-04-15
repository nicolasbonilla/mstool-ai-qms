import { ReactNode } from 'react';

/* Empty State component following best practices:
   - Informative copy (assures users what should be here)
   - Action CTA (guides toward next step)
   - Visual element (icon in tinted container)

   Based on: Pencil & Paper Empty State UX Patterns,
   Mobbin Empty State UI Pattern Best Practices */

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(139,92,246,0.08))' }}>
        {icon}
      </div>

      {/* Text */}
      <h3 className="text-[16px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-[13px] max-w-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-5">
          {action && (
            <button onClick={action.onClick}
              className="text-[13px] font-semibold text-white px-5 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button onClick={secondaryAction.onClick}
              className="text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all duration-200"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
