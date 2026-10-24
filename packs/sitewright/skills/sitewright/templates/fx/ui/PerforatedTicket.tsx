'use client';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useFinePointer, useReducedMotion } from './_k2';

export interface PerforatedTicketProps {
  header?: ReactNode;
  children?: ReactNode;
  stub?: ReactNode;
  /** Depth of the pointer parallax in degrees (0 turns it off). */
  tilt?: number;
  className?: string;
  'aria-label'?: string;
}

/** A ticket with notched sides and a perforated divider; header, body and stub are separate sections. */
export default function PerforatedTicket({ header, children, stub, tilt = 6, className, 'aria-label': label }: PerforatedTicketProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !fine || reduced || !tilt) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ui-pt-rx', `${(-y * tilt).toFixed(2)}deg`);
        el.style.setProperty('--ui-pt-ry', `${(x * tilt).toFixed(2)}deg`);
        el.style.setProperty('--ui-pt-x', `${(x * 12).toFixed(1)}px`);
      });
    };
    const leave = () => { cancelAnimationFrame(raf); el.style.removeProperty('--ui-pt-rx'); el.style.removeProperty('--ui-pt-ry'); el.style.removeProperty('--ui-pt-x'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [fine, reduced, tilt]);
  return (
    <div ref={ref} className={`ui-perforated-ticket-root ${className ?? ''}`} role="group" aria-label={label}>
      <div className="ui-perforated-ticket-shape" data-stub={stub !== undefined}>
        <div className="ui-perforated-ticket-top">
          {header !== undefined && <div className="ui-perforated-ticket-head">{header}</div>}
          <div className="ui-perforated-ticket-body">{children}</div>
        </div>
        {stub !== undefined && <div className="ui-perforated-ticket-stub">{stub}</div>}
      </div>
    </div>
  );
}

export function Demo() {
  const mono: CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };
  return (
    <PerforatedTicket aria-label="Release ticket" header={<><span style={mono}>RELEASE</span><span style={mono}>No. 0142</span></>}
      stub={<><span style={mono}>ADMIT ONE</span><strong style={mono}>v2.4</strong></>}>
      <strong style={{ fontSize: 17, display: 'block' }}>Spring release</strong>
      <span style={{ color: 'var(--muted, #6b7280)', fontSize: 13 }}>Shipped 14 March, 12 changes</span>
    </PerforatedTicket>
  );
}
