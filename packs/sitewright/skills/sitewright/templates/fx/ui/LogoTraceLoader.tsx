'use client';
import type { CSSProperties } from 'react';

export interface LogoTraceLoaderProps {
  /** SVG path `d` of the mark (filled with even-odd). Default: an original geometric mark. */
  path?: string;
  viewBox?: string;
  /** Repeat forever (true) or trace once and stay filled (false). */
  loop?: boolean;
  /** Seconds per cycle. */
  duration?: number;
  size?: number;
  label?: string;
  className?: string;
}

const MARK = 'M32 4 L57 18 V46 L32 60 L7 46 V18 Z M32 18 L45 32 L32 46 L19 32 Z';

/** Traces a mark's outline, then fills it in. Reduced motion shows the filled mark. */
export default function LogoTraceLoader({ path = MARK, viewBox = '0 0 64 64', loop = true, duration = 2.6, size = 72, label = 'Loading', className }: LogoTraceLoaderProps) {
  const style = { width: size, height: size, ['--ui-ltl-d' as string]: `${duration}s` } as CSSProperties;
  return (
    <span role="status" aria-label={label} className={`ui-logo-trace-loader-root ${className ?? ''}`} data-loop={loop} style={style}>
      <svg viewBox={viewBox} aria-hidden="true" focusable="false" className="ui-logo-trace-loader-svg">
        <path d={path} fillRule="evenodd" className="ui-logo-trace-loader-fill" />
        <path d={path} pathLength={1} className="ui-logo-trace-loader-line" fill="none" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Demo() { return <LogoTraceLoader />; }
