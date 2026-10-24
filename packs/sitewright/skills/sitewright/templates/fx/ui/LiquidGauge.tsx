'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { clamp, usePrefs, useActive } from './_n2';

export interface LiquidGaugeProps {
  /** 0 to 100. */
  value?: number;
  label?: string;
  size?: number;
  shape?: 'circle' | 'tank';
  className?: string;
}

const S = 120, R = 54;

/** A gauge filled with liquid: two animated sine waves at the fill level. Drag sideways (or press Left/Right) to slosh it. */
export default function LiquidGauge({ value = 64, label = 'Storage used', size = 132, shape = 'circle', className }: LiquidGaugeProps) {
  const v = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const uid = useId().replace(/:/g, '');
  const root = useRef<HTMLDivElement>(null);
  const back = useRef<SVGPathElement>(null);
  const front = useRef<SVGPathElement>(null);
  const tilt = useRef<SVGGElement>(null);
  const { reduced } = usePrefs();
  const active = useActive(root);
  const target = useRef(v);
  target.current = v;
  const kick = useRef<(n: number) => void>(() => {});
  const [shown, setShown] = useState(v);

  useEffect(() => {
    const b = back.current, f = front.current, g = tilt.current;
    if (!b || !f || !g) return;
    const levelY = (l: number) => (shape === 'tank' ? 104 - (l / 100) * 92 : S / 2 + R - (l / 100) * 2 * R);
    const wave = (lvl: number, amp: number, ph: number, k: number) => {
      const y0 = levelY(lvl);
      let d = `M-40 ${y0.toFixed(1)}`;
      for (let x = -40; x <= S + 40; x += 6) d += `L${x} ${(y0 + amp * Math.sin(x * k + ph)).toFixed(1)}`;
      return d + `L${S + 40} ${S + 60}L-40 ${S + 60}Z`;
    };
    const s = { lvl: reduced ? target.current : 0, phase: 0, ang: 0, w: 0, raf: 0, last: 0, drag: false, x: 0 };
    const draw = () => {
      const amp = reduced ? 0 : 2.2 + Math.min(7, Math.abs(s.ang) * 0.5);
      b.setAttribute('d', wave(s.lvl, amp, s.phase * 0.8 + 1.5, 0.095));
      f.setAttribute('d', wave(s.lvl, amp * 1.15, -s.phase, 0.075));
      g.setAttribute('transform', `rotate(${s.ang.toFixed(2)} ${S / 2} ${levelY(s.lvl).toFixed(1)})`);
    };
    draw();
    if (reduced) { setShown(Math.round(target.current)); return; }
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000 || 0.016); s.last = now;
      s.phase += dt * 2.4;
      s.w += (-s.ang * 60 - s.w * 5) * dt; // spring + damping on the slosh angle
      s.ang = clamp(s.ang + s.w * dt, -22, 22);
      s.lvl += (target.current - s.lvl) * Math.min(1, dt * 3);
      draw();
      setShown((p) => (Math.round(s.lvl) !== p ? Math.round(s.lvl) : p));
      s.raf = requestAnimationFrame(frame);
    };
    if (active) { s.last = performance.now(); s.raf = requestAnimationFrame(frame); }
    kick.current = (n) => { s.w += n; };
    const el = root.current;
    const down = (e: PointerEvent) => { s.drag = true; s.x = e.clientX; el?.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!s.drag) return; s.w += clamp(e.clientX - s.x, -30, 30) * 3.2; s.x = e.clientX; };
    const up = (e: PointerEvent) => { s.drag = false; if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
    el?.addEventListener('pointerdown', down);
    el?.addEventListener('pointermove', move);
    el?.addEventListener('pointerup', up);
    el?.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(s.raf);
      kick.current = () => {};
      el?.removeEventListener('pointerdown', down);
      el?.removeEventListener('pointermove', move);
      el?.removeEventListener('pointerup', up);
      el?.removeEventListener('pointercancel', up);
    };
  }, [reduced, active, shape]);

  const shownV = reduced ? Math.round(v) : shown;
  const clip = shape === 'tank' ? <rect x="14" y="12" width="92" height="92" rx="14" /> : <circle cx={S / 2} cy={S / 2} r={R} />;
  return (
    <div
      ref={root}
      className={`ui-liquid-gauge${className ? ' ' + className : ''}`}
      style={{ width: size, height: size, touchAction: 'pan-y' }}
      role="meter"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-valuetext={`${Math.round(v)} percent`}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); kick.current(-260); } else if (e.key === 'ArrowRight') { e.preventDefault(); kick.current(260); } }}
    >
      <svg viewBox={`0 0 ${S} ${S}`} width="100%" height="100%" aria-hidden="true">
        <defs><clipPath id={`${uid}-c`}>{clip}</clipPath></defs>
        <g clipPath={`url(#${uid}-c)`}>
          <rect width={S} height={S} fill="var(--raised, #f3f4f6)" />
          <g ref={tilt}>
            <path ref={back} fill="var(--primary, #2563eb)" fillOpacity="0.38" />
            <path ref={front} fill="var(--primary, #2563eb)" fillOpacity="0.78" />
          </g>
        </g>
        {shape === 'tank'
          ? <rect x="14" y="12" width="92" height="92" rx="14" fill="none" stroke="var(--line-strong, #999)" strokeWidth="2" />
          : <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--line-strong, #999)" strokeWidth="2" />}
        <text x={S / 2} y={shape === 'tank' ? 54 : 58} textAnchor="middle" className="ui-liquid-gauge-num">{shownV}%</text>
        <text x={S / 2} y={shape === 'tank' ? 72 : 76} textAnchor="middle" className="ui-liquid-gauge-label">{label}</text>
      </svg>
    </div>
  );
}

export function Demo() {
  const [v, setV] = useState(64);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, height: 150 }}>
      <LiquidGauge value={v} label="Storage" size={128} />
      <div style={{ display: 'grid', gap: 6 }}>
        {[25, 64, 90].map((n) => (
          <button key={n} type="button" onClick={() => setV(n)} aria-pressed={v === n} className="ui-liquid-gauge-btn">{n}%</button>
        ))}
      </div>
    </div>
  );
}
