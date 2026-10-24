'use client';
import { useEffect, useRef, useState } from 'react';
import { SHAPES, easeInOut, mixPoints, toPath, useInView, useReducedMotion, type Pt } from './_a1';

export interface ShapeMorphProps {
  /** shapes to cycle through (each normalised to the same point count); default circle, star, heart */
  shapes?: { name: string; points: Pt[] }[];
  autoCycle?: boolean;
  /** ms between automatic morphs */
  interval?: number;
  /** ms morph duration */
  duration?: number;
  className?: string;
}

const DEFAULTS = (Object.keys(SHAPES) as (keyof typeof SHAPES)[]).map((name) => ({ name, points: SHAPES[name] }));

export default function ShapeMorph({ shapes = DEFAULTS, autoCycle = true, interval = 2200, duration = 700, className }: ShapeMorphProps) {
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const visible = useInView(wrap);
  const [idx, setIdx] = useState(0);
  const [d, setD] = useState(() => toPath((shapes[0] as { points: Pt[] }).points));
  const cur = useRef<Pt[]>((shapes[0] as { points: Pt[] }).points);
  const raf = useRef(0);

  useEffect(() => {
    const target = (shapes[idx] as { points: Pt[] }).points;
    cancelAnimationFrame(raf.current);
    if (reduced) { cur.current = target; setD(toPath(target)); return; }
    const from = cur.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const pts = mixPoints(from, target, easeInOut(t));
      cur.current = pts;
      setD(toPath(pts));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [idx, shapes, duration, reduced]);

  useEffect(() => {
    if (!autoCycle || reduced || !visible) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % shapes.length), interval);
    return () => window.clearInterval(id);
  }, [autoCycle, reduced, visible, interval, shapes.length]);

  const next = shapes[(idx + 1) % shapes.length]?.name ?? '';
  return (
    <div ref={wrap} className={`ui-shape-morph-root ${className ?? ''}`} style={{ alignItems: 'center' }}>
      <button
        type="button"
        className="ui-shape-morph-stage ui-shape-morph-focus"
        aria-label={`Morph shape, currently ${shapes[idx]?.name}. Activate to morph to ${next}`}
        onClick={() => setIdx((i) => (i + 1) % shapes.length)}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <path d={d} fill="var(--primary, #2563eb)" fillOpacity={0.85} stroke="var(--signal, #f59e0b)" strokeWidth={3} strokeLinejoin="round" />
        </svg>
      </button>
      <span className="ui-shape-morph-sr" role="status" aria-live="polite">{shapes[idx]?.name}</span>
      <span style={{ fontSize: 11, color: 'var(--muted, #6b7280)' }}>{shapes[idx]?.name} (click to morph)</span>
    </div>
  );
}

export function Demo() {
  return <ShapeMorph />;
}
