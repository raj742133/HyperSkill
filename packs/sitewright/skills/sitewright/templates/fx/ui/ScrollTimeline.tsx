'use client';
import { useEffect, useRef, useState } from 'react';
import { clamp, easeOutCubic, mapKeyframes, useReducedMotion } from './_a1';

export interface ScrollTimelineProps {
  title?: string;
  /** final value of the counter */
  value?: number;
  unit?: string;
  /** [start, end] scroll progress (0..1) of the four steps: title, bar, number, icon */
  steps?: [number, number][];
  className?: string;
}

const RANGES: [number, number][] = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]];

export default function ScrollTimeline({ title = 'Launch week', value = 2480, unit = 'visits', steps = RANGES, className }: ScrollTimelineProps) {
  const reduced = useReducedMotion();
  const sc = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = sc.current;
    if (!el || reduced) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      setP(max > 0 ? clamp(el.scrollTop / max) : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    el.addEventListener('scroll', onScroll, { passive: true });
    read();
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [reduced]);

  const prog = reduced ? 1 : p;
  const step = (i: number) => {
    const [a, b] = steps[i] ?? RANGES[i] as [number, number];
    return mapKeyframes(prog, [[a, 0], [b, 1]]);
  };
  const t0 = step(0), t1 = step(1), t2 = step(2), t3 = step(3);

  return (
    <div
      ref={sc}
      className={`ui-scroll-timeline-scroller ui-scroll-timeline-focus ${className ?? ''}`}
      data-static={reduced ? '1' : undefined}
      tabIndex={reduced ? undefined : 0}
      role={reduced ? undefined : 'region'}
      aria-label={reduced ? undefined : 'Scroll to play the timeline'}
    >
      <div className="ui-scroll-timeline-track">
        <div className="ui-scroll-timeline-stage">
          <h3 className="ui-scroll-timeline-title" style={{ opacity: t0, transform: `translateY(${(1 - t0) * 10}px)`, margin: 0 }}>{title}</h3>
          <div className="ui-scroll-timeline-bar" aria-hidden="true">
            <div className="ui-scroll-timeline-fill" style={{ transform: `scaleX(${easeOutCubic(t1)})` }} />
          </div>
          <p className="ui-scroll-timeline-num" aria-label={`${value} ${unit}`}>
            {Math.round(value * t2).toLocaleString('en-US')} <span style={{ fontSize: 12, color: 'var(--muted, #6b7280)', fontFamily: 'var(--font-body, system-ui)' }}>{unit}</span>
          </p>
          <svg className="ui-scroll-timeline-icon" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${t3 * 360}deg) scale(${0.6 + 0.4 * t3})`, opacity: 0.25 + 0.75 * t3 }}>
            <path d="M12 2 L14.6 9.2 L22 9.6 L16.2 14.2 L18.2 21.5 L12 17.4 L5.8 21.5 L7.8 14.2 L2 9.6 L9.4 9.2 Z" fill="currentColor" />
          </svg>
        </div>
        {!reduced && p < 0.02 && <div className="ui-scroll-timeline-hint" aria-hidden="true">Scroll down {'↓'}</div>}
      </div>
    </div>
  );
}

export function Demo() {
  return <ScrollTimeline />;
}
