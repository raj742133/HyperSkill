'use client';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { clamp, easeInOut, useInView, useReducedMotion, useTimeline } from './_a1';

export interface TimelineStep {
  /** start time in ms */
  at: number;
  /** length in ms */
  duration: number;
  /** called every frame with local progress 0..1 */
  apply: (progress: number) => void;
}
export interface TimelineSequenceProps {
  steps?: TimelineStep[];
  /** total length in ms (defaults to the end of the last step) */
  total?: number;
  loop?: boolean;
  autoplay?: boolean;
  /** custom stage content that `steps` animate (default: four demo shapes) */
  children?: ReactNode;
  className?: string;
}

const COLORS = ['var(--primary, #2563eb)', 'var(--signal, #f59e0b)', 'var(--ok, #16a34a)', 'var(--critical, #dc2626)'];

export default function TimelineSequence({ steps, total, loop = true, autoplay = true, children, className }: TimelineSequenceProps) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, false, 0.1);
  const shapes = useRef<(HTMLDivElement | null)[]>([]);

  const demo = useMemo<TimelineStep[]>(() => {
    const el = (i: number) => shapes.current[i];
    return [
      { at: 0, duration: 800, apply: (p) => { const e = el(0); if (e) { e.style.transform = `translateX(${easeInOut(p) * 26}px) scale(${0.4 + 0.6 * p})`; e.style.opacity = String(p); } } },
      { at: 500, duration: 800, apply: (p) => { const e = el(1); if (e) { e.style.transform = `rotate(${easeInOut(p) * 180}deg) scale(${0.4 + 0.6 * p})`; e.style.opacity = String(p); } } },
      { at: 1000, duration: 800, apply: (p) => { const e = el(2); if (e) { e.style.transform = `translateY(${(1 - easeInOut(p)) * 24}px)`; e.style.opacity = String(p); } } },
      { at: 1500, duration: 800, apply: (p) => { const e = el(3); if (e) { e.style.transform = `scaleX(${0.2 + 0.8 * easeInOut(p)})`; e.style.opacity = String(p); } } },
    ];
  }, []);
  const list = steps ?? demo;
  const len = total ?? Math.max(1, ...list.map((s) => s.at + s.duration)) + (steps ? 0 : 400);

  const tl = useTimeline({ duration: len, loop, autoplay: autoplay && !reduced, active: visible, initial: 0 });
  const { seek, pause, progress } = tl;

  useEffect(() => { if (reduced) { pause(); seek(1); } }, [reduced, seek, pause]);

  useEffect(() => {
    const now = progress * len;
    for (const s of list) s.apply(clamp((now - s.at) / s.duration));
  }, [progress, len, list]);

  const ms = Math.round(progress * len);
  return (
    <div ref={root} className={`ui-timeline-sequence-root ${className ?? ''}`}>
      <div className="ui-timeline-sequence-stage">
        {children ?? [0, 1, 2, 3].map((i) => (
          <div
            key={i}
            ref={(n) => { shapes.current[i] = n; }}
            className="ui-timeline-sequence-shape"
            aria-hidden="true"
            style={{
              left: `${14 + i * 22}%`, background: COLORS[i],
              borderRadius: i === 0 ? '50%' : i === 1 ? 6 : i === 2 ? 0 : 99,
              clipPath: i === 2 ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
              height: i === 3 ? 12 : 30, marginTop: i === 3 ? -6 : -15,
            }}
          />
        ))}
      </div>
      <div className="ui-timeline-sequence-row">
        <button type="button" className="ui-timeline-sequence-btn" onClick={tl.toggle} aria-pressed={tl.playing}>{tl.playing ? 'Pause' : 'Play'}</button>
        <button type="button" className="ui-timeline-sequence-btn" onClick={tl.restart}>Restart</button>
        <input
          className="ui-timeline-sequence-range" type="range" min={0} max={1000} value={Math.round(progress * 1000)}
          aria-label="Timeline position" aria-valuetext={`${ms} milliseconds of ${len}`}
          onChange={(e) => { tl.pause(); tl.seek(Number(e.target.value) / 1000); }}
        />
        <span className="ui-timeline-sequence-time" aria-hidden="true">{ms}ms</span>
      </div>
    </div>
  );
}

export function Demo() {
  return <TimelineSequence />;
}
