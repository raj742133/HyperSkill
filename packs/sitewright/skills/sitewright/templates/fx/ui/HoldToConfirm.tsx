'use client';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface HoldToConfirmProps {
  label?: string;
  /** What the action is called in the status messages, e.g. "Delete project". */
  actionName?: string;
  holdMs?: number;
  undoMs?: number;
  /** Fires the moment the hold reaches 100%. */
  onConfirm?: () => void;
  /** Fires when the undo window ran out without Undo being used. */
  onFinalize?: () => void;
  onUndo?: () => void;
  onCancel?: () => void;
  /** Return to idle this long after finalising; 0 keeps the finished state. */
  resetMs?: number;
}

type Phase = 'idle' | 'holding' | 'undo' | 'done';

/** Hold (pointer, or Space/Enter) to fill the button. At 100% it confirms, then offers a timed Undo before finalising. */
export default function HoldToConfirm({ label = 'Hold to delete', actionName = 'Delete', holdMs = 1100, undoMs = 5000, onConfirm, onFinalize, onUndo, onCancel, resetMs = 2500 }: HoldToConfirmProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(undoMs);
  const [msg, setMsg] = useState('');
  const hint = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const undoBtn = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);
  const holding = useRef(false);
  const cb = useRef({ onConfirm, onFinalize, onUndo, onCancel });
  cb.current = { onConfirm, onFinalize, onUndo, onCancel };

  const setFill = (p: number) => btn.current?.style.setProperty('--ui-hold-to-confirm-p', String(p));

  const stop = useCallback((cancelled: boolean) => {
    if (!holding.current) return;
    holding.current = false;
    cancelAnimationFrame(raf.current);
    setFill(0);
    setPhase('idle');
    if (cancelled) { setMsg(`${actionName} cancelled. Hold longer to confirm.`); cb.current.onCancel?.(); }
  }, [actionName]);

  const start = useCallback(() => {
    if (holding.current) return;
    holding.current = true;
    setPhase('holding');
    setMsg(`Holding to ${actionName.toLowerCase()}. Keep holding.`);
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / holdMs);
      setFill(p);
      if (p < 1) { raf.current = requestAnimationFrame(step); return; }
      holding.current = false;
      setLeft(undoMs);
      setPhase('undo');
      setMsg(`${actionName} confirmed. Undo is available for ${Math.round(undoMs / 1000)} seconds.`);
      cb.current.onConfirm?.();
    };
    raf.current = requestAnimationFrame(step);
  }, [actionName, holdMs, undoMs]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    if (phase !== 'undo') return;
    undoBtn.current?.focus();
    const end = performance.now() + undoMs;
    const id = window.setInterval(() => {
      const r = end - performance.now();
      if (r > 0) { setLeft(r); return; }
      window.clearInterval(id);
      setPhase('done');
      setMsg(`${actionName} finished.`);
      cb.current.onFinalize?.();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, undoMs, actionName]);

  useEffect(() => {
    if (phase !== 'done' || !resetMs) return;
    const id = window.setTimeout(() => { setFill(0); setPhase('idle'); setMsg(''); }, resetMs);
    return () => window.clearTimeout(id);
  }, [phase, resetMs]);

  const undo = () => { setFill(0); setPhase('idle'); setMsg(`${actionName} undone.`); cb.current.onUndo?.(); window.setTimeout(() => btn.current?.focus(), 0); };
  const isKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
  const showBtn = phase === 'idle' || phase === 'holding';

  return (
    <div className="ui-hold-to-confirm" data-phase={phase}>
      <button
        ref={btn}
        type="button"
        className="ui-hold-to-confirm-btn"
        hidden={!showBtn}
        aria-describedby={hint}
        onPointerDown={(e) => { if (e.button === 0) { e.currentTarget.setPointerCapture?.(e.pointerId); start(); } }}
        onPointerUp={() => stop(true)}
        onPointerCancel={() => stop(true)}
        onKeyDown={(e) => { if (isKey(e)) { e.preventDefault(); if (!e.repeat) start(); } }}
        onKeyUp={(e) => { if (isKey(e)) { e.preventDefault(); stop(true); } }}
        onBlur={() => stop(true)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span>{label}</span>
        <span className="ui-hold-to-confirm-fill" aria-hidden="true">{label}</span>
      </button>
      {phase === 'undo' && (
        <div className="ui-hold-to-confirm-undo">
          <span>{actionName} in {Math.ceil(left / 1000)}s</span>
          <button ref={undoBtn} type="button" className="ui-hold-to-confirm-undo-btn" onClick={undo}>Undo</button>
          <span className="ui-hold-to-confirm-count" aria-hidden="true" style={{ transform: `scaleX(${Math.max(0, left / undoMs)})` }} />
        </div>
      )}
      {phase === 'done' && <div className="ui-hold-to-confirm-undo ui-hold-to-confirm-done">{actionName} complete</div>}
      <span id={hint} className="ui-hold-to-confirm-sr">Press and hold with the pointer, or hold Space or Enter.</span>
      <span className="ui-hold-to-confirm-sr" role="status" aria-live="polite">{msg}</span>
    </div>
  );
}

export function Demo() {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
      <HoldToConfirm label="Hold to delete" actionName="Delete project" undoMs={4000} />
      <span style={{ font: '12px var(--font-mono, monospace)', color: 'var(--muted, #475569)' }}>Hold the button, or hold Space</span>
    </div>
  );
}
