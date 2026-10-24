'use client';
import { useEffect, useRef } from 'react';
import { clamp, smoothPath, usePrefs, useActive } from './_n2';

export interface DrapeBackgroundProps {
  /** Number of cloth folds. */
  folds?: number;
  className?: string;
  style?: React.CSSProperties;
}

const K = 9; // samples down each fold edge
const W = 100;

function edgeBase(j: number, folds: number, k: number) {
  const y = k / (K - 1);
  return (j / folds) * W + Math.sin(y * Math.PI * 1.4 + j * 1.3) * 2.2 + Math.sin(j * 2.1) * 1.2;
}

/** A cloth-like backdrop: soft folds that the pointer sweeps through, or that you can grab and drag. Springs back. Decorative. */
export default function DrapeBackground({ folds = 6, className, style }: DrapeBackgroundProps) {
  const root = useRef<HTMLDivElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const lines = useRef<(SVGPathElement | null)[]>([]);
  const { reduced, coarse } = usePrefs();
  const active = useActive(root);
  const live = !reduced && !coarse && active;
  const n = Math.max(2, Math.min(12, Math.round(folds)));

  useEffect(() => {
    const E = n + 1;
    const disp = Array.from({ length: E }, () => new Float32Array(K));
    const vel = Array.from({ length: E }, () => new Float32Array(K));
    const draw = () => {
      const edges = disp.map((row, j) => Array.from(row, (d, k) => [edgeBase(j, n, k) + d, (k / (K - 1)) * 100] as [number, number]));
      for (let i = 0; i < n; i++) {
        const a = edges[i]!;
        const b = edges[i + 1]!;
        paths.current[i]?.setAttribute('d', smoothPath(a) + smoothPath([...b].reverse(), false) + 'Z');
        lines.current[i]?.setAttribute('d', smoothPath(b));
      }
    };
    draw();
    const el = root.current;
    if (!live || !el) return;
    const host = el.parentElement ?? el;
    let raf = 0;
    let last = { x: 0, y: 0, t: 0, has: false };
    let grab: { j: number; x: number; y: number } | null = null;
    let pointerId = -1;
    const toLocal = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * 100, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
    };
    const tick = () => {
      let energy = 0;
      for (let j = 0; j < E; j++) {
        for (let k = 0; k < K; k++) {
          const d = disp[j]![k]!;
          const l = k > 0 ? disp[j]![k - 1]! : d;
          const r = k < K - 1 ? disp[j]![k + 1]! : d;
          let f = -d * 0.07 + (l + r - 2 * d) * 0.05;
          if (j > 0 && j < E - 1) f += (disp[j - 1]![k]! + disp[j + 1]![k]! - 2 * d) * 0.03;
          if (grab) {
            const w = Math.exp(-(((k / (K - 1)) * 100 - grab.y) ** 2) / 500) * Math.exp(-((j - grab.j) ** 2) / 1.2);
            f += (grab.x - edgeBase(j, n, k) - d) * 0.16 * w;
          }
          const v = (vel[j]![k]! + f) * 0.9;
          vel[j]![k] = v;
          disp[j]![k] = clamp(d + v, -26, 26);
          energy += Math.abs(v) + Math.abs(d);
        }
      }
      draw();
      raf = energy > 0.05 || grab ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const move = (e: PointerEvent) => {
      const p = toLocal(e);
      if (grab) { grab.x = p.x; grab.y = p.y; kick(); return; }
      const now = e.timeStamp;
      if (p.inside && last.has && now - last.t < 120) {
        const vx = clamp(p.x - last.x, -8, 8);
        if (Math.abs(vx) > 0.15) {
          for (let j = 0; j < E; j++) for (let k = 0; k < K; k++) {
            const dist = (edgeBase(j, n, k) - p.x) ** 2 + ((k / (K - 1)) * 100 - p.y) ** 2 * 0.6;
            vel[j]![k] += vx * 0.22 * Math.exp(-dist / 160);
          }
          kick();
        }
      }
      last = { x: p.x, y: p.y, t: now, has: p.inside };
    };
    const down = (e: PointerEvent) => {
      const p = toLocal(e);
      let best = Infinity, bj = 1;
      for (let j = 1; j < E - 1; j++) { const dd = Math.abs(edgeBase(j, n, Math.round((p.y / 100) * (K - 1))) - p.x); if (dd < best) { best = dd; bj = j; } }
      grab = { j: bj, x: p.x, y: p.y };
      pointerId = e.pointerId;
      el.setPointerCapture(pointerId);
      el.style.cursor = 'grabbing';
      kick();
    };
    const up = () => { grab = null; el.style.cursor = ''; if (pointerId >= 0 && el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId); pointerId = -1; kick(); };
    host.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [n, live]);

  return (
    <div ref={root} className={`ui-drape-background${className ? ' ' + className : ''}`} style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, touchAction: live ? 'pan-y' : undefined, cursor: live ? 'grab' : undefined, ...style }} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ui-drape-shade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--primary, #2563eb)" stopOpacity="0.22" />
            <stop offset="0.55" stopColor="var(--primary, #2563eb)" stopOpacity="0.05" />
            <stop offset="1" stopColor="var(--signal, #f59e0b)" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <path ref={(el) => { paths.current[i] = el; }} fill="url(#ui-drape-shade)" fillOpacity={i % 2 ? 0.55 : 1} />
            <path ref={(el) => { lines.current[i] = el; }} fill="none" stroke="var(--line-strong, currentColor)" strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function Demo() {
  return (
    <div style={{ position: 'relative', height: 150, borderRadius: 'var(--radius, 12px)', overflow: 'hidden', background: 'var(--raised, #f5f5f5)', display: 'grid', placeItems: 'center' }}>
      <DrapeBackground />
      <p style={{ position: 'relative', margin: 0, textAlign: 'center', fontFamily: 'var(--font-body, system-ui)', color: 'var(--ink, #111)', pointerEvents: 'none' }}>
        <strong style={{ display: 'block', fontSize: 18 }}>Drag the cloth</strong>
        <span style={{ color: 'var(--muted, #555)', fontSize: 13 }}>or sweep the pointer through it</span>
      </p>
    </div>
  );
}
