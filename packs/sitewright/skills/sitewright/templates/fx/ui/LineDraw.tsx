'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useInView, useReducedMotion } from './_a1';

export interface LinePath { d: string; stroke?: string; width?: number }
export interface LineDrawProps {
  paths?: (string | LinePath)[];
  viewBox?: string;
  /** ms per path */
  duration?: number;
  /** ms between paths */
  stagger?: number;
  label?: string;
  className?: string;
}

const DEFAULT_PATHS: LinePath[] = [
  { d: 'M6 104 H234', stroke: 'var(--line-strong, #888)', width: 2 },
  { d: 'M14 104 L62 40 L84 68 L108 30 L150 104', width: 2.5 },
  { d: 'M104 104 L150 56 L178 84 L196 62 L226 104', width: 2.5 },
  { d: 'M62 40 L70 52 M108 30 L100 44', stroke: 'var(--muted, #888)', width: 1.5 },
  { d: 'M196 28 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0', stroke: 'var(--signal, #f59e0b)', width: 2.5 },
  { d: 'M196 4 V-2 M216 12 L221 8 M222 28 H228 M176 12 L171 8 M170 28 H164', stroke: 'var(--signal, #f59e0b)', width: 2 },
];

export default function LineDraw({
  paths = DEFAULT_PATHS, viewBox = '0 -8 240 120', duration = 900, stagger = 220,
  label = 'Line illustration of mountains under a sun', className,
}: LineDrawProps) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const seen = useInView(root, true);
  const anims = useRef<Animation[]>([]);

  const items = paths.map((p) => (typeof p === 'string' ? { d: p } : p) as LinePath);

  const play = useCallback(() => {
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
    if (reduced) return;
    root.current?.querySelectorAll<SVGPathElement>('path[data-draw]').forEach((el, i) => {
      el.style.strokeDashoffset = '1';
      const a = el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration, delay: i * stagger, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'backwards',
      });
      a.onfinish = () => { el.style.strokeDashoffset = '0'; };
      anims.current.push(a);
    });
  }, [reduced, duration, stagger]);

  // hide paths before first reveal (post-hydration), so no-JS / reduced motion show the finished drawing
  useEffect(() => {
    if (seen) return;
    root.current?.querySelectorAll<SVGPathElement>('path[data-draw]').forEach((el) => { el.style.strokeDashoffset = reduced ? '0' : '1'; });
  }, [reduced, seen, paths]);

  useEffect(() => {
    if (!reduced) return;
    root.current?.querySelectorAll<SVGPathElement>('path[data-draw]').forEach((el) => { el.style.strokeDashoffset = '0'; });
  }, [reduced]);

  useEffect(() => { if (seen) play(); }, [seen, play]);
  useEffect(() => () => anims.current.forEach((a) => a.cancel()), []);

  return (
    <div ref={root} className={`ui-line-draw-root ${className ?? ''}`}>
      <svg className="ui-line-draw-svg" viewBox={viewBox} role="img" aria-label={label}>
        {items.map((p, i) => (
          <path
            key={i}
            data-draw=""
            d={p.d}
            pathLength={1}
            strokeDasharray={1}
            style={{ stroke: p.stroke ?? 'var(--primary, #2563eb)', strokeWidth: p.width ?? 2.5, strokeDashoffset: 0 }}
          />
        ))}
      </svg>
      <div className="ui-line-draw-row">
        <button type="button" className="ui-line-draw-btn" onClick={play}>Replay</button>
      </div>
    </div>
  );
}

export function Demo() {
  return <LineDraw />;
}
