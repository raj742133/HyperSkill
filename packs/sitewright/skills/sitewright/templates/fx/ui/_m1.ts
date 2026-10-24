'use client';
// Shared helpers for the "Motion"-style batch m1: a tiny spring solver and a few hooks.
// Plain React + rAF. No animation library.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

export interface SpringConfig {
  stiffness: number; // N/m, higher = snappier
  damping: number; // friction, higher = less bounce
  mass: number;
  velocity?: number; // initial velocity (units/s)
  precision?: number; // rest threshold in value units (default 0.01)
}

export const SPRING_DEFAULT: SpringConfig = { stiffness: 170, damping: 22, mass: 1 };
export const SPRING_PRESETS = {
  bouncy: { stiffness: 300, damping: 10, mass: 1 },
  smooth: { stiffness: 120, damping: 20, mass: 1 },
  stiff: { stiffness: 600, damping: 40, mass: 1 },
} satisfies Record<string, SpringConfig>;

export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

export interface SpringState { x: number; v: number }

/** Advance a damped spring towards `target` by dt seconds (semi-implicit Euler, 240 Hz substeps). */
export function stepSpring(s: SpringState, target: number, cfg: SpringConfig, dt: number): void {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  const m = cfg.mass > 0 ? cfg.mass : 1;
  for (let i = 0; i < n; i++) {
    const a = (-cfg.stiffness * (s.x - target) - cfg.damping * s.v) / m;
    s.v += a * h;
    s.x += s.v * h;
  }
}

/** Sample the 0 -> 1 step response of a spring as an SVG path, plus its settle time (to within 1%). */
export function springPath(
  cfg: SpringConfig,
  opts: { width: number; height: number; duration?: number; pad?: number; samples?: number } = { width: 200, height: 60 },
): { d: string; settle: number; peak: number; duration: number; targetY: number; baseY: number } {
  const { width, height } = opts;
  const pad = opts.pad ?? 4;
  const h = 1 / 240;
  const s: SpringState = { x: 0, v: cfg.velocity ?? 0 };
  const xs: number[] = [0];
  let settle = 0;
  let peak = 0;
  const maxT = 10;
  for (let i = 1; i <= maxT * 240; i++) {
    stepSpring(s, 1, cfg, h);
    xs.push(s.x);
    if (s.x > peak) peak = s.x;
    if (Math.abs(s.x - 1) > 0.01) settle = i * h;
  }
  const duration = opts.duration ?? Math.min(maxT, Math.max(0.4, settle * 1.15));
  const ymax = Math.max(1.1, peak * 1.05);
  const samples = opts.samples ?? 80;
  const iw = width - pad * 2;
  const ih = height - pad * 2;
  const yOf = (v: number) => pad + ih - (Math.max(-0.2, v) / ymax) * ih;
  let d = '';
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * duration;
    const idx = Math.min(xs.length - 1, Math.round(t * 240));
    d += `${i ? 'L' : 'M'}${(pad + (i / samples) * iw).toFixed(1)} ${yOf(xs[idx] ?? 1).toFixed(1)}`;
  }
  return { d, settle, peak, duration, targetY: yOf(1), baseY: yOf(0) };
}

export interface SpringApi {
  /** animate towards target (optionally with an initial velocity); `immediate` jumps */
  to(target: number, o?: { velocity?: number; immediate?: boolean }): void;
  /** current velocity (units/s) */
  velocity(): number;
  /** current value without re-rendering */
  get(): number;
}

/** A spring-driven number with an imperative api. Re-renders every frame while moving. */
export function useSpringValue(initial: number, cfg: SpringConfig = SPRING_DEFAULT): [number, SpringApi] {
  const [value, setValue] = useState(initial);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const st = useRef({ x: initial, v: 0, target: initial, raf: 0, last: 0 });
  const api = useMemo<SpringApi>(() => {
    const s = st.current;
    const tick = (t: number) => {
      const c = cfgRef.current;
      const dt = Math.min(Math.max((t - s.last) / 1000, 0), 1 / 30);
      s.last = t;
      stepSpring(s, s.target, c, dt);
      const eps = c.precision ?? 0.01;
      if (Math.abs(s.x - s.target) < eps && Math.abs(s.v) < eps * 10) {
        s.x = s.target;
        s.v = 0;
        s.raf = 0;
      } else {
        s.raf = requestAnimationFrame(tick);
      }
      setValue(s.x);
    };
    return {
      to(target, o) {
        s.target = target;
        if (o?.velocity !== undefined) s.v = o.velocity;
        if (o?.immediate || prefersReducedMotion()) {
          if (s.raf) cancelAnimationFrame(s.raf);
          s.raf = 0;
          s.x = target;
          s.v = 0;
          setValue(target);
          return;
        }
        if (!s.raf && (s.x !== target || s.v !== 0)) {
          s.last = performance.now();
          s.raf = requestAnimationFrame(tick);
        }
      },
      velocity: () => s.v,
      get: () => s.x,
    };
  }, []);
  useEffect(() => {
    const s = st.current;
    return () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);
  return [value, api];
}

/** Animated number that follows `target` with spring physics. Starts at `target` (SSR safe). */
export function useSpring(target: number, cfg: SpringConfig = SPRING_DEFAULT, immediate = false): number {
  const [value, api] = useSpringValue(target, cfg);
  useEffect(() => {
    api.to(target, { immediate, velocity: cfg.velocity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, immediate, api]);
  return value;
}

/** 0..1 scroll progress of a scrollable element, throttled by rAF. */
export function useScrollProgress(ref: RefObject<HTMLElement | null>): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    el.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      el.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return p;
}

/**
 * FLIP for keyed children: children of `ref` carrying data-flip-key slide from their previous
 * position to the new one whenever `dep` changes. Positions are measured relative to the container.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, dep: unknown, ms = 240): void {
  const prev = useRef<Map<string, number>>(new Map());
  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, number>();
    const reduced = prefersReducedMotion();
    root.querySelectorAll<HTMLElement>('[data-flip-key]').forEach((el) => {
      const key = el.dataset.flipKey as string;
      const top = el.offsetTop;
      next.set(key, top);
      const was = prev.current.get(key);
      if (!reduced && was !== undefined && Math.abs(was - top) > 1 && !el.hasAttribute('data-exiting') && el.animate) {
        el.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'translateY(0)' }], {
          duration: ms,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    });
    prev.current = next;
  }, [dep]);
}

/** stable callback helper */
export function useEvent<A extends unknown[], R>(fn: (...a: A) => R): (...a: A) => R {
  const r = useRef(fn);
  r.current = fn;
  return useCallback((...a: A) => r.current(...a), []);
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
