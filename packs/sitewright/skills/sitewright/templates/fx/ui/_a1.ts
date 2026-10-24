'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/* ---------- math ---------- */
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Map a 0..1 value through piecewise keyframes [[input, output], ...] (inputs ascending). */
export function mapKeyframes(p: number, stops: [number, number][]): number {
  if (!stops.length) return 0;
  const first = stops[0] as [number, number];
  const last = stops[stops.length - 1] as [number, number];
  if (p <= first[0]) return first[1];
  if (p >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1] as [number, number];
    const b = stops[i] as [number, number];
    if (p <= b[0]) return lerp(a[1], b[1], (p - a[0]) / (b[0] - a[0] || 1));
  }
  return last[1];
}

/* ---------- stagger (anime.js style) ---------- */
export type StaggerFrom = 'first' | 'last' | 'center' | number;
export interface StaggerOptions {
  each?: number; // ms between neighbours
  from?: StaggerFrom;
  grid?: [rows: number, cols: number];
}
/** Returns one delay (ms) per item. With `grid` the delay follows euclidean distance on the grid. */
export function stagger(count: number, { each = 40, from = 'first', grid }: StaggerOptions = {}): number[] {
  const out: number[] = [];
  if (grid) {
    const [rows, cols] = grid;
    let oc = 0, or = 0;
    if (from === 'center') { oc = (cols - 1) / 2; or = (rows - 1) / 2; }
    else if (from === 'last') { oc = cols - 1; or = rows - 1; }
    else if (typeof from === 'number') { oc = from % cols; or = Math.floor(from / cols); }
    for (let i = 0; i < count; i++) out.push(Math.hypot((i % cols) - oc, Math.floor(i / cols) - or) * each);
    return out;
  }
  const o = from === 'center' ? (count - 1) / 2 : from === 'last' ? count - 1 : typeof from === 'number' ? from : 0;
  for (let i = 0; i < count; i++) out.push(Math.abs(i - o) * each);
  return out;
}

/* ---------- hooks ---------- */
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

/** True while the element intersects the viewport. `once` latches true. */
export function useInView(ref: RefObject<Element | null>, once = false, threshold = 0.25): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); }
          else if (!once) setSeen(false);
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, threshold]);
  return seen;
}

export interface TimelineOptions {
  duration: number; // ms
  loop?: boolean;
  autoplay?: boolean;
  active?: boolean; // false pauses the rAF loop (e.g. off screen)
  initial?: number;
}
export interface TimelineApi {
  progress: number;
  playing: boolean;
  direction: 1 | -1;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  reverse: () => void;
  seek: (p: number) => void;
}
/** rAF transport: play / pause / seek / reverse / loop. */
export function useTimeline({ duration, loop = false, autoplay = true, active = true, initial = 0 }: TimelineOptions): TimelineApi {
  const [progress, setProgress] = useState(initial);
  const [playing, setPlaying] = useState(autoplay);
  const [direction, setDirection] = useState<1 | -1>(1);
  const p = useRef(initial);
  const dir = useRef<1 | -1>(1);

  useEffect(() => {
    if (!playing || !active) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      let n = p.current + (dir.current * dt) / duration;
      if (n >= 1 || n <= 0) {
        if (loop) n = n >= 1 ? n - 1 : n + 1;
        else {
          n = n >= 1 ? 1 : 0;
          p.current = n;
          setProgress(n);
          setPlaying(false);
          return;
        }
      }
      p.current = n;
      setProgress(n);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, active, duration, loop]);

  const seek = useCallback((v: number) => { p.current = clamp(v); setProgress(p.current); }, []);
  const play = useCallback(() => {
    if (!loop && ((dir.current === 1 && p.current >= 1) || (dir.current === -1 && p.current <= 0))) {
      p.current = dir.current === 1 ? 0 : 1;
      setProgress(p.current);
    }
    setPlaying(true);
  }, [loop]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);
  const restart = useCallback(() => { p.current = dir.current === 1 ? 0 : 1; setProgress(p.current); setPlaying(true); }, []);
  const reverse = useCallback(() => {
    dir.current = dir.current === 1 ? -1 : 1;
    setDirection(dir.current);
    play();
  }, [play]);
  return { progress, playing, direction, play, pause, toggle, restart, reverse, seek };
}

/* ---------- shape morphing ---------- */
export type Pt = [number, number];

/** Resample a closed polyline to n evenly spaced points (arc length), starting at its first vertex. */
export function resample(poly: Pt[], n: number): Pt[] {
  const pts = [...poly, poly[0] as Pt];
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt, b = pts[i] as Pt;
    lens.push((lens[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lens[lens.length - 1] as number;
  const out: Pt[] = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    while (seg < lens.length - 1 && (lens[seg] as number) < d) seg++;
    const a = pts[seg - 1] as Pt, b = pts[seg] as Pt;
    const l0 = lens[seg - 1] as number, l1 = lens[seg] as number;
    const t = l1 === l0 ? 0 : (d - l0) / (l1 - l0);
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  }
  return out;
}

/** Fit points into a size x size box (centred, with padding) so all shapes share a scale. */
export function fit(pts: Pt[], size = 100, pad = 12): Pt[] {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = (size - pad * 2) / Math.max(maxX - minX, maxY - minY || 1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return pts.map(([x, y]) => [size / 2 + (x - cx) * s, size / 2 + (y - cy) * s] as Pt);
}

export const SHAPE_POINTS = 96;
function circlePoly(): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < 180; i++) { const a = -Math.PI / 2 + (i / 180) * Math.PI * 2; o.push([Math.cos(a), Math.sin(a)]); }
  return o;
}
function starPoly(): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const r = i % 2 ? 0.45 : 1; o.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return o;
}
function heartPoly(): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < 180; i++) {
    const t = (i / 180) * Math.PI * 2;
    o.push([16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]);
  }
  return o;
}
/** Built-in shapes, all normalised to SHAPE_POINTS points in a 100x100 box. */
export const SHAPES: Record<'circle' | 'star' | 'heart', Pt[]> = {
  circle: fit(resample(circlePoly(), SHAPE_POINTS)),
  star: fit(resample(starPoly(), SHAPE_POINTS)),
  heart: fit(resample(heartPoly(), SHAPE_POINTS)),
};
export function mixPoints(a: Pt[], b: Pt[], t: number): Pt[] {
  return a.map((p, i) => { const q = b[i] as Pt; return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)] as Pt; });
}
export function toPath(pts: Pt[]): string {
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';
}
