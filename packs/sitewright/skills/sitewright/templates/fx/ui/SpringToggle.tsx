'use client';
import { useEffect, useRef, useState } from 'react';
import { clamp, useSpringValue, useSpring, type SpringConfig } from './_m1';

export interface SpringToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  variant?: 'switch' | 'checkbox';
  disabled?: boolean;
  className?: string;
}

const SW: SpringConfig = { stiffness: 520, damping: 24, mass: 1, precision: 0.05 };
const CB: SpringConfig = { stiffness: 420, damping: 16, mass: 1, precision: 0.002 };
const TRAVEL = 20;

function useChecked(p: Pick<SpringToggleProps, 'checked' | 'defaultChecked' | 'onChange'>) {
  const [inner, setInner] = useState(!!p.defaultChecked);
  const on = p.checked ?? inner;
  const set = (v: boolean) => { if (p.checked === undefined) setInner(v); p.onChange?.(v); };
  return [on, set] as const;
}

export function SpringSwitch(p: SpringToggleProps) {
  const [on, set] = useChecked(p);
  const [down, setDown] = useState(false);
  const [x, api] = useSpringValue(on ? TRAVEL : 0, SW);
  // drive the spring from render state changes
  useEffectOnce(on, (v) => api.to(v ? TRAVEL : 0));
  const v = Math.abs(api.velocity());
  const stretch = 1 + clamp(v / 1400, 0, 0.4) + (down ? 0.18 : 0);
  const squash = 1 - clamp(v / 4000, 0, 0.12);
  return (
    <button type="button" role="switch" aria-checked={on} disabled={p.disabled} className={`ui-spring-toggle-row${p.className ? ' ' + p.className : ''}`}
      onClick={() => set(!on)} onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)} onPointerLeave={() => setDown(false)} onPointerCancel={() => setDown(false)}>
      <span className="ui-spring-toggle-track" data-on={on || undefined}>
        <span className="ui-spring-toggle-thumb" style={{ transform: `translateX(${x}px) scale(${stretch}, ${squash})`, transformOrigin: on ? '100% 50%' : '0 50%' }} />
      </span>
      <span className="ui-spring-toggle-text">{p.label ?? 'Notifications'}</span>
    </button>
  );
}

export function SpringCheckbox(p: SpringToggleProps) {
  const [on, set] = useChecked(p);
  const k = useSpring(on ? 1 : 0, CB);
  return (
    <label className={`ui-spring-toggle-row${p.className ? ' ' + p.className : ''}`} data-disabled={p.disabled || undefined}>
      <input type="checkbox" className="ui-spring-toggle-input" checked={on} disabled={p.disabled} onChange={(e) => set(e.target.checked)} />
      <span className="ui-spring-toggle-box" style={{ transform: `scale(${1 - 0.18 * Math.sin(Math.PI * clamp(k, 0, 1)) + (k > 1 ? (k - 1) * 0.6 : 0)})` }}>
        <span className="ui-spring-toggle-fill" style={{ opacity: clamp(k * 1.4, 0, 1) }} />
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="var(--on-primary, #fff)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp(k, 0, 1)} />
        </svg>
      </span>
      <span className="ui-spring-toggle-text">{p.label ?? 'Remember me'}</span>
    </label>
  );
}

export default function SpringToggle(p: SpringToggleProps) {
  return p.variant === 'checkbox' ? <SpringCheckbox {...p} /> : <SpringSwitch {...p} />;
}

export function Demo() {
  return (
    <div className="ui-spring-toggle-demo">
      <SpringSwitch label="Notifications" defaultChecked />
      <SpringSwitch label="Dark mode" />
      <SpringCheckbox label="Remember me" defaultChecked />
    </div>
  );
}

/** run `fn` when `value` changes (not on first render) */
function useEffectOnce<T>(value: T, fn: (v: T) => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fn(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}
