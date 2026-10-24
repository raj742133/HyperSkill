'use client';
import { useCallback, useEffect, useRef } from 'react';
import { clamp, useReducedMotion } from './_a1';

export interface DraggableSpringProps {
  /** snap grid size in px (0 = free) */
  snap?: number;
  /** 0..1 energy kept when bouncing off an edge */
  bounce?: number;
  /** momentum decay per second (higher = stops sooner) */
  friction?: number;
  label?: string;
  className?: string;
}

export default function DraggableSpring({ snap = 0, bounce = 0.6, friction = 3, label = '✦', className }: DraggableSpringProps) {
  const box = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const drag = useRef<{ id: number; ox: number; oy: number; sx: number; sy: number; hist: { t: number; x: number; y: number }[] } | null>(null);

  const bounds = () => {
    const b = box.current, c = card.current;
    if (!b || !c) return { mx: 0, my: 0 };
    return { mx: Math.max(0, (b.clientWidth - c.offsetWidth) / 2), my: Math.max(0, (b.clientHeight - c.offsetHeight) / 2) };
  };
  const paint = () => {
    if (card.current) card.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
  };
  const stop = () => { cancelAnimationFrame(raf.current); raf.current = 0; };
  const snapTo = (v: number, m: number) => clamp(snap > 0 ? Math.round(v / snap) * snap : v, -m, m);

  const launch = useCallback(() => {
    stop();
    const { mx, my } = bounds();
    if (reduced) { pos.current = { x: snapTo(pos.current.x, mx), y: snapTo(pos.current.y, my) }; paint(); return; }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const { mx, my } = bounds();
      const p = pos.current, v = vel.current;
      const speed = Math.hypot(v.x, v.y);
      if (snap > 0 && speed < 220) {
        // critically damped spring toward the nearest grid point
        const tx = snapTo(p.x, mx), ty = snapTo(p.y, my), k = 260, c = 2 * Math.sqrt(k);
        v.x += ((tx - p.x) * k - v.x * c) * dt;
        v.y += ((ty - p.y) * k - v.y * c) * dt;
      } else {
        const f = Math.exp(-friction * dt);
        v.x *= f; v.y *= f;
      }
      p.x += v.x * dt; p.y += v.y * dt;
      if (p.x > mx) { p.x = mx; v.x = -v.x * bounce; } else if (p.x < -mx) { p.x = -mx; v.x = -v.x * bounce; }
      if (p.y > my) { p.y = my; v.y = -v.y * bounce; } else if (p.y < -my) { p.y = -my; v.y = -v.y * bounce; }
      paint();
      const settled = snap > 0
        ? Math.abs(snapTo(p.x, mx) - p.x) < 0.3 && Math.abs(snapTo(p.y, my) - p.y) < 0.3 && speed < 6
        : speed < 8;
      if (settled) { if (snap > 0) { p.x = snapTo(p.x, mx); p.y = snapTo(p.y, my); paint(); } vel.current = { x: 0, y: 0 }; raf.current = 0; return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [bounce, friction, snap, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => stop, []);

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY, sx: pos.current.x, sy: pos.current.y, hist: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] };
    e.currentTarget.dataset.drag = '1';
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const { mx, my } = bounds();
    pos.current = { x: clamp(d.sx + e.clientX - d.ox, -mx, mx), y: clamp(d.sy + e.clientY - d.oy, -my, my) };
    d.hist.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    while (d.hist.length > 2 && e.timeStamp - (d.hist[0] as { t: number }).t > 90) d.hist.shift();
    paint();
  };
  const onUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    delete e.currentTarget.dataset.drag;
    const a = d.hist[0] as { t: number; x: number; y: number };
    const dt = Math.max(16, e.timeStamp - a.t) / 1000;
    const fresh = e.timeStamp - a.t < 120;
    vel.current = fresh && e.type === 'pointerup' ? { x: clamp((e.clientX - a.x) / dt, -2500, 2500), y: clamp((e.clientY - a.y) / dt, -2500, 2500) } : { x: 0, y: 0 };
    launch();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = (snap || 14) * (e.shiftKey ? 3 : 1);
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const dlt = m[e.key];
    if (!dlt) return;
    e.preventDefault();
    stop();
    const { mx, my } = bounds();
    pos.current = { x: clamp(pos.current.x + dlt[0], -mx, mx), y: clamp(pos.current.y + dlt[1], -my, my) };
    vel.current = { x: 0, y: 0 };
    paint();
  };
  const reset = () => { stop(); vel.current = { x: 0, y: 0 }; pos.current = { x: 0, y: 0 }; if (card.current) card.current.style.transition = reduced ? '' : 'transform .35s var(--ease, ease)'; paint(); window.setTimeout(() => { if (card.current) card.current.style.transition = ''; }, 380); };

  return (
    <div className={`ui-draggable-spring-root ${className ?? ''}`}>
      <div ref={box} className="ui-draggable-spring-box">
        <button
          ref={card} type="button" className="ui-draggable-spring-card ui-draggable-spring-focus"
          aria-label="Draggable card. Drag or throw it, or use the arrow keys to move it."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
        >{label}</button>
      </div>
      <div className="ui-draggable-spring-row">
        <button type="button" className="ui-draggable-spring-btn" onClick={reset}>Reset</button>
        <p className="ui-draggable-spring-hint">Throw it, or use arrow keys</p>
      </div>
    </div>
  );
}

export function Demo() {
  return <DraggableSpring />;
}
