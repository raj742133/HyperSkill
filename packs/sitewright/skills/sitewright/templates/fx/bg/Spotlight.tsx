'use client';

import { useEffect, useRef } from 'react';

/** A soft light that eases toward the pointer. Touch screens and reduced-motion readers get it resting where the CSS puts it. */
export default function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) return;
    let tx = 72, ty = 28, x = 72, y = 28, raf = 0, on = false;
    const tick = () => {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      el.style.setProperty('--sx', `${x}%`); el.style.setProperty('--sy', `${y}%`);
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(tick); else on = false;
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top - 80 || e.clientY > r.bottom + 80) return;
      tx = ((e.clientX - r.left) / r.width) * 100; ty = ((e.clientY - r.top) / r.height) * 100;
      if (!on) { on = true; raf = requestAnimationFrame(tick); }
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className="fx-bg fx-spot" aria-hidden="true" />;
}
