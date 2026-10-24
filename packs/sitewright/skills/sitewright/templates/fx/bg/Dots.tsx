'use client';

import { rgb, useCanvasLoop } from '../useCanvasLoop';

/** A grid of dots. Near the pointer they swell, glow and are pushed gently away; a slow ripple keeps it alive when nobody is pointing. */
export default function Dots() {
  const ref = useCanvasLoop((f) => {
    const gap = f.w < 640 ? 22 : 28;
    const cols = Math.ceil(f.w / gap) + 1;
    const rows = Math.ceil(f.h / gap) + 1;
    const reach = 150;
    return ({ ctx, pal, pointer, t, reduced }) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * gap, y = r * gap;
          const dx = x - pointer.x, dy = y - pointer.y;
          const d = Math.hypot(dx, dy);
          const near = pointer.active && d < reach ? 1 - d / reach : 0;
          const wave = reduced ? 0 : Math.max(0, Math.sin(t * 1.1 - (x + y) / 110)) * 0.55;
          const px = d > 0 ? x + (dx / d) * near * 10 : x;
          const py = d > 0 ? y + (dy / d) * near * 10 : y;
          const k = Math.max(near, wave * 0.6);
          ctx.fillStyle = k > 0.04 ? rgb(pal.signal, 0.3 + 0.7 * k) : rgb(pal.ink, 0.15);
          ctx.beginPath();
          ctx.arc(px, py, 1.15 + near * 2.7 + wave * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
  });
  return <canvas ref={ref} className="fx-bg" aria-hidden="true" />;
}
