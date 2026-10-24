'use client';
import { useEffect, useRef, useState } from 'react';

export type DynamicIcon = 'save' | 'spinner' | 'check' | 'error' | 'none';
export interface DynamicState {
  label: string;
  glyph?: DynamicIcon;
  /** Move on to the next state by itself after this many ms (the button ignores clicks meanwhile). */
  ms?: number;
}
export interface DynamicButtonProps {
  states?: DynamicState[];
  /** Controlled mode: show this state and let the parent decide when it changes. */
  index?: number;
  onClick?: (index: number) => void;
  className?: string;
}

const DEFAULT_STATES: DynamicState[] = [
  { label: 'Save', glyph: 'save' },
  { label: 'Saving…', glyph: 'spinner', ms: 1300 },
  { label: 'Saved', glyph: 'check', ms: 1700 },
];

function Glyph({ name }: { name: DynamicIcon }) {
  const p = { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': true, focusable: false, fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (name === 'none') return null;
  if (name === 'spinner') return <svg {...p} className="ui-dynamic-button-spin"><path d="M10 3a7 7 0 1 0 7 7" /></svg>;
  if (name === 'check') return <svg {...p} className="ui-dynamic-button-pop"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>;
  if (name === 'error') return <svg {...p} className="ui-dynamic-button-pop"><path d="M10 5v6M10 14.5v.01" /></svg>;
  return <svg {...p} className="ui-dynamic-button-pop"><path d="M4 4h9l3 3v9H4zM7 4v4h5V4M7 16v-4h6v4" /></svg>;
}

/** A button whose width follows its label as it moves through states (Save, Saving…, Saved), with an inline icon swap. */
export default function DynamicButton({ states = DEFAULT_STATES, index, onClick, className }: DynamicButtonProps) {
  const [own, setOwn] = useState(0);
  const controlled = index !== undefined;
  const i = Math.max(0, Math.min(states.length - 1, controlled ? index : own));
  const st = states[i] ?? { label: '' };
  const inner = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState<number>();

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setW(el.offsetWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [i, st.label, st.glyph]);

  useEffect(() => {
    if (controlled || !st.ms) return;
    const id = window.setTimeout(() => setOwn((v) => (v + 1) % states.length), st.ms);
    return () => window.clearTimeout(id);
  }, [controlled, st.ms, i, states.length]);

  const busy = !!st.ms && !controlled;
  return (
    <span className="ui-dynamic-button-wrap">
    <button
      type="button"
      className={`ui-dynamic-button${className ? ` ${className}` : ''}`}
      style={w ? { width: w + 40 } : undefined}
      aria-disabled={busy || undefined}
      aria-busy={st.glyph === 'spinner' || undefined}
      onClick={() => { if (busy) return; onClick?.(i); if (!controlled) setOwn((v) => (v + 1) % states.length); }}
    >
      <span className="ui-dynamic-button-inner" ref={inner} key={i}>
        <Glyph name={st.glyph ?? 'none'} />
        <span>{st.label}</span>
      </span>
    </button>
    <span className="ui-dynamic-button-sr" role="status" aria-live="polite">{st.label}</span>
    </span>
  );
}

export function Demo() {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
      <DynamicButton />
      <span style={{ font: '12px var(--font-mono, monospace)', color: 'var(--muted, #475569)' }}>Click to save</span>
    </div>
  );
}
