'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Lenis smoothing for the home page's scroll, as the RCS9 site does. Links to #sections glide there
 * and stop below the fixed header. Off when the reader prefers less motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 3), anchors: { offset: -72 } });
    let raf = requestAnimationFrame(function tick(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(tick);
    });
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
  return null;
}
