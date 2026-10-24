'use client';

import { rgb, useCanvasLoop } from '../useCanvasLoop';

/** Drifting particles joined by faint lines when they come close; the pointer pulls nearby ones in and links to them. */
export default function Particles() {
  const ref = useCanvasLoop((f) => {
    const n = Math.round(Math.min(90, Math.max(22, (f.w * f.h) / (f.coarse ? 22000 : 13000))));
    const link = f.w < 640 ? 90 : 120;
    const ps = Array.from({ length: n }, () => ({
      x: Math.random() * f.w, y: Math.random() * f.h,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: 1 + Math.random() * 1.6, a: Math.random() < 0.5,
    }));
    return ({ ctx, w, h, pal, pointer, dt, reduced }) => {
      const step = reduced ? 0 : dt / 16;
      for (const p of ps) {
        if (pointer.active) {
          const dx = pointer.x - p.x, dy = pointer.y - p.y, d = Math.hypot(dx, dy);
          if (d < 160 && d > 1) { p.vx += (dx / d) * 0.012 * step; p.vy += (dy / d) * 0.012 * step; }
        }
        p.vx *= 0.995; p.vy *= 0.995;
        p.x += p.vx * step; p.y += p.vy * step;
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i]!;
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link) { ctx.strokeStyle = rgb(pal.primary, (1 - d / link) * 0.28); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        if (pointer.active) {
          const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          if (d < 150) { ctx.strokeStyle = rgb(pal.signal, (1 - d / 150) * 0.5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke(); }
        }
      }
      for (const p of ps) { ctx.fillStyle = rgb(p.a ? pal.primary : pal.signal, 0.75); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    };
  });
  return <canvas ref={ref} className="fx-bg" aria-hidden="true" />;
}
