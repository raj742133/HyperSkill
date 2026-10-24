'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useFinePointer, useReducedMotion } from './_k2';

export interface IridescentFoilProps {
  children?: ReactNode;
  /** Thickness of the foil frame in px. */
  frame?: number;
  className?: string;
}

/** A holographic foil frame that shifts with scroll and pointer position; the children sit on an opaque inner surface. */
export default function IridescentFoil({ children, frame = 10, className }: IridescentFoilProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let raf = 0;
    const scroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect(), vh = window.innerHeight || 1;
        const t = Math.min(1, Math.max(0, 1 - (r.top + r.height / 2) / vh));
        el.style.setProperty('--ui-foil-s', `${Math.round(t * 360)}deg`);
      });
    };
    const move = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--ui-foil-x', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        el.style.setProperty('--ui-foil-y', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      });
    };
    scroll();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    if (fine) el.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll);
      el.removeEventListener('pointermove', move);
    };
  }, [fine, reduced]);
  return (
    <div ref={ref} className={`ui-iridescent-foil-root ${className ?? ''}`} style={{ padding: frame }}>
      <div className="ui-iridescent-foil-inner">{children}</div>
    </div>
  );
}

export function Demo() {
  return (
    <IridescentFoil>
      <strong style={{ display: 'block', fontSize: 16 }}>Founders edition</strong>
      <span style={{ color: 'var(--muted, #6b7280)', fontSize: 13 }}>Tilt, scroll, and the foil moves.</span>
    </IridescentFoil>
  );
}
