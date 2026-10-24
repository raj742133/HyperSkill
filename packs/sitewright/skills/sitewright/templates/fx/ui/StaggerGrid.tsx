'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { stagger, useReducedMotion, type StaggerFrom } from './_a1';

export interface StaggerGridProps {
  rows?: number;
  cols?: number;
  /** wave origin: 'center' | 'first' (top-left) | 'last' (bottom-right) | cell index */
  from?: StaggerFrom;
  /** ms of delay per grid step */
  each?: number;
  duration?: number;
  /** custom cell content; receives index, row, col and normalised distance 0..1 from the origin */
  renderCell?: (i: number, info: { row: number; col: number; dist: number }) => ReactNode;
  /** clicking a cell replays the wave from that cell */
  clickToReplay?: boolean;
  className?: string;
}

export default function StaggerGrid({
  rows = 5, cols = 12, from = 'center', each = 45, duration = 520, renderCell, clickToReplay = true, className,
}: StaggerGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [origin, setOrigin] = useState<StaggerFrom>(from);
  const [run, setRun] = useState(0);
  const count = rows * cols;

  useEffect(() => setOrigin(from), [from]);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const delays = stagger(count, { each, from: origin, grid: [rows, cols] });
    const anims = Array.from(el.children).map((c, i) =>
      (c as HTMLElement).animate(
        [{ opacity: 0, transform: 'scale(0.2)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration, delay: delays[i] ?? 0, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' },
      ),
    );
    return () => anims.forEach((a) => a.cancel());
  }, [run, origin, count, rows, cols, each, duration, reduced]);

  const replay = useCallback(() => setRun((n) => n + 1), []);
  const delays = stagger(count, { each: 1, from: origin, grid: [rows, cols] });
  const max = Math.max(1, ...delays);

  return (
    <div className={`ui-stagger-grid-root ${className ?? ''}`}>
      <div
        ref={ref}
        className="ui-stagger-grid-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        onClick={(e) => {
          if (!clickToReplay) return;
          const idx = Array.prototype.indexOf.call(ref.current?.children ?? [], e.target);
          if (idx >= 0) setOrigin(idx);
          replay();
        }}
      >
        {Array.from({ length: count }, (_, i) => {
          const dist = (delays[i] ?? 0) / max;
          return renderCell ? (
            <div key={i}>{renderCell(i, { row: Math.floor(i / cols), col: i % cols, dist })}</div>
          ) : (
            <div
              key={i}
              className="ui-stagger-grid-cell"
              style={{ opacity: 0.35 + 0.65 * (1 - dist), background: `color-mix(in srgb, var(--primary, #2563eb) ${Math.round(100 - dist * 55)}%, var(--signal, #f59e0b))` }}
            />
          );
        })}
      </div>
      <div className="ui-stagger-grid-row">
        <button type="button" className="ui-stagger-grid-btn" onClick={() => { setOrigin(from); replay(); }}>Replay</button>
        <span style={{ fontSize: 11, color: 'var(--muted, #6b7280)' }}>or click a cell</span>
      </div>
    </div>
  );
}

export function Demo() {
  return <StaggerGrid rows={5} cols={12} />;
}
