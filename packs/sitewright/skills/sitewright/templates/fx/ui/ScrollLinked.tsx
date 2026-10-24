'use client';
import { useRef } from 'react';
import { useReducedMotion, useScrollProgress } from './_m1';

export interface ScrollLinkedProps {
  /** height of the scrollable stage in px */
  height?: number;
  /** paragraphs shown inside the stage */
  paragraphs?: string[];
  className?: string;
}

const DEFAULT = [
  'Scroll this panel. The bar, the number and the shapes behind the text are all tied to the scroll position.',
  'Each value is read from scrollTop on a rAF-throttled scroll listener, so nothing runs while you are still.',
  'The back layer moves slower than the text. That difference in speed is the parallax.',
  'With reduced motion on, the bar and number still report progress but nothing drifts.',
  'You have reached the end of the stage.',
];

export default function ScrollLinked({ height = 150, paragraphs = DEFAULT, className }: ScrollLinkedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);
  const reduced = useReducedMotion();
  const pct = Math.round(p * 100);
  const drift = reduced ? 0 : -p * 46;
  return (
    <div className={`ui-scroll-linked-root${className ? ' ' + className : ''}`} style={{ height }}>
      <div className="ui-scroll-linked-head">
        <div className="ui-scroll-linked-bar" role="progressbar" aria-label="Scroll progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span className="ui-scroll-linked-fill" style={{ transform: `scaleX(${p})` }} />
        </div>
        <output className="ui-scroll-linked-num" aria-hidden="true">{pct}%</output>
      </div>
      <div ref={ref} className="ui-scroll-linked-scroller" tabIndex={0} role="region" aria-label="Scrollable content">
        <div className="ui-scroll-linked-track">
          <div className="ui-scroll-linked-layer" aria-hidden="true" style={{ height: Math.max(60, height - 30) }}>
            <span className="ui-scroll-linked-shape ui-scroll-linked-s1" style={{ transform: `translateY(${drift * 1.6}px) rotate(${reduced ? 0 : p * 90}deg)` }} />
            <span className="ui-scroll-linked-shape ui-scroll-linked-s2" style={{ transform: `translateY(${drift}px)` }} />
          </div>
          <div className="ui-scroll-linked-text" style={{ marginTop: -Math.max(60, height - 30) }}>
            {paragraphs.map((t, i) => (<p key={i}>{t}</p>))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Demo() {
  return <ScrollLinked />;
}
