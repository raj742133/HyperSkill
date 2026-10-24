'use client';
import type { CSSProperties, ReactNode } from 'react';

export interface StampProps {
  children?: ReactNode;
  /** Text of the postmark overlay (omit for none). */
  postmark?: string;
  /** Second line of the postmark, e.g. a date. */
  postmarkDate?: string;
  /** Size of the scallops in px. */
  perforation?: number;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

/** A postage-stamp frame with a scalloped edge around any children, plus an optional postmark. */
export default function Stamp({ children, postmark, postmarkDate, perforation = 5, className, style, 'aria-label': label }: StampProps) {
  return (
    <figure className={`ui-stamp-root ${className ?? ''}`} style={{ ['--ui-stamp-p' as string]: `${perforation}px`, ...style }} aria-label={label}>
      <div className="ui-stamp-edge"><div className="ui-stamp-inner">{children}</div></div>
      {postmark && (
        <svg className="ui-stamp-mark" viewBox="0 0 120 60" aria-hidden="true">
          <circle cx="32" cy="30" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="30" r="17" fill="none" stroke="currentColor" strokeWidth="1" />
          <text x="32" y="28" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">{postmark.toUpperCase().slice(0, 9)}</text>
          <text x="32" y="38" textAnchor="middle" fontSize="6" fill="currentColor">{postmarkDate ?? ''}</text>
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M58 ${14 + i * 11} q 12 -5 24 0 t 24 0`} fill="none" stroke="currentColor" strokeWidth="2" />)}
        </svg>
      )}
    </figure>
  );
}

export function Demo() {
  return (
    <Stamp postmark="Sitewright" postmarkDate="14 MAR" aria-label="Stamp: first class">
      <div style={{ width: 120, height: 130, display: 'grid', placeItems: 'center', textAlign: 'center', background: 'linear-gradient(160deg, var(--primary-wash, #dbeafe), var(--signal-wash, #fde68a))' }}>
        <div><div style={{ fontSize: 34, fontWeight: 700, color: 'var(--ink, #111)' }}>1st</div><div style={{ fontSize: 11, color: 'var(--ink, #111)', letterSpacing: '0.12em' }}>CLASS</div></div>
      </div>
    </Stamp>
  );
}
