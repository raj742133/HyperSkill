'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './_n1';

export interface ActivityRing { label: string; value: number; goal: number; color?: string; unit?: string }
export interface ActivityRingsProps { rings?: ActivityRing[]; title?: string; className?: string }

const DEFAULT_RINGS: ActivityRing[] = [
  { label: 'Move', value: 420, goal: 600, unit: 'kcal', color: 'var(--critical, #e11d48)' },
  { label: 'Exercise', value: 22, goal: 30, unit: 'min', color: 'var(--ok, #16a34a)' },
  { label: 'Stand', value: 9, goal: 12, unit: 'h', color: 'var(--primary, #2563eb)' },
];
const FALLBACK = ['var(--primary, #2563eb)', 'var(--signal, #f59e0b)', 'var(--ok, #16a34a)', 'var(--critical, #e11d48)'];

export default function ActivityRings({ rings = DEFAULT_RINGS, title = 'Daily activity', className = '' }: ActivityRingsProps) {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const play = useCallback(() => {
    clearTimeout(timer.current);
    setOn(false);
    timer.current = setTimeout(() => setOn(true), 80);
  }, []);
  useEffect(() => {
    if (reduced) { clearTimeout(timer.current); setOn(true); return; }
    play();
    return () => clearTimeout(timer.current);
  }, [reduced, play]);

  const list = rings.slice(0, 5);
  const summary = list.map((r) => `${r.label} ${r.value} of ${r.goal}${r.unit ? ' ' + r.unit : ''}`).join(', ');
  return (
    <figure className={`ui-activity-rings ${className}`.trim()}>
      <svg className="ui-activity-rings-svg" viewBox="0 0 120 120" role="img" aria-label={`${title}: ${summary}`}>
        {list.map((r, i) => {
          const rad = Math.max(8, 52 - i * 12);
          const c = 2 * Math.PI * rad;
          const pct = r.goal > 0 ? Math.min(1, Math.max(0, r.value / r.goal)) : 0;
          const color = r.color ?? FALLBACK[i % FALLBACK.length];
          const len = on ? pct * c : 0;
          const tr = reduced ? 'none' : `stroke-dasharray 1.1s var(--ease, cubic-bezier(.2,.7,.2,1)) ${i * 140}ms, opacity .2s ${i * 140}ms`;
          return (
            <g key={r.label + i} transform="rotate(-90 60 60)">
              <circle cx="60" cy="60" r={rad} fill="none" stroke={color} strokeOpacity="0.2" strokeWidth="9" />
              <circle cx="60" cy="60" r={rad} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${len.toFixed(2)} ${c.toFixed(2)}`} style={{ transition: tr, opacity: on && pct > 0 ? 1 : 0 }} />
            </g>
          );
        })}
      </svg>
      <figcaption className="ui-activity-rings-side">
        <ul className="ui-activity-rings-legend">
          {list.map((r, i) => (
            <li key={r.label + i}>
              <span className="ui-activity-rings-dot" style={{ background: r.color ?? FALLBACK[i % FALLBACK.length] }} aria-hidden="true" />
              <span className="ui-activity-rings-name">{r.label}</span>
              <span className="ui-activity-rings-val">{r.value}<span>/{r.goal}{r.unit ? ` ${r.unit}` : ''}</span></span>
            </li>
          ))}
        </ul>
        {!reduced && <button type="button" className="ui-activity-rings-replay" onClick={play} aria-label="Replay ring animation">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13 2.5v3h-3" /></svg>
          Replay
        </button>}
      </figcaption>
    </figure>
  );
}

export function Demo() {
  return <div style={{ padding: 12 }}><ActivityRings /></div>;
}
