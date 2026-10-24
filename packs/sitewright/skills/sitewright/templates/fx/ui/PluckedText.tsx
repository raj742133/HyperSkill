'use client';
import { Fragment, useEffect, useRef } from 'react';
import { clamp, smoothPath, usePrefs, useActive } from './_n2';

export interface PluckedTextProps {
  text?: string;
  className?: string;
  style?: React.CSSProperties;
}

const VW = 300, VH = 44, MID = 22, N = 36;

/** Text with a string under it. Hover, drag or focus the string (or press Enter on it) to pluck it: the string vibrates and the letters ripple along. */
export default function PluckedText({ text = 'Pluck the string', className, style }: PluckedTextProps) {
  const root = useRef<HTMLSpanElement>(null);
  const path = useRef<SVGPathElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const letters = useRef<(HTMLSpanElement | null)[]>([]);
  const pluckRef = useRef<(amp: number, at?: number) => void>(() => {});
  const { reduced } = usePrefs();
  const active = useActive(root);
  const words: [string, number][][] = [];
  let ci = 0;
  for (const w of text.split(/\s+/).filter(Boolean)) words.push(Array.from(w, (c) => [c, ci++] as [string, number]));

  useEffect(() => {
    const p = path.current;
    const b = btn.current;
    if (!p || !b) return;
    const rest = () => p.setAttribute('d', `M4 ${MID}L${VW - 4} ${MID}`);
    rest();
    if (reduced) { pluckRef.current = () => { p.style.stroke = 'var(--signal, #f59e0b)'; setTimeout(() => (p.style.stroke = ''), 250); }; return; }
    let amp = 0, at = 0.5, t0 = 0, raf = 0, dragging = false, held = 0;
    const render = (a: number, tt: number) => {
      const decay = Math.exp(-tt * 2.6);
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const tri = u < at ? u / at : (1 - u) / (1 - at);
        const s1 = Math.sin(Math.PI * u), s2 = Math.sin(2 * Math.PI * u);
        const y = dragging ? held * Math.min(tri, 1) : a * decay * (Math.cos(tt * 34) * s1 * (0.5 + tri * 0.5) + 0.35 * Math.cos(tt * 66 + 0.5) * s2);
        pts.push([4 + u * (VW - 8), MID + y]);
      }
      p.setAttribute('d', smoothPath(pts));
      const n = letters.current.length;
      letters.current.forEach((el, i) => {
        if (!el) return;
        const u = (i + 0.5) / n;
        const dy = dragging ? -held * 0.35 * Math.sin(Math.PI * u) : -a * decay * 0.55 * Math.sin(tt * 34 - i * 0.55) * Math.sin(Math.PI * u + 0.3);
        el.style.transform = `translateY(${dy.toFixed(2)}px)`;
      });
      return decay;
    };
    const step = (now: number) => {
      const tt = (now - t0) / 1000;
      const decay = render(amp, tt);
      if (decay > 0.012 || dragging) raf = requestAnimationFrame(step);
      else { raf = 0; rest(); letters.current.forEach((el) => el && (el.style.transform = '')); }
    };
    const start = () => { t0 = performance.now(); if (!raf) raf = requestAnimationFrame(step); };
    pluckRef.current = (a, where = 0.5) => { if (!active) return; amp = clamp(a, 2, 15); at = clamp(where, 0.08, 0.92); dragging = false; start(); };
    const local = (e: PointerEvent) => { const r = b.getBoundingClientRect(); return { u: (e.clientX - r.left) / r.width, y: ((e.clientY - r.top) / r.height) * VH - MID }; };
    let lastEnter = 0;
    const enter = (e: PointerEvent) => { if (e.pointerType === 'mouse' && !dragging && performance.now() - lastEnter > 500) { lastEnter = performance.now(); pluckRef.current(6, local(e).u); } };
    const down = (e: PointerEvent) => { dragging = true; at = clamp(local(e).u, 0.1, 0.9); held = 0; b.setPointerCapture(e.pointerId); start(); };
    const move = (e: PointerEvent) => { if (dragging) { const l = local(e); at = clamp(l.u, 0.1, 0.9); held = clamp(l.y, -15, 15); } };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId);
      amp = Math.abs(held) < 2 ? 8 : Math.abs(held); t0 = performance.now(); // release: vibrate from the held displacement
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pluckRef.current(11, 0.5); } };
    const focus = () => { if (b.matches(':focus-visible')) pluckRef.current(5, 0.5); };
    b.addEventListener('pointerenter', enter);
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointermove', move);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('keydown', key);
    b.addEventListener('focus', focus);
    return () => {
      cancelAnimationFrame(raf);
      b.removeEventListener('pointerenter', enter);
      b.removeEventListener('pointerdown', down);
      b.removeEventListener('pointermove', move);
      b.removeEventListener('pointerup', up);
      b.removeEventListener('pointercancel', up);
      b.removeEventListener('keydown', key);
      b.removeEventListener('focus', focus);
      pluckRef.current = () => {};
    };
  }, [reduced, active]);

  return (
    <span ref={root} className={`ui-plucked-text${className ? ' ' + className : ''}`} style={style}>
      <span className="ui-plucked-text-sr">{text}</span>
      <span className="ui-plucked-text-line" aria-hidden="true">
        {words.map((w, wi) => (
          <Fragment key={wi}>
          <span className="ui-plucked-text-word">
            {w.map(([c, i]) => (
              <span key={i} ref={(el) => { letters.current[i] = el; }} className="ui-plucked-text-ch">{c}</span>
            ))}
          </span>
            {wi < words.length - 1 ? ' ' : ''}
          </Fragment>
        ))}
      </span>
      <span className="ui-plucked-text-string">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden="true">
          <path ref={path} fill="none" stroke="var(--primary, #2563eb)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <button ref={btn} type="button" className="ui-plucked-text-hit" aria-label="Pluck the string" onClick={(e) => { if (e.detail === 0) pluckRef.current(11, 0.5); }} />
      </span>
    </span>
  );
}

export function Demo() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: 150 }}>
      <PluckedText text="Pluck the string" style={{ width: 'min(100%, 260px)' }} />
    </div>
  );
}
