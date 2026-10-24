'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up from zero the first time it is on screen. The server sends the real number (so it is right without
 * script and for search engines), kept invisible until this has mounted; the css un-hides it after 1.6s regardless.
 * Reduced-motion readers see the final number at once.
 */
export default function CountUp({ value, locale = 'en-GB' }: { value: number; locale?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => el.removeAttribute('data-fx-pending');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !Number.isFinite(value) || value === 0) { done(); return; }
    let raf = 0;
    const run = () => {
      const t0 = performance.now(), dur = Math.min(1400, 600 + Math.log10(Math.abs(value) + 1) * 220);
      setShown(0);
      done();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) { io.disconnect(); run(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref} className="fx-count" data-fx-pending="">{shown.toLocaleString(locale)}</span>;
}
