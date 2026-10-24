'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { clamp, useReducedMotion } from './_n1';

export interface TearButtonProps {
  label?: string;
  confirmedLabel?: string;
  onConfirm?: () => void;
  onReset?: () => void;
  className?: string;
}

const THRESHOLD = 56; // px of drag needed to tear

export default function TearButton({ label = 'Publish site', confirmedLabel = 'Confirmed', onConfirm, onReset, className = '' }: TearButtonProps) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'tearing' | 'done'>('idle');
  const [pull, setPull] = useState(0); // 0..1 while dragging
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stub = useRef<HTMLButtonElement>(null);
  const resetBtn = useRef<HTMLButtonElement>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (phase === 'done') resetBtn.current?.focus(); }, [phase]);

  const tear = () => {
    if (phase !== 'idle') return;
    setPhase('tearing'); setDragging(false); setPull(1);
    onConfirm?.();
    setMsg(`${confirmedLabel}. Stub torn off.`);
    timer.current = setTimeout(() => setPhase('done'), reduced ? 0 : 420);
  };
  const reset = () => {
    clearTimeout(timer.current);
    setPhase('idle'); setPull(0); setMsg('Reset. Ready to confirm again.');
    onReset?.();
    requestAnimationFrame(() => stub.current?.focus());
  };

  const down = (e: PointerEvent) => {
    if (phase !== 'idle' || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };
  const move = (e: PointerEvent) => {
    const s = start.current; if (!s) return;
    const d = Math.hypot(Math.max(0, e.clientX - s.x), Math.max(0, e.clientY - s.y));
    setPull(clamp(d / THRESHOLD, 0, 1));
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    if (pull >= 1) tear(); else { setDragging(false); setPull(0); }
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tear(); }
  };

  const torn = phase !== 'idle';
  const p = clamp(pull, 0, 1);
  const stubStyle = phase === 'tearing' ? undefined : { transform: `rotate(${(p * 24).toFixed(1)}deg) translate(${(p * 8).toFixed(1)}px, ${(p * 6).toFixed(1)}px)`, transition: dragging ? 'none' : undefined };

  return (
    <div className={`ui-tear-button ${className}`.trim()} data-phase={phase}>
      <div className="ui-tear-button-main" aria-live="off">
        {phase === 'done' ? (
          <>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 10.5l3.7 3.7 7.3-8" /></svg>
            <span>{confirmedLabel}</span>
            <button ref={resetBtn} type="button" className="ui-tear-button-reset" onClick={reset}>Reset</button>
          </>
        ) : (
          <span>{label}</span>
        )}
      </div>
      {phase !== 'done' && (
        <button ref={stub} type="button" className="ui-tear-button-stub" data-torn={phase === 'tearing' || undefined} style={stubStyle}
          aria-label={`${label}: tear off the stub to confirm. Press Space, or drag it down and away.`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
          onClick={(e) => { if (e.detail === 0) tear(); }}>
          <span aria-hidden="true">Tear</span>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5v8h8M3 13L13 3" /></svg>
        </button>
      )}
      {!torn && <p className="ui-tear-button-hint">Drag the stub, or press Space</p>}
      <span className="ui-tear-button-sr" role="status" aria-live="polite">{msg}</span>
    </div>
  );
}

export function Demo() {
  return <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 12 }}><TearButton /></div>;
}
