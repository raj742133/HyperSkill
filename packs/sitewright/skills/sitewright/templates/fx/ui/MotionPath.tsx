'use client';
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion, useTimeline } from './_a1';

export interface MotionPathProps {
  /** SVG path data the element travels along */
  d?: string;
  viewBox?: string;
  /** ms for one lap */
  duration?: number;
  autoplay?: boolean;
  className?: string;
}

const PATH = 'M12 82 C50 8 86 8 120 52 S190 100 228 28';

export default function MotionPath({ d = PATH, viewBox = '0 0 240 100', duration = 4200, autoplay = true, className }: MotionPathProps) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const pathEl = useRef<SVGPathElement>(null);
  const visible = useInView(root, false, 0.1);
  const tl = useTimeline({ duration, loop: true, autoplay, active: visible });
  const [pose, setPose] = useState<{ x: number; y: number; a: number } | null>(null);

  useEffect(() => { if (reduced) tl.pause(); }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = tl.progress;
  useEffect(() => {
    const p = pathEl.current;
    if (!p) return;
    const len = p.getTotalLength();
    const at = t * len;
    const a = p.getPointAtLength(Math.max(0, at - 1));
    const b = p.getPointAtLength(Math.min(len, at + 1));
    const c = p.getPointAtLength(at);
    setPose({ x: c.x, y: c.y, a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI });
  }, [t, d]);

  const trail = (len: number, opacity: number, w: number) => (
    <path d={d} pathLength={1} fill="none" stroke="var(--signal, #f59e0b)" strokeWidth={w} strokeLinecap="round" strokeOpacity={opacity}
      strokeDasharray={`${len} 1`} strokeDashoffset={-(t - len)} />
  );

  return (
    <div ref={root} className={`ui-motion-path-root ${className ?? ''}`}>
      <svg className="ui-motion-path-svg" viewBox={viewBox} role="img" aria-label={`Rocket following a curved path, ${Math.round(t * 100)} percent along`}>
        <path ref={pathEl} d={d} fill="none" stroke="var(--line-strong, #888)" strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
        {trail(0.24, 0.25, 4)}
        {trail(0.14, 0.5, 4)}
        {trail(0.06, 0.9, 4)}
        {pose && (
          <g transform={`translate(${pose.x} ${pose.y}) rotate(${pose.a})`}>
            <path d="M9 0 L-6 -6 L-3 0 L-6 6 Z" fill="var(--primary, #2563eb)" stroke="var(--ink, #111)" strokeWidth={1} strokeLinejoin="round" />
          </g>
        )}
      </svg>
      <div className="ui-motion-path-row">
        <button type="button" className="ui-motion-path-btn" onClick={tl.toggle} aria-pressed={tl.playing}>{tl.playing ? 'Pause' : 'Play'}</button>
        <input
          className="ui-motion-path-range"
          type="range" min={0} max={1000} value={Math.round(t * 1000)}
          aria-label="Position along path"
          onChange={(e) => { tl.pause(); tl.seek(Number(e.target.value) / 1000); }}
        />
      </div>
    </div>
  );
}

export function Demo() {
  return <MotionPath />;
}
