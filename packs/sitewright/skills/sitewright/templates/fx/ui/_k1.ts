'use client';
// Small hooks shared by the Kitchen batch (k1). Every one of them is SSR-safe: nothing touches window until an effect runs.
import { useEffect, useState, type RefObject } from 'react';

/** Tracks a media query. `false` during SSR and the first paint, then the real value. */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return on;
}

export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
export const useCoarsePointer = () => useMedia('(pointer: coarse)');

/** True while the element is on screen AND the tab is visible. Starts true so SSR output matches the first client render. */
export function useActive(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(true);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => setSeen(!!e?.isIntersecting), { threshold: 0.01 });
      io.observe(el);
    }
    const vis = () => setShown(document.visibilityState !== 'hidden');
    vis();
    document.addEventListener('visibilitychange', vis);
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [ref]);
  return seen && shown;
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
