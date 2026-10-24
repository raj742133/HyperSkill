'use client';
import { useEffect, useRef, useState } from 'react';
import { clamp, usePrefs, useActive } from './_n2';

export interface PullCordProps {
  /** Controlled state (on/off). */
  pressed?: boolean;
  defaultPressed?: boolean;
  /** Called after a successful pull with the new state. */
  onPull?: (next: boolean) => void;
  label?: string;
  /** Cord length in px. */
  length?: number;
  /** Pull distance (px) that counts as a pull. */
  threshold?: number;
  className?: string;
}

const W = 56;

/** A hanging cord with a pull handle: drag it down past the threshold and let go (or press Enter/Space on the handle). The cord stretches and swings back. */
export default function PullCord({ pressed, defaultPressed = false, onPull, label = 'Lamp', length = 84, threshold = 26, className }: PullCordProps) {
  const [inner, setInner] = useState(defaultPressed);
  const on = pressed ?? inner;
  const { reduced } = usePrefs();
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const cord = useRef<SVGPathElement>(null);
  const grip = useRef<HTMLButtonElement>(null);
  const live = useRef({ on, onPull, reduced, active });
  live.current = { on, onPull, reduced, active };
  const api = useRef<{ pull: () => void }>({ pull: () => {} });

  useEffect(() => {
    const b = grip.current, c = cord.current;
    if (!b || !c) return;
    const s = { x: 0, y: 0, vx: 0, vy: 0, drag: false, sx: 0, sy: 0, ty: 0, raf: 0 };
    const paint = () => {
      const hx = W / 2 + s.x, hy = length + s.y;
      const bow = clamp(s.x * 0.35, -9, 9) - (s.y > 0 ? 0 : 0);
      c.setAttribute('d', `M${W / 2} 0Q${(W / 2 + hx) / 2 + bow} ${hy * 0.55} ${hx} ${hy}`);
      b.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotate(${clamp(-s.x * 0.9, -25, 25).toFixed(1)}deg)`;
    };
    const loop = () => {
      if (!s.drag) {
        s.vx += -s.x * 0.12; s.vy += (s.ty - s.y) * 0.16;
        s.vx *= 0.9; s.vy *= 0.84;
        s.x += s.vx; s.y += s.vy;
        if (Math.abs(s.x) + Math.abs(s.y - s.ty) + Math.abs(s.vx) + Math.abs(s.vy) < 0.05) { s.x = 0; s.y = s.ty = 0; paint(); s.raf = 0; return; }
      }
      paint();
      s.raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (live.current.reduced || !live.current.active) { s.x = 0; s.y = s.ty = 0; paint(); } else if (!s.raf) s.raf = requestAnimationFrame(loop); };
    const fire = () => { const next = !live.current.on; setInner(next); live.current.onPull?.(next); };
    api.current.pull = () => { fire(); if (!live.current.reduced) { s.vy = 5; s.vx = 1.2; } kick(); };
    const down = (e: PointerEvent) => { s.drag = true; s.sx = e.clientX; s.sy = e.clientY; b.setPointerCapture(e.pointerId); cancelAnimationFrame(s.raf); s.raf = 0; s.vx = s.vy = 0; };
    const move = (e: PointerEvent) => {
      if (!s.drag) return;
      const dy = e.clientY - s.sy, dx = e.clientX - s.sx;
      s.y = dy < 0 ? dy * 0.1 : Math.min(dy, 70) + Math.max(0, dy - 70) * 0.1;
      s.x = clamp(dx * 0.35, -14, 14);
      s.y = clamp(s.y, -6, 90);
      if (live.current.reduced) paint(); else if (!s.raf) s.raf = requestAnimationFrame(loop);
    };
    const up = (e: PointerEvent) => {
      if (!s.drag) return;
      s.drag = false;
      if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId);
      const pulled = s.y >= threshold;
      if (pulled) fire();
      s.vy = 0; s.vx = 0;
      kick();
    };
    const click = (e: MouseEvent) => { if (e.detail === 0) api.current.pull(); };
    paint();
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointermove', move);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('click', click);
    return () => {
      cancelAnimationFrame(s.raf);
      b.removeEventListener('pointerdown', down);
      b.removeEventListener('pointermove', move);
      b.removeEventListener('pointerup', up);
      b.removeEventListener('pointercancel', up);
      b.removeEventListener('click', click);
    };
  }, [length, threshold]);

  return (
    <div ref={root} className={`ui-pull-cord${className ? ' ' + className : ''}`} style={{ width: W, height: length + 34 }}>
      <svg width={W} height={length + 34} viewBox={`0 0 ${W} ${length + 34}`} aria-hidden="true" className="ui-pull-cord-svg">
        <rect x={W / 2 - 9} y="-2" width="18" height="6" rx="2" fill="var(--line-strong, #999)" />
        <path ref={cord} d={`M${W / 2} 0L${W / 2} ${length}`} fill="none" stroke="var(--muted, #666)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <button ref={grip} type="button" role="switch" aria-checked={on} aria-label={`${label}: pull cord`} className="ui-pull-cord-grip" data-on={on ? 'true' : 'false'} style={{ left: W / 2 - 14, top: length - 2 }} />
    </div>
  );
}

export function Demo() {
  const [lit, setLit] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 30, height: 150, overflow: 'hidden' }}>
      <div style={{ width: 110, textAlign: 'center' }}>
        <svg width="110" height="108" viewBox="0 0 110 108" aria-hidden="true" style={{ display: 'block' }}>
          <defs>
            <radialGradient id="ui-pull-cord-glow" cx="50%" cy="0%" r="90%">
              <stop offset="0" stopColor="var(--signal, #f59e0b)" stopOpacity="0.6" />
              <stop offset="1" stopColor="var(--signal, #f59e0b)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M55 0V12" stroke="var(--muted, #666)" strokeWidth="2" />
          <path d="M25 42Q25 12 55 12Q85 12 85 42Z" fill="var(--raised-2, #ddd)" stroke="var(--line-strong, #999)" strokeWidth="2" />
          {lit && <path d="M25 42L0 108H110L85 42Z" fill="url(#ui-pull-cord-glow)" />}
          <circle cx="55" cy="46" r="6" fill={lit ? 'var(--signal, #f59e0b)' : 'var(--line, #ccc)'} />
        </svg>
        <p aria-live="polite" style={{ margin: '6px 0 0', fontFamily: 'var(--font-body, system-ui)', fontSize: 13, color: 'var(--muted, #555)' }}>Lamp is <strong style={{ color: 'var(--ink, #111)' }}>{lit ? 'on' : 'off'}</strong></p>
      </div>
      <PullCord pressed={lit} onPull={setLit} label="Lamp" length={72} />
    </div>
  );
}
