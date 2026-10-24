'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { clamp, useReducedMotion } from './_n1';

export interface DetentDialProps {
  steps?: number;
  labels?: string[];
  value?: number;
  defaultValue?: number;
  onChange?: (index: number, label: string) => void;
  label?: string;
  className?: string;
}

const START = -135;
const SWEEP = 270;
const DEFAULT_LABELS = ['Off', '1', '2', '3', '4', '5', '6', 'Max'];

export default function DetentDial({ steps = 8, labels, value, defaultValue = 3, onChange, label = 'Level', className = '' }: DetentDialProps) {
  const names = labels && labels.length >= 2 ? labels : steps === 8 ? DEFAULT_LABELS : Array.from({ length: Math.max(2, steps) }, (_, i) => String(i));
  const n = names.length;
  const stepDeg = SWEEP / (n - 1);
  const angleOf = useCallback((i: number) => START + i * stepDeg, [stepDeg]);
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(clamp(Math.round(value ?? defaultValue), 0, n - 1));
  const initialAngle = useRef(angleOf(index)).current;

  const knob = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const ang = useRef(initialAngle);
  const vel = useRef(0);
  const raf = useRef(0);
  const idxRef = useRef(index);
  const drag = useRef<{ last: number; samples: { t: number; a: number }[] } | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const namesRef = useRef(names);
  namesRef.current = names;

  const paint = () => { if (knob.current) knob.current.style.transform = `rotate(${ang.current.toFixed(2)}deg)`; };
  const sync = useCallback(() => {
    const i = clamp(Math.round((ang.current - START) / stepDeg), 0, n - 1);
    if (i !== idxRef.current) { idxRef.current = i; setIndex(i); cb.current?.(i, namesRef.current[i] ?? String(i)); }
  }, [n, stepDeg]);
  const stop = () => { cancelAnimationFrame(raf.current); raf.current = 0; };

  const run = useCallback((target: number | null) => {
    stop();
    let last = performance.now();
    let tgt = target;
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      if (tgt === null) {
        vel.current *= Math.exp(-dt * 3.2);
        ang.current += vel.current * dt;
        const lo = START, hi = START + SWEEP;
        if (ang.current < lo || ang.current > hi) { ang.current = clamp(ang.current, lo, hi); vel.current = 0; }
        if (Math.abs(vel.current) < 45) tgt = angleOf(clamp(Math.round((ang.current - START) / stepDeg), 0, n - 1));
      } else {
        const a = 260 * (tgt - ang.current) - 17 * vel.current;
        vel.current += a * dt;
        ang.current += vel.current * dt;
        if (Math.abs(tgt - ang.current) < 0.1 && Math.abs(vel.current) < 4) { ang.current = tgt; vel.current = 0; paint(); sync(); raf.current = 0; return; }
      }
      paint(); sync();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [angleOf, n, stepDeg, sync]);

  const goTo = useCallback((i: number) => {
    const c = clamp(i, 0, n - 1);
    vel.current = 0;
    if (reduced) { stop(); ang.current = angleOf(c); paint(); sync(); } else run(angleOf(c));
  }, [n, reduced, angleOf, run, sync]);

  // controlled value
  useEffect(() => { if (value !== undefined && Math.round(value) !== idxRef.current) goTo(Math.round(value)); }, [value, goTo]);
  useEffect(() => stop, []);

  // wheel: one detent per notch; lets the page scroll once the dial is at its end
  useEffect(() => {
    const el = root.current; if (!el) return;
    let acc = 0;
    const wheel = (e: WheelEvent) => {
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = idxRef.current + dir;
      if (next < 0 || next > n - 1) return;
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) >= 40) { acc = 0; goTo(next); }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [n, goTo]);

  const pAngle = (e: PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stop(); vel.current = 0;
    drag.current = { last: pAngle(e), samples: [{ t: performance.now(), a: ang.current }] };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const p = pAngle(e);
    let delta = p - d.last;
    if (delta > 180) delta -= 360; else if (delta < -180) delta += 360;
    d.last = p;
    ang.current = clamp(ang.current + delta, START, START + SWEEP);
    const now = performance.now();
    d.samples.push({ t: now, a: ang.current });
    while (d.samples.length > 2 && now - (d.samples[0]?.t ?? now) > 90) d.samples.shift();
    paint(); sync();
  };
  const up = () => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const a = d.samples[0], b = d.samples[d.samples.length - 1];
    const v = a && b && b.t > a.t ? ((b.a - a.a) / (b.t - a.t)) * 1000 : 0;
    if (reduced) { goTo(Math.round((ang.current - START) / stepDeg)); return; }
    vel.current = clamp(v, -900, 900);
    run(Math.abs(vel.current) < 45 ? angleOf(clamp(Math.round((ang.current - START) / stepDeg), 0, n - 1)) : null);
  };
  const key = (e: KeyboardEvent) => {
    const k = e.key; let t: number | null = null;
    if (k === 'ArrowRight' || k === 'ArrowUp') t = idxRef.current + 1;
    else if (k === 'ArrowLeft' || k === 'ArrowDown') t = idxRef.current - 1;
    else if (k === 'PageUp') t = idxRef.current + 2;
    else if (k === 'PageDown') t = idxRef.current - 2;
    else if (k === 'Home') t = 0;
    else if (k === 'End') t = n - 1;
    if (t !== null) { e.preventDefault(); goTo(t); }
  };

  const ticks = names.map((_, i) => {
    const r = ((angleOf(i) - 90) * Math.PI) / 180;
    return { x1: 50 + 41 * Math.cos(r), y1: 50 + 41 * Math.sin(r), x2: 50 + 47 * Math.cos(r), y2: 50 + 47 * Math.sin(r) };
  });
  const text = names[index] ?? String(index);

  return (
    <div className={`ui-detent-dial ${className}`.trim()}>
      <div ref={root} className="ui-detent-dial-face" role="slider" tabIndex={0} aria-label={label} aria-orientation="horizontal"
        aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={index} aria-valuetext={text}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
        <svg viewBox="0 0 100 100" className="ui-detent-dial-ticks" aria-hidden="true">
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1.toFixed(2)} y1={t.y1.toFixed(2)} x2={t.x2.toFixed(2)} y2={t.y2.toFixed(2)} strokeWidth={i === index ? 3 : 2} strokeLinecap="round"
              className={i <= index ? 'ui-detent-dial-on' : undefined} />
          ))}
        </svg>
        <div ref={knob} className="ui-detent-dial-knob" style={{ transform: `rotate(${initialAngle.toFixed(2)}deg)` }}>
          <span className="ui-detent-dial-pip" />
        </div>
      </div>
      <div className="ui-detent-dial-read" aria-hidden="true">
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
    </div>
  );
}

export function Demo() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 8 }}>
      <DetentDial label="Intensity" />
    </div>
  );
}
