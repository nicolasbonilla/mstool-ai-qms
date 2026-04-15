import { useEffect, useState } from 'react';

interface RingProps {
  value: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export default function Ring({ value, color, size = 130, strokeWidth = 10, label, sublabel }: RingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (animatedValue / 100) * c;
  const mid = size / 2;

  useEffect(() => {
    let frame: number, start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1400, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setAnimatedValue(Math.round(ease * value * 10) / 10);
      if (p < 1) frame = requestAnimationFrame(step);
      else setAnimatedValue(value);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 12px ${color}40)` }}>
          <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={c} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[24px] font-extrabold text-white tracking-tight">{animatedValue}%</span>
        </div>
      </div>
      {label && <p className="text-[13px] font-bold text-white/90 mt-3">{label}</p>}
      {sublabel && <p className="text-[10px] text-white/30 mt-0.5">{sublabel}</p>}
    </div>
  );
}
