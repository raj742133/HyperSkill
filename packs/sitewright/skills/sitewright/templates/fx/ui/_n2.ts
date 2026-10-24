'use client';
// Shared helpers for the n2 batch (drape-background, wheel-picker, plucked-text, pull-cord, activity-terrain, liquid-gauge).
import { useEffect, useState, type RefObject } from 'react';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Small seeded PRNG so default data is identical on server and client. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reduced-motion / coarse-pointer preferences, read after mount (false on the server and first render). */
export function usePrefs() {
  const [p, setP] = useState({ reduced: false, coarse: false });
  useEffect(() => {
    const r = window.matchMedia('(prefers-reduced-motion: reduce)');
    const c = window.matchMedia('(pointer: coarse)');
    const read = () => setP({ reduced: r.matches, coarse: c.matches });
    read();
    r.addEventListener('change', read);
    c.addEventListener('change', read);
    return () => { r.removeEventListener('change', read); c.removeEventListener('change', read); };
  }, []);
  return p;
}

/** True while the element is on screen and the tab is visible (use to pause rAF loops). */
export function useActive(ref: RefObject<Element | null>) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inView = true;
    let shown = document.visibilityState !== 'hidden';
    const set = () => setOn(inView && shown);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((e) => { inView = e[e.length - 1]?.isIntersecting ?? true; set(); }) : null;
    io?.observe(el);
    const vis = () => { shown = document.visibilityState !== 'hidden'; set(); };
    document.addEventListener('visibilitychange', vis);
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [ref]);
  return on;
}

/** Smooth open path through points using quadratic midpoints. */
export function smoothPath(pts: [number, number][], move = true): string {
  if (pts.length < 2) return '';
  const f = (n: number) => n.toFixed(2);
  let d = `${move ? 'M' : 'L'}${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]!;
    const [nx, ny] = pts[i + 1]!;
    d += `Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const l = pts[pts.length - 1]!;
  return d + `L${f(l[0])} ${f(l[1])}`;
}
