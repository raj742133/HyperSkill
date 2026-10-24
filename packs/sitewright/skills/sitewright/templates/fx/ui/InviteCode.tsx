'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { copyText, makeCode, scrambleFrame, useReducedMotion } from './_k2';

export interface InviteCodeProps {
  /** Code shown first (fixed so server and client render the same). */
  initial?: string;
  /** Produce the next code; default is a pseudo-random one. Called from the click handler. */
  onRegenerate?: (current: string) => string;
  label?: string;
  className?: string;
}

/** An invite/token field with a Regenerate button (the code scrambles, then settles) and a Copy button. */
export default function InviteCode({ initial = '7K4F-2Q9M-X8NV', onRegenerate, label = 'Invite code', className }: InviteCodeProps) {
  const [code, setCode] = useState(initial);
  const [shown, setShown] = useState(initial);
  const [copied, setCopied] = useState(false);
  const reduced = useReducedMotion();
  const lbl = useId();
  const timers = useRef<{ iv?: number; copy?: number }>({});
  useEffect(() => { const t = timers.current; return () => { window.clearInterval(t.iv); window.clearTimeout(t.copy); }; }, []);
  const regenerate = useCallback(() => {
    const next = onRegenerate ? onRegenerate(code) : makeCode();
    setCode(next); setCopied(false);
    window.clearInterval(timers.current.iv);
    if (reduced) { setShown(next); return; }
    let step = 0;
    timers.current.iv = window.setInterval(() => {
      step += 1;
      setShown(scrambleFrame(next, Math.floor(step / 2)));
      if (step / 2 >= next.length) { window.clearInterval(timers.current.iv); setShown(next); }
    }, 45);
  }, [code, onRegenerate, reduced]);
  const copy = async () => {
    const ok = await copyText(code);
    setCopied(ok);
    window.clearTimeout(timers.current.copy);
    if (ok) timers.current.copy = window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className={`ui-invite-code-root ${className ?? ''}`}>
      <span className="ui-invite-code-label" id={lbl}>{label}</span>
      <input className="ui-invite-code-field" readOnly value={shown} aria-labelledby={lbl} spellCheck={false} onFocus={(e) => e.currentTarget.select()} />
      <span className="ui-invite-code-actions">
        <button type="button" className="ui-invite-code-btn" onClick={regenerate}>Regenerate</button>
        <button type="button" className="ui-invite-code-btn" data-primary="true" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </span>
      <span className="ui-invite-code-sr" role="status" aria-live="polite">{copied ? 'Copied to clipboard' : `${label} ${code.split('').join(' ')}`}</span>
    </div>
  );
}

export function Demo() { return <InviteCode />; }
