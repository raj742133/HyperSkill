'use client';

import { useEffect, useRef } from 'react';

/**
 * The one place canvas backgrounds get their manners:
 *  - sized to the element, pixel density capped at 2 (a phone at 3x would otherwise draw 9x the pixels for no visible gain)
 *  - paused while off screen or in a hidden tab, so a long page does not burn battery behind the reader
 *  - prefers-reduced-motion: one still frame is drawn and the loop never starts
 *  - brand colours read from the CSS variables, and re-read when light/dark changes
 *  - the pointer is tracked in the element's own coordinates (touch drags count too)
 */
export type RGB = [number, number, number];
export type Palette = { primary: RGB; signal: RGB; ink: RGB; dark: boolean };

export const rgb = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function hex(value: string, fallback: string): RGB {
  const h = (value.trim() || fallback).replace('#', '');
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.padEnd(6, '0');
  return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
}

export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const ink = hex(cs.getPropertyValue('--ink'), '#111111');
  return { primary: hex(cs.getPropertyValue('--primary'), '#1e5bd8'), signal: hex(cs.getPropertyValue('--signal'), '#1fb8e0'), ink, dark: ink[0] > 128 };
}

export type Frame = {
  ctx: CanvasRenderingContext2D;
  w: number; h: number; dpr: number;
  /** seconds since the page started; dt is milliseconds since the last frame */
  t: number; dt: number;
  pointer: { x: number; y: number; active: boolean };
  pal: Palette;
  coarse: boolean;
  reduced: boolean;
};

/** `make` runs on every resize and returns the draw function for that size. */
export function useCanvasLoop(make: (f: Frame) => (f: Frame) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const f: Frame = { ctx, w: 1, h: 1, dpr: 1, t: 0, dt: 16, pointer: { x: -9999, y: -9999, active: false }, pal: readPalette(canvas), coarse, reduced };
    let draw: (fr: Frame) => void = () => undefined;
    let raf = 0, running = false, visible = true, last = 0;

    const paint = (now: number) => {
      f.dt = Math.min(64, now - (last || now - 16));
      last = now;
      f.t = now / 1000;
      ctx.clearRect(0, 0, f.w, f.h);
      draw(f);
    };
    const loop = (now: number) => { if (!running) return; paint(now); raf = requestAnimationFrame(loop); };
    const start = () => { if (reduced || running || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      f.dpr = Math.min(window.devicePixelRatio || 1, 2);
      f.w = Math.max(1, Math.round(r.width)); f.h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(f.w * f.dpr); canvas.height = Math.round(f.h * f.dpr);
      ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      f.pal = readPalette(canvas);
      draw = make(f);
      paint(performance.now());
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      f.pointer.x = e.clientX - r.left; f.pointer.y = e.clientY - r.top;
      f.pointer.active = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const onLeave = () => { f.pointer.active = false; };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    const repalette = () => { f.pal = readPalette(canvas); if (!running) paint(performance.now()); };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; if (visible) start(); else stop(); }, { threshold: 0 });
    io.observe(canvas);
    const mo = new MutationObserver(repalette);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', repalette);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    start();
    return () => {
      stop(); ro.disconnect(); io.disconnect(); mo.disconnect();
      scheme.removeEventListener('change', repalette);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // `make` is created fresh each render but only its first value matters: it re-runs on resize by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
