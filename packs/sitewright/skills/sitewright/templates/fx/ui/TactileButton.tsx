'use client';
import { useState, type ButtonHTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

export interface TactileButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'primary' | 'neutral';
  className?: string;
  children?: ReactNode;
}

/** A physical-feeling button: a shaped face on a firm edge. It presses down on pointer and on Space/Enter, then springs back. */
export default function TactileButton({ variant = 'primary', className, children = 'Press me', onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, onKeyDown, onKeyUp, onBlur, ...rest }: TactileButtonProps) {
  const [down, setDown] = useState(false);
  const press = (e: { button?: number }) => { if (!e.button) setDown(true); };
  const release = () => setDown(false);
  return (
    <button
      type="button"
      {...rest}
      className={`ui-tactile-button${className ? ` ${className}` : ''}`}
      data-variant={variant}
      data-down={down || undefined}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => { onPointerDown?.(e); press(e); }}
      onPointerUp={(e) => { onPointerUp?.(e); release(); }}
      onPointerCancel={(e) => { onPointerCancel?.(e); release(); }}
      onPointerLeave={(e) => { onPointerLeave?.(e); release(); }}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => { onKeyDown?.(e); if (e.key === ' ' || e.key === 'Enter') setDown(true); }}
      onKeyUp={(e: KeyboardEvent<HTMLButtonElement>) => { onKeyUp?.(e); if (e.key === ' ' || e.key === 'Enter') release(); }}
      onBlur={(e) => { onBlur?.(e); release(); }}
    >
      <span className="ui-tactile-button-face">{children}</span>
    </button>
  );
}

export function Demo() {
  const [n, setN] = useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <TactileButton onClick={() => setN((v) => v + 1)}>Deploy</TactileButton>
        <TactileButton variant="neutral">Cancel</TactileButton>
      </div>
      <span aria-live="polite" style={{ font: '12px var(--font-mono, monospace)', color: 'var(--muted, #6b7280)' }}>{n ? `Deployed ${n} time${n > 1 ? 's' : ''}` : 'Click, or press Space / Enter'}</span>
    </div>
  );
}
