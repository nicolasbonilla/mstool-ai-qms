import { ExternalLink } from 'lucide-react';

interface CodeLine {
  number: number;
  text: string;
  highlighted?: boolean;
}

interface CodeBlockProps {
  lines: CodeLine[];
  language?: string;
  githubUrl?: string;
  fileName?: string;
  className?: string;
}

export default function CodeBlock({ lines, githubUrl, fileName, className = '' }: CodeBlockProps) {
  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ background: 'var(--code-bg)', border: `1px solid var(--code-border)` }}>
      {/* Header */}
      {(fileName || githubUrl) && (
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid var(--code-border)` }}>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>
            {fileName && (
              <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--text-muted)' }}>{fileName}</span>
            )}
          </div>
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noopener"
              className="text-[11px] font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-teal)' }}>
              GitHub <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {/* Code */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {lines.map((line) => (
              <tr key={line.number}
                style={{ background: line.highlighted ? 'var(--code-highlight)' : 'transparent' }}>
                <td className="text-right px-3 py-0.5 select-none w-10"
                  style={{ color: 'var(--code-line-number)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {line.number}
                </td>
                <td className="px-4 py-0.5" style={{ color: 'var(--code-text)', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre' }}>
                  {line.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
