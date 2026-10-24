'use client';

import { rgb, useCanvasLoop } from '../useCanvasLoop';

/** Twinkling stars drifting sideways at three depths, with a little pointer parallax. White in dark mode, brand colours in light. */
export default function Stars() {
  const ref = useCanvasLoop((f) => {
    const n = Math.round(Math.min(260, (f.w * f.h) / 6500));
    const stars = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * f.w, y: Math.random() * f.h, z: 0.25 + Math.random() * 0.75, p: Math.random() * Math.PI * 2, c: i % 3,
    }));
    return ({ ctx, w, pal, pointer, t, reduced }) => {
      const ox = pointer.active ? (pointer.x - w / 2) * 0.03 : 0;
      for (const s of stars) {
        const tw = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * (0.8 + s.z * 1.6) + s.p);
        const x = (((s.x + (reduced ? 0 : t * 5 * s.z) - ox * s.z) % (w + 4)) + w + 4) % (w + 4) - 2;
        const base = pal.dark ? pal.ink : s.c === 0 ? pal.primary : pal.signal;
        ctx.fillStyle = rgb(base, (pal.dark ? 0.25 : 0.34) + 0.66 * tw * s.z);
        ctx.beginPath();
        ctx.arc(x, s.y, 0.6 + s.z * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };
  });
  return <canvas ref={ref} className="fx-bg" aria-hidden="true" />;
}
