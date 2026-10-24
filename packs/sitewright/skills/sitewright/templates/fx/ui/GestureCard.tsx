'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { clamp, useSpring, useSpringValue, type SpringConfig } from './_m1';

export interface GestureCardProps {
  hover?: boolean;
  press?: boolean;
  drag?: boolean;
  title?: string;
  children?: ReactNode;
  onPress?: () => void;
  className?: string;
}

const SPRING: SpringConfig = { stiffness: 320, damping: 24, mass: 1 };
const COAST: SpringConfig = { stiffness: 140, damping: 16, mass: 1 };
const rubber = (v: number, lo: number, hi: number) => (v < lo ? lo + (v - lo) * 0.3 : v > hi ? hi + (v - hi) * 0.3 : v);

export default function GestureCard({ hover = true, press = true, drag = true, title = 'Touch me', children, onPress, className }: GestureCardProps) {
  const stage = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [count, setCount] = useState(0);
  const [x, xApi] = useSpringValue(0, COAST);
  const [y, yApi] = useSpringValue(0, COAST);
  const g = useRef({ id: -1, sx: 0, sy: 0, ox: 0, oy: 0, moved: false, bx: 0, by: 0, pts: [] as { t: number; x: number; y: number }[] });
  const scale = useSpring(pressed ? 0.94 : hovered ? 1.04 : 1, SPRING);

  useEffect(() => { if (!drag) { xApi.to(0); yApi.to(0); } }, [drag, xApi, yApi]);

  const bounds = () => {
    const s = stage.current, b = btn.current;
    if (!s || !b) return { bx: 0, by: 0 };
    return { bx: Math.max(0, (s.clientWidth - b.offsetWidth) / 2), by: Math.max(0, (s.clientHeight - b.offsetHeight) / 2) };
  };

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (press) setPressed(true);
    if (!drag) return;
    const b = bounds();
    Object.assign(g.current, { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: xApi.get(), oy: yApi.get(), moved: false, bx: b.bx, by: b.by, pts: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] });
    xApi.to(xApi.get(), { immediate: true });
    yApi.to(yApi.get(), { immediate: true });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const s = g.current;
    if (s.id !== e.pointerId) return;
    const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
    if (!s.moved && Math.hypot(dx, dy) < 4) return;
    if (!s.moved) { s.moved = true; setDragging(true); }
    s.pts.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (s.pts.length > 6) s.pts.shift();
    xApi.to(rubber(s.ox + dx, -s.bx, s.bx), { immediate: true });
    yApi.to(rubber(s.oy + dy, -s.by, s.by), { immediate: true });
  };
  const up = (e: PointerEvent) => {
    const s = g.current;
    setPressed(false);
    if (s.id !== e.pointerId) return;
    s.id = -1;
    if (!s.moved) return;
    setDragging(false);
    const a = s.pts[0], z = s.pts[s.pts.length - 1];
    const dt = a && z ? Math.max((z.t - a.t) / 1000, 0.016) : 1;
    const vx = a && z && e.timeStamp - z.t < 80 ? ((z.x - a.x) / dt) : 0;
    const vy = a && z && e.timeStamp - z.t < 80 ? ((z.y - a.y) / dt) : 0;
    xApi.to(clamp(xApi.get() + vx * 0.25, -s.bx, s.bx), { velocity: vx });
    yApi.to(clamp(yApi.get() + vy * 0.25, -s.by, s.by), { velocity: vy });
  };
  const cancel = up;

  const keyDown = (e: KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && press && !e.repeat) setPressed(true);
    if (drag && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const { bx, by } = bounds();
      const d = 28;
      if (e.key === 'ArrowLeft') xApi.to(clamp(xApi.get() - d, -bx, bx));
      if (e.key === 'ArrowRight') xApi.to(clamp(xApi.get() + d, -bx, bx));
      if (e.key === 'ArrowUp') yApi.to(clamp(yApi.get() - d, -by, by));
      if (e.key === 'ArrowDown') yApi.to(clamp(yApi.get() + d, -by, by));
    }
  };
  const keyUp = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') setPressed(false); };
  const click = () => { if (g.current.moved) { g.current.moved = false; return; } setCount((c) => c + 1); onPress?.(); };

  return (
    <div ref={stage} className={`ui-gesture-card-stage${className ? ' ' + className : ''}`}>
      <button
        ref={btn}
        type="button"
        className="ui-gesture-card-card"
        data-dragging={dragging || undefined}
        data-drag={drag || undefined}
        style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
        aria-describedby={undefined}
        onPointerEnter={(e) => { if (hover && e.pointerType !== 'touch') setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onBlur={() => setPressed(false)}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onClick={click}
      >
        <span className="ui-gesture-card-title">{title}</span>
        <span className="ui-gesture-card-hint">{children ?? ([hover && 'hover', press && 'press', drag && 'drag'].filter(Boolean).join(' · ') || 'static')}</span>
        <span className="ui-gesture-card-count" aria-live="polite">Pressed {count}×</span>
      </button>
    </div>
  );
}

export function Demo() {
  return <GestureCard />;
}
