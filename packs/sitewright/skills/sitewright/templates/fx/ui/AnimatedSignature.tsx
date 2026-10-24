'use client';
import { useState, type KeyboardEvent } from 'react';

export interface AnimatedSignatureProps {
  /** SVG path `d` in a 0 0 240 90 box. Default is a hand-authored original flourish. */
  path?: string;
  viewBox?: string;
  /** Draw time in seconds. */
  duration?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

/** One continuous pen stroke: loops, a cross-bar and a long underline. */
export const DEFAULT_SIGNATURE = 'M14 62 C22 30 34 14 40 20 C47 28 26 66 30 68 C36 70 50 40 58 42 C64 44 52 62 58 62 C68 62 74 44 80 46 C86 48 78 62 86 62 C98 62 100 30 108 28 C114 27 110 40 106 52 C104 60 112 64 122 54 C132 44 134 36 140 40 C146 44 134 64 146 60 C158 56 166 36 172 36 C178 38 168 60 180 58 C192 56 204 44 214 38 M20 76 C70 70 150 72 226 66';

/** A signature that draws itself on mount (stroke-dashoffset); click or Enter/Space replays it. */
export default function AnimatedSignature({ path = DEFAULT_SIGNATURE, viewBox = '0 0 240 90', duration = 2.4, strokeWidth = 2.5, label = 'Signature', className }: AnimatedSignatureProps) {
  const [run, setRun] = useState(0);
  const replay = () => setRun((n) => n + 1);
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replay(); } };
  return (
    <button type="button" className={`ui-animated-signature-root ${className ?? ''}`} onClick={replay} onKeyDown={key} aria-label={`${label}. Press to replay the drawing`}>
      <svg viewBox={viewBox} role="img" aria-hidden="true" focusable="false" className="ui-animated-signature-svg">
        <path key={run} d={path} pathLength={1} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="ui-animated-signature-path" style={{ animationDuration: `${duration}s` }} />
      </svg>
    </button>
  );
}

export function Demo() { return <AnimatedSignature />; }
