'use client';

import { useEffect, useRef } from 'react';

const GAP = 24;

interface Runner { x: number; y: number; dx: number; dy: number; left: number; speed: number; pulse: number }

/**
 * The hero's dotted territory: a faint grid of dots, a few glowing ones travelling along it and
 * turning at crossings, and the dots nearest the pointer lifting towards it. Pauses when the hero
 * is off screen; a still grid when the reader prefers less motion.
 */
export function Territory() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, last = performance.now();
    let dot = '#bccad4', sig = '#1fb8e0';
    const pointer = { x: -9999, y: -9999 };
    let runners: Runner[] = [];

    const colours = () => {
      const cs = getComputedStyle(document.documentElement);
      dot = cs.getPropertyValue('--line-strong').trim() || dot;
      sig = cs.getPropertyValue('--signal').trim() || sig;
    };
    const turn = (r: Runner) => {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !(dx === -r.dx && dy === -r.dy));
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      r.dx = dx; r.dy = dy; r.left = GAP * (2 + Math.floor(Math.random() * 6));
    };
    const spawn = (): Runner => {
      const r = {
        x: GAP * Math.floor((w * (0.35 + Math.random() * 0.6)) / GAP),
        y: GAP * Math.floor((h * (0.1 + Math.random() * 0.8)) / GAP),
        dx: 1, dy: 0, left: 0, speed: 22 + Math.random() * 26, pulse: Math.random() * Math.PI * 2,
      };
      turn(r);
      return r;
    };
    const size = () => {
      const box = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = box.width; h = box.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      runners = Array.from({ length: w < 720 ? 4 : 8 }, spawn);
    };

    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      // the grid, fading out towards the left where the words are, and near the edges
      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          const edge = Math.min(1, x / (w * 0.45)) * Math.min(1, (h - y) / 120, y / 80);
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          // a soft lift under the pointer, not a patch: slightly bigger, gently tinted
          const near = d < 90 ? Math.pow(1 - d / 90, 2) : 0;
          ctx.globalAlpha = Math.max(0.12, edge * 0.9) + near * 0.35;
          ctx.fillStyle = near > 0.25 ? sig : dot;
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + near * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // the travellers
      for (const r of runners) {
        if (!still) {
          const step = r.speed * dt;
          r.x += r.dx * step; r.y += r.dy * step; r.left -= step;
          if (r.left <= 0) {
            r.x = Math.round(r.x / GAP) * GAP; r.y = Math.round(r.y / GAP) * GAP;
            turn(r);
          }
          if (r.x < w * 0.3 || r.x > w || r.y < 0 || r.y > h) Object.assign(r, spawn());
          r.pulse += dt * 2.4;
        }
        const x = r.x + GAP / 2, y = r.y + GAP / 2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
        g.addColorStop(0, sig); g.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.28 + Math.sin(r.pulse) * 0.1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = sig;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!still && visible) raf = requestAnimationFrame(draw);
    };

    colours();
    size();
    raf = requestAnimationFrame(draw);

    const onMove = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top;
      if (still) requestAnimationFrame(draw);
    };
    const onResize = () => { size(); if (still) requestAnimationFrame(draw); };
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was && !still) { last = performance.now(); raf = requestAnimationFrame(draw); }
    });
    io.observe(canvas);
    // theme switches change the colours
    const mo = new MutationObserver(() => { colours(); if (still) requestAnimationFrame(draw); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => colours();
    mq.addEventListener('change', onScheme);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); mo.disconnect();
      mq.removeEventListener('change', onScheme);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <div className="lp-territory" aria-hidden="true"><canvas ref={ref} /></div>;
}
